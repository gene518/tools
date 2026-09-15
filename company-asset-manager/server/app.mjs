import express from "express";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import multer from "multer";
import { randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, unlinkSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { z } from "zod";
import { openDatabase, transaction } from "./database.mjs";
import {
  configureAuth,
  adminOnly,
  passwordSchema,
  hashPassword,
} from "./auth.mjs";
import {
  AppError,
  employeeSchema,
  assetSchema,
  metadataSchema,
  actionSchema,
  required,
  id,
  createAsset,
  updateAsset,
  assetAction,
  getAsset,
  listAssets,
  logEvent,
  decodeEvent,
} from "./domain.mjs";
import { exportCsv, importCsv } from "./import-export.mjs";
import { EVENT_CATEGORIES } from "../shared/event-categories.mjs";
export async function createApp(options = {}) {
  const dataDir = resolve(options.dataDir || "./data");
  mkdirSync(join(dataDir, "uploads"), {
    recursive: true,
    mode: 0o700,
  });
  const db =
    options.db || openDatabase(options.databaseUrl || process.env.DATABASE_URL);
  await db.initialize();
  const app = express();
  app.disable("x-powered-by");
  if (options.trustProxy) app.set("trust proxy", 1);
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          "img-src": ["'self'", "data:"],
          "script-src": ["'self'"],
          "upgrade-insecure-requests": options.secureCookie ? [] : null,
        },
      },
      strictTransportSecurity: options.secureCookie ? undefined : false,
    }),
  );
  app.use(cookieParser());
  app.use(
    express.json({
      limit: "1mb",
    }),
  );
  app.use(
    express.text({
      type: "text/csv",
      limit: "2mb",
    }),
  );
  app.get("/api/health", async (req, res) => {
    await db.prepare("SELECT 1").get();
    res.json({
      status: "ok",
    });
  });
  app.use("/api", (req, res, next) => {
    res.set("Cache-Control", "no-store");
    next();
  });
  await configureAuth(app, db, options);
  app.get("/api/employees", async (req, res) =>
    res.json(
      await db
        .prepare(
          `SELECT e.*,
    (SELECT count(*) FROM assets a WHERE a.owner_id=e.id) AS owned_count,
    (SELECT count(*) FROM assets a WHERE a.user_id=e.id) AS used_count
    FROM employees e ORDER BY e.status,e.department,e.code`,
        )
        .all(),
    ),
  );
  app.post("/api/employees", adminOnly, async (req, res) => {
    const input = employeeSchema.parse(req.body);
    const result = await transaction(db, async () => {
      const created = await db
        .prepare(
          "INSERT INTO employees(code,name,department,status) VALUES(?,?,?,?)",
        )
        .run(input.code, input.name, input.department, input.status);
      const after = {
        ...input,
        id: Number(created.lastInsertRowid),
      };
      await logEvent(db, req.actor, "employee_create", {
        entity: `employee:${after.id}`,
        after,
      });
      return after;
    });
    res.status(201).json(result);
  });
  app.put("/api/employees/:id", adminOnly, async (req, res) => {
    const employeeId = id.parse(req.params.id),
      input = employeeSchema.parse(req.body);
    const result = await transaction(db, async () => {
      const before = await db
        .prepare("SELECT * FROM employees WHERE id=?")
        .get(employeeId);
      if (!before) throw new AppError(404, "员工不存在");
      await db
        .prepare(
          "UPDATE employees SET code=?,name=?,department=?,status=? WHERE id=?",
        )
        .run(
          input.code,
          input.name,
          input.department,
          input.status,
          employeeId,
        );
      const after = {
        ...input,
        id: employeeId,
      };
      await logEvent(db, req.actor, "employee_edit", {
        entity: `employee:${employeeId}`,
        before,
        after,
      });
      return after;
    });
    res.json(result);
  });
  app.get("/api/assets", async (req, res) => {
    const query = z
      .object({
        q: z.string().max(200).optional(),
        status: z
          .enum(["available", "pending", "in_use", "repair", "retired", ""])
          .optional(),
        category: z.string().max(200).optional(),
        owner_id: id.optional(),
        user_id: id.optional(),
        department: z.string().max(200).optional(),
        departed: z.enum(["0", "1"]).optional(),
        page: id.max(1000000).default(1),
        pageSize: id.max(100).default(20),
      })
      .parse(req.query);
    const rows = await listAssets(db, query);
    res.json({
      items: rows.slice(
        (query.page - 1) * query.pageSize,
        query.page * query.pageSize,
      ),
      total: rows.length,
      page: query.page,
      pageSize: query.pageSize,
    });
  });
  app.get("/api/assets/export", async (req, res) => {
    const query = z
      .object({
        q: z.string().max(200).optional(),
        status: z.string().max(30).optional(),
        category: z.string().max(200).optional(),
        owner_id: id.optional(),
        user_id: id.optional(),
        department: z.string().max(200).optional(),
        departed: z.enum(["0", "1"]).optional(),
      })
      .parse(req.query);
    res
      .attachment("assets.csv")
      .type("text/csv; charset=utf-8")
      .send(exportCsv(await listAssets(db, query)));
  });
  app.get("/api/assets/template", (req, res) =>
    res
      .attachment("asset-import-template.csv")
      .type("text/csv; charset=utf-8")
      .send(exportCsv([])),
  );
  app.post("/api/assets/import", adminOnly, async (req, res) =>
    res.json(
      await importCsv(db, req.actor, req.body, req.query.dry_run === "1"),
    ),
  );
  app.get("/api/assets/:id", async (req, res) => {
    const assetId = id.parse(req.params.id),
      asset = await getAsset(db, assetId);
    res.json({
      ...asset,
      events: (
        await db
          .prepare("SELECT * FROM events WHERE asset_id=? ORDER BY id DESC")
          .all(assetId)
      ).map(decodeEvent),
      pending_handover:
        (await db
          .prepare(
            "SELECT h.*,e.name AS target_name,e.code AS target_code FROM handovers h JOIN employees e ON e.id=h.target_id WHERE h.asset_id=? AND h.state='pending'",
          )
          .get(assetId)) || null,
      attachments: await db
        .prepare(
          "SELECT id,asset_id,event_id,original_name,mime,size,created_at FROM attachments WHERE asset_id=? ORDER BY id DESC",
        )
        .all(assetId),
    });
  });
  app.post("/api/assets", adminOnly, async (req, res) =>
    res
      .status(201)
      .json(
        await transaction(
          db,
          async () =>
            await createAsset(db, req.actor, assetSchema.parse(req.body)),
        ),
      ),
  );
  app.put("/api/assets/:id", adminOnly, async (req, res) =>
    res.json(
      await transaction(
        db,
        async () =>
          await updateAsset(
            db,
            req.actor,
            id.parse(req.params.id),
            metadataSchema.parse(req.body),
          ),
      ),
    ),
  );
  app.post("/api/assets/:id/actions/:action", adminOnly, async (req, res) =>
    res.json(
      await transaction(
        db,
        async () =>
          await assetAction(
            db,
            req.actor,
            id.parse(req.params.id),
            req.params.action,
            actionSchema.parse(req.body),
          ),
      ),
    ),
  );
  const upload = multer({
    storage: multer.diskStorage({
      destination: join(dataDir, "uploads"),
      filename: (req, file, cb) => cb(null, randomUUID()),
    }),
    limits: {
      fileSize: 10 * 1024 * 1024,
      files: 1,
      fields: 2,
    },
    fileFilter: (req, file, cb) =>
      cb(
        null,
        ["application/pdf", "image/jpeg", "image/png"].includes(file.mimetype),
      ),
  });
  app.post(
    "/api/assets/:id/attachments",
    adminOnly,
    async (req, res, next) => {
      try {
        await getAsset(db, id.parse(req.params.id));
        next();
      } catch (error) {
        next(error);
      }
    },
    upload.single("file"),
    async (req, res) => {
      if (!req.file)
        throw new AppError(422, "仅支持 PDF、PNG 和 JPG，最大 10 MB");
      try {
        const bytes = readFileSync(req.file.path),
          mime = req.file.mimetype;
        const valid =
          mime === "application/pdf"
            ? bytes.subarray(0, 5).toString() === "%PDF-"
            : mime === "image/png"
              ? bytes
                  .subarray(0, 8)
                  .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
              : bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
        if (!valid) throw new AppError(422, "附件内容与文件类型不符");
        const assetId = id.parse(req.params.id),
          eventId = req.body.event_id ? id.parse(req.body.event_id) : null;
        if (
          eventId &&
          !(await db
            .prepare("SELECT id FROM events WHERE id=? AND asset_id=?")
            .get(eventId, assetId))
        )
          throw new AppError(422, "交接记录不存在");
        const filename = Buffer.from(req.file.originalname, "latin1")
          .toString("utf8")
          .replace(/[\x00-\x1f/\\]/g, "_")
          .slice(0, 200);
        const result = await transaction(db, async () => {
          const saved = await db
            .prepare(
              "INSERT INTO attachments(asset_id,event_id,original_name,stored_name,mime,size,actor_id) VALUES(?,?,?,?,?,?,?)",
            )
            .run(
              assetId,
              eventId,
              filename,
              req.file.filename,
              mime,
              req.file.size,
              req.actor.id,
            );
          await logEvent(db, req.actor, "attachment", {
            assetId,
            details: {
              filename,
              event_id: eventId,
              attachment_id: Number(saved.lastInsertRowid),
            },
          });
          return {
            id: Number(saved.lastInsertRowid),
            original_name: filename,
          };
        });
        res.status(201).json(result);
      } catch (error) {
        unlinkSync(req.file.path);
        throw error;
      }
    },
  );
  app.get("/api/attachments/:id", async (req, res) => {
    const attachment = await db
      .prepare("SELECT * FROM attachments WHERE id=?")
      .get(id.parse(req.params.id));
    if (!attachment) throw new AppError(404, "附件不存在");
    res
      .type(attachment.mime)
      .download(
        join(dataDir, "uploads", attachment.stored_name),
        attachment.original_name,
      );
  });
  app.get("/api/events", async (req, res) => {
    const { page, pageSize, action, category } = z
      .object({
        page: id.default(1),
        pageSize: id.max(100).default(30),
        action: z.string().max(50).optional(),
        category: z.enum(EVENT_CATEGORIES.map((item) => item.key)).optional(),
      })
      .parse(req.query);
    const conditions = [],
      args = [];
    if (category) {
      conditions.push("e.action=ANY(?::text[])");
      args.push(EVENT_CATEGORIES.find((item) => item.key === category).actions);
    }
    if (action) {
      conditions.push("e.action=?");
      args.push(action);
    }
    const where = conditions.length ? " WHERE " + conditions.join(" AND ") : "";
    const total = (
      await db
        .prepare("SELECT count(*) AS count FROM events e" + where)
        .get(...args)
    ).count;
    const items = (
      await db
        .prepare(
          "SELECT e.*,a.code AS asset_code,a.name AS asset_name FROM events e LEFT JOIN assets a ON a.id=e.asset_id" +
            where +
            " ORDER BY e.id DESC LIMIT ? OFFSET ?",
        )
        .all(...args, pageSize, (page - 1) * pageSize)
    ).map(decodeEvent);
    const actionCounts = Object.fromEntries(
      (
        await db
          .prepare(
            "SELECT action,count(*) AS count FROM events GROUP BY action",
          )
          .all()
      ).map((item) => [item.action, item.count]),
    );
    res.json({
      items,
      total,
      page,
      pageSize,
      counts: Object.fromEntries(
        EVENT_CATEGORIES.map((item) => [
          item.key,
          item.actions.reduce(
            (count, key) => count + (actionCounts[key] || 0),
            0,
          ),
        ]),
      ),
    });
  });
  app.get("/api/stats", async (req, res) => {
    const counts = Object.fromEntries(
      (
        await db
          .prepare(
            "SELECT status,count(*) AS count FROM assets GROUP BY status",
          )
          .all()
      ).map((r) => [r.status, r.count]),
    );
    const value =
      (
        await db
          .prepare(
            "SELECT COALESCE(SUM(purchase_amount),0) AS total FROM assets WHERE status<>'retired'",
          )
          .get()
      ).total / 100;
    const departments = await db
      .prepare(
        `SELECT e.department,count(*) AS count,SUM(CASE WHEN a.status='in_use' THEN 1 ELSE 0 END) AS in_use FROM assets a JOIN employees e ON e.id=a.owner_id WHERE a.status<>'retired' GROUP BY e.department ORDER BY count DESC`,
      )
      .all();
    const warnings = {
      departed_users: (
        await db
          .prepare(
            "SELECT count(*) AS n FROM assets a JOIN employees e ON e.id=a.user_id WHERE e.status='departed'",
          )
          .get()
      ).n,
      departed_owners: (
        await db
          .prepare(
            "SELECT count(*) AS n FROM assets a JOIN employees e ON e.id=a.owner_id WHERE e.status='departed' AND a.status<>'retired'",
          )
          .get()
      ).n,
      warranty_expiring: (
        await db
          .prepare(
            "SELECT count(*) AS n FROM assets WHERE warranty_date BETWEEN date('now') AND date('now','+30 days') AND status<>'retired'",
          )
          .get()
      ).n,
    };
    res.json({
      counts,
      total: Object.values(counts).reduce((a, b) => a + b, 0),
      value,
      departments,
      warnings,
      employees: (
        await db
          .prepare("SELECT count(*) AS n FROM employees WHERE status='active'")
          .get()
      ).n,
    });
  });
  app.get("/api/accounts", adminOnly, async (req, res) =>
    res.json(
      await db
        .prepare(
          "SELECT id,username,name,role,active,created_at FROM accounts ORDER BY id",
        )
        .all(),
    ),
  );
  const accountSchema = z.object({
    username: z
      .string()
      .trim()
      .regex(/^[a-zA-Z0-9_.-]{3,50}$/, "账号为 3-50 位字母、数字或 ._-"),
    name: required,
    role: z.enum(["admin", "viewer"]),
    password: passwordSchema,
  });
  app.post("/api/accounts", adminOnly, async (req, res) => {
    const input = accountSchema.parse(req.body);
    const result = await transaction(db, async () => {
      const saved = await db
        .prepare(
          "INSERT INTO accounts(username,name,role,password_hash) VALUES(?,?,?,?)",
        )
        .run(
          input.username,
          input.name,
          input.role,
          hashPassword(input.password),
        );
      const after = {
        id: Number(saved.lastInsertRowid),
        username: input.username,
        name: input.name,
        role: input.role,
        active: 1,
      };
      await logEvent(db, req.actor, "account_create", {
        entity: `account:${after.id}`,
        after,
      });
      return after;
    });
    res.status(201).json(result);
  });
  app.put("/api/accounts/:id", adminOnly, async (req, res) => {
    const accountId = id.parse(req.params.id);
    const input = z
      .object({
        name: required,
        role: z.enum(["admin", "viewer"]),
        active: z.boolean(),
        password: z.union([z.literal(""), passwordSchema]).optional(),
      })
      .strict()
      .parse(req.body);
    const result = await transaction(db, async () => {
      const before = await db
        .prepare("SELECT id,username,name,role,active FROM accounts WHERE id=?")
        .get(accountId);
      if (!before) throw new AppError(404, "账号不存在");
      if (
        accountId === req.actor.id &&
        (!input.active || input.role !== "admin")
      )
        throw new AppError(422, "不能停用或降级自己的管理员账号");
      await db
        .prepare("UPDATE accounts SET name=?,role=?,active=? WHERE id=?")
        .run(input.name, input.role, input.active ? 1 : 0, accountId);
      if (input.password)
        await db
          .prepare("UPDATE accounts SET password_hash=? WHERE id=?")
          .run(hashPassword(input.password), accountId);
      await db
        .prepare("DELETE FROM sessions WHERE account_id=?")
        .run(accountId);
      const after = {
        id: accountId,
        username: before.username,
        name: input.name,
        role: input.role,
        active: input.active ? 1 : 0,
      };
      await logEvent(db, req.actor, "account_edit", {
        entity: `account:${accountId}`,
        before,
        after,
        details: {
          password_reset: Boolean(input.password),
        },
      });
      return after;
    });
    res.json(result);
  });
  app.use("/api", (req, res, next) => next(new AppError(404, "接口不存在")));
  const dist = resolve(options.distDir || "./dist");
  if (existsSync(dist)) {
    app.use(
      express.static(dist, {
        index: false,
      }),
    );
    app.get("/{*path}", (req, res) => res.sendFile(join(dist, "index.html")));
  }
  app.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    if (error instanceof z.ZodError)
      return res.status(422).json({
        error: "填写信息有误",
        details: error.issues.map((i) => ({
          field: i.path.join("."),
          error: i.message,
        })),
      });
    if (error.code === "23505")
      return res.status(409).json({
        error: "编号、序列号或账号已存在，请检查重复数据",
      });
    if (error instanceof multer.MulterError)
      return res.status(422).json({
        error:
          error.code === "LIMIT_FILE_SIZE"
            ? "附件不能超过 10 MB"
            : "附件上传失败",
      });
    if (error.type === "entity.too.large")
      return res.status(413).json({
        error: "文件或请求内容过大",
      });
    if (error instanceof SyntaxError && error.status === 400)
      return res.status(400).json({
        error: "请求数据格式错误",
      });
    const status = error.status || 500;
    if (status === 500) console.error("Request failed", error);
    res.status(status).json({
      error: status === 500 ? "服务器处理失败，请稍后重试" : error.message,
      ...(error.details
        ? {
            details: error.details,
          }
        : {}),
    });
  });
  return {
    app,
    db,
  };
}
