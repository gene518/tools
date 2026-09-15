import {
  randomBytes,
  scryptSync,
  timingSafeEqual,
  createHash,
} from "node:crypto";
import { z } from "zod";
import { rateLimit } from "express-rate-limit";
import { AppError, logEvent } from "./domain.mjs";
import { transaction } from "./database.mjs";
export const passwordSchema = z.string().min(12, "密码至少 12 位").max(128);
export function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
}
export function verifyPassword(password, hash) {
  const [salt, key] = hash.split(":");
  return timingSafeEqual(
    scryptSync(password, salt, 64),
    Buffer.from(key, "hex"),
  );
}
export const tokenHash = (token) =>
  createHash("sha256").update(token).digest("hex");
export async function configureAuth(
  app,
  db,
  {
    adminUsername,
    adminPassword,
    secureCookie,
    appOrigin,
    basePath = "/",
    testMode,
  },
) {
  if (!(await db.prepare("SELECT id FROM accounts LIMIT 1").get())) {
    passwordSchema.parse(adminPassword);
    await db
      .prepare(
        "INSERT INTO accounts(username,name,password_hash,role) VALUES(?,?,?,?)",
      )
      .run(
        adminUsername || "admin",
        "资产管理员",
        hashPassword(adminPassword),
        "admin",
      );
  }
  const cookieOptions = {
    httpOnly: true,
    sameSite: "strict",
    secure: secureCookie,
    path: basePath,
  };
  const dummyHash = hashPassword(randomBytes(24).toString("hex"));
  app.use("/api", (req, res, next) => {
    if (!["GET", "HEAD", "OPTIONS"].includes(req.method)) {
      if (req.get("X-Requested-With") !== "asset-manager")
        return next(new AppError(403, "请求来源无效"));
      const origin = req.get("origin");
      if (origin && appOrigin && !appOrigin.split(",").includes(origin))
        return next(new AppError(403, "请求来源不匹配"));
    }
    next();
  });
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 20,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    skip: () => testMode,
    message: {
      error: "登录尝试过于频繁，请 15 分钟后重试",
    },
  });
  app.post("/api/login", limiter, async (req, res) => {
    const input = z
      .object({
        username: z.string().trim().min(1).max(100),
        password: z.string().min(1).max(128),
      })
      .parse(req.body);
    const account = await db
      .prepare("SELECT * FROM accounts WHERE username=?")
      .get(input.username);
    if (
      !verifyPassword(input.password, account?.password_hash || dummyHash) ||
      !account?.active
    )
      throw new AppError(401, "账号或密码错误");
    const token = randomBytes(32).toString("base64url");
    await transaction(db, async () => {
      await db
        .prepare("DELETE FROM sessions WHERE expires_at<?")
        .run(Date.now());
      if (req.cookies.asset_session)
        await db
          .prepare("DELETE FROM sessions WHERE token_hash=?")
          .run(tokenHash(req.cookies.asset_session));
      await db
        .prepare(
          "INSERT INTO sessions(token_hash,account_id,expires_at) VALUES(?,?,?)",
        )
        .run(tokenHash(token), account.id, Date.now() + 8 * 60 * 60 * 1000);
      await logEvent(db, account, "login", {
        entity: `account:${account.id}`,
      });
    });
    res
      .cookie("asset_session", token, {
        ...cookieOptions,
        maxAge: 8 * 60 * 60 * 1000,
      })
      .json({
        id: account.id,
        username: account.username,
        name: account.name,
        role: account.role,
      });
  });
  app.use("/api", async (req, res, next) => {
    const token = req.cookies.asset_session;
    if (!token || typeof token !== "string")
      return next(new AppError(401, "请先登录"));
    const account = await db
      .prepare(
        "SELECT a.id,a.username,a.name,a.role FROM accounts a JOIN sessions s ON a.id=s.account_id WHERE s.token_hash=? AND s.expires_at>? AND a.active=1",
      )
      .get(tokenHash(token), Date.now());
    if (!account) return next(new AppError(401, "登录已过期，请重新登录"));
    req.actor = account;
    next();
  });
  app.get("/api/me", (req, res) => res.json(req.actor));
  app.post("/api/logout", async (req, res) => {
    await transaction(db, async () => {
      await db
        .prepare("DELETE FROM sessions WHERE token_hash=?")
        .run(tokenHash(req.cookies.asset_session));
      await logEvent(db, req.actor, "logout", {
        entity: `account:${req.actor.id}`,
      });
    });
    res.clearCookie("asset_session", cookieOptions).json({
      ok: true,
    });
  });
  app.post("/api/password", async (req, res) => {
    const input = z
      .object({
        current_password: z.string().max(128),
        new_password: passwordSchema,
      })
      .parse(req.body);
    const account = await db
      .prepare("SELECT password_hash FROM accounts WHERE id=?")
      .get(req.actor.id);
    if (!verifyPassword(input.current_password, account.password_hash))
      throw new AppError(422, "当前密码错误");
    await transaction(db, async () => {
      await db
        .prepare("UPDATE accounts SET password_hash=? WHERE id=?")
        .run(hashPassword(input.new_password), req.actor.id);
      await db
        .prepare("DELETE FROM sessions WHERE account_id=?")
        .run(req.actor.id);
      await logEvent(db, req.actor, "password", {
        entity: `account:${req.actor.id}`,
      });
    });
    res.clearCookie("asset_session", cookieOptions).json({
      ok: true,
    });
  });
}
export function adminOnly(req, res, next) {
  if (req.actor.role !== "admin")
    return next(new AppError(403, "需要资产管理员权限"));
  next();
}
