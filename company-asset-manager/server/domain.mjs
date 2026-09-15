import { randomUUID } from "node:crypto";
import { z } from "zod";
export class AppError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}
export const required = z.string().trim().min(1, "不能为空").max(200);
export const text = z.string().trim().max(2000).default("");
export const id = z.coerce.number().int().positive();
export const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "日期格式应为 YYYY-MM-DD")
  .refine((v) => {
    const parsed = new Date(v + "T00:00:00Z");
    return (
      !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === v
    );
  }, "日期无效");
const optionalDate = z.preprocess(
  (v) => (v === "" || v === undefined ? null : v),
  date.nullable(),
);
const optionalId = z.preprocess(
  (v) => (v === "" || v === undefined ? null : v),
  id.nullable(),
);
export const employeeSchema = z
  .object({
    code: required,
    name: required,
    department: required,
    status: z.enum(["active", "departed"]).default("active"),
  })
  .strict();
export const assetSchema = z
  .object({
    code: z.string().trim().max(100).default(""),
    name: required,
    category: required.default("笔记本电脑"),
    brand: text,
    model: text,
    serial: z.string().trim().max(200).default(""),
    cpu: text,
    memory: text,
    disk: text,
    source: z.enum(["existing", "new"]).default("new"),
    entry_date: date,
    purchase_date: optionalDate,
    purchase_amount: z.preprocess(
      (v) => (v === "" || v == null ? null : v),
      z.coerce
        .number()
        .finite()
        .nonnegative()
        .max(1e9)
        .refine(
          (v) => Math.abs(v * 100 - Math.round(v * 100)) < 0.0001,
          "金额最多两位小数",
        )
        .nullable(),
    ),
    warranty_date: optionalDate,
    owner_id: id,
    user_id: optionalId,
    status: z
      .enum(["available", "in_use", "repair", "retired"])
      .default("available"),
    location: text,
    condition: required.default("完好"),
    accessories: text,
    notes: text,
    usage_date: optionalDate,
  })
  .strict();
export const metadataSchema = assetSchema
  .omit({
    user_id: true,
    owner_id: true,
    status: true,
    usage_date: true,
  })
  .extend({
    version: id,
  })
  .strict();
export const actionSchema = z
  .object({
    version: id,
    target_id: optionalId,
    effective_date: date,
    location: text,
    condition: required.default("完好"),
    accessories: text,
    notes: text,
    pending: z.boolean().default(false),
    needs_repair: z.boolean().default(false),
  })
  .strict();
export const STATUS = {
  available: "待分配",
  pending: "待交接",
  in_use: "使用中",
  repair: "维修中",
  retired: "已报废",
};
export const ACTION = {
  create: "资产登记",
  edit: "信息修正",
  assign: "设备分配",
  transfer: "设备转交",
  return: "设备归还",
  reserve: "发起交接",
  confirm: "确认交接",
  cancel: "取消交接",
  ownership: "归属变更",
  repair: "送修",
  restore: "维修完成",
  retire: "报废",
  attachment: "添加附件",
  employee_create: "新增员工",
  employee_edit: "更新员工",
  account_create: "新增账号",
  account_edit: "更新账号",
  password: "修改密码",
  login: "登录",
  logout: "退出登录",
};
const assetSelect = `SELECT a.*, o.name AS owner_name, o.code AS owner_code, o.department AS owner_department,
  o.status AS owner_status, u.name AS user_name, u.code AS user_code, u.department AS user_department, u.status AS user_status
  FROM assets a JOIN employees o ON o.id=a.owner_id LEFT JOIN employees u ON u.id=a.user_id`;
export async function person(db, personId, requireActive = false) {
  const row = await db
    .prepare("SELECT * FROM employees WHERE id=?")
    .get(personId);
  if (!row) throw new AppError(422, "员工不存在");
  if (requireActive && row.status !== "active")
    throw new AppError(422, "离职员工不能作为新的接收人或归属人");
  return row;
}
export async function getAsset(db, assetId) {
  const row = await db
    .prepare(
      assetSelect +
        " WHERE a.id=?" +
        (db.inTransaction() ? " FOR UPDATE OF a" : ""),
    )
    .get(assetId);
  if (!row) throw new AppError(404, "资产不存在");
  return {
    ...row,
    purchase_amount:
      row.purchase_amount == null ? null : row.purchase_amount / 100,
  };
}
export async function listAssets(db, query = {}) {
  const conditions = [],
    params = [];
  if (query.q) {
    conditions.push(
      `(a.code LIKE ? ESCAPE '\\' OR a.name LIKE ? ESCAPE '\\' OR a.serial LIKE ? ESCAPE '\\' OR a.model LIKE ? ESCAPE '\\' OR o.name LIKE ? ESCAPE '\\' OR u.name LIKE ? ESCAPE '\\')`,
    );
    const search =
      "%" +
      String(query.q)
        .replace(/[\\%_]/g, "\\$&")
        .slice(0, 200) +
      "%";
    params.push(...Array(6).fill(search));
  }
  for (const field of ["status", "category", "owner_id", "user_id"])
    if (query[field]) {
      conditions.push(`a.${field}=?`);
      params.push(query[field]);
    }
  if (query.department) {
    conditions.push("(o.department=? OR u.department=?)");
    params.push(query.department, query.department);
  }
  if (query.departed === "1") conditions.push("u.status='departed'");
  const rows = await db
    .prepare(
      assetSelect +
        (conditions.length ? " WHERE " + conditions.join(" AND ") : "") +
        " ORDER BY a.id DESC",
    )
    .all(...params);
  return rows.map((row) => ({
    ...row,
    purchase_amount:
      row.purchase_amount == null ? null : row.purchase_amount / 100,
  }));
}
export async function logEvent(
  db,
  actor,
  action,
  {
    assetId = null,
    entity = "asset",
    before = null,
    after = null,
    details = {},
    effectiveDate = null,
  } = {},
) {
  const result = await db
    .prepare(
      "INSERT INTO events(asset_id,entity,action,actor_id,actor_name,effective_date,before_json,after_json,details_json) VALUES(?,?,?,?,?,?,?,?,?)",
    )
    .run(
      assetId,
      entity,
      action,
      actor.id,
      actor.name,
      effectiveDate,
      before ? JSON.stringify(before) : null,
      after ? JSON.stringify(after) : null,
      JSON.stringify(details),
    );
  return Number(result.lastInsertRowid);
}
export function checkVersion(asset, version) {
  if (asset.version !== version)
    throw new AppError(409, "资产已被其他操作更新，请刷新后重试");
}
export async function validateAsset(db, input, editingId = null) {
  await person(db, input.owner_id, !editingId && input.source === "new");
  if (input.user_id) await person(db, input.user_id, input.source === "new");
  if (input.status === "in_use" && !input.user_id)
    throw new AppError(422, "使用中资产必须填写使用人");
  if (input.status !== "in_use" && input.user_id)
    throw new AppError(422, "只有使用中资产可以登记当前使用人");
  if (input.source === "new" && !editingId && input.status !== "available")
    throw new AppError(422, "新增设备必须先入库为待分配，再办理交接");
  if (input.status !== "in_use" && input.usage_date)
    throw new AppError(422, "无当前使用人时不能填写领用日期");
  if (
    input.code &&
    (await db
      .prepare("SELECT id FROM assets WHERE code=? AND id<>?")
      .get(input.code, editingId || 0))
  )
    throw new AppError(409, "资产编号已存在");
  if (
    input.serial &&
    (await db
      .prepare("SELECT id FROM assets WHERE serial=? AND id<>?")
      .get(input.serial, editingId || 0))
  )
    throw new AppError(409, "设备序列号已存在");
}
export async function createAsset(db, actor, input) {
  await validateAsset(db, input);
  const values = {
    ...input,
    code:
      input.code ||
      `IT-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}-${randomUUID().slice(0, 8).toUpperCase()}`,
    serial: input.serial || null,
    purchase_amount:
      input.purchase_amount == null
        ? null
        : Math.round(input.purchase_amount * 100),
  };
  const fields = Object.keys(values);
  const result = await db
    .prepare(
      `INSERT INTO assets(${fields.join(",")}) VALUES(${fields.map(() => "?").join(",")})`,
    )
    .run(...Object.values(values));
  const asset = await getAsset(db, Number(result.lastInsertRowid));
  await logEvent(db, actor, "create", {
    assetId: asset.id,
    after: asset,
    effectiveDate: input.entry_date,
    details: {
      historical_usage_date_unknown:
        input.status === "in_use" && !input.usage_date,
    },
  });
  return asset;
}
export async function updateAsset(db, actor, assetId, input) {
  const before = await getAsset(db, assetId);
  checkVersion(before, input.version);
  const merged = {
    ...before,
    ...input,
  };
  await validateAsset(db, merged, assetId);
  if (!input.code) throw new AppError(422, "资产编号不能为空");
  const { version, ...values } = input;
  values.serial = values.serial || null;
  values.purchase_amount =
    values.purchase_amount == null
      ? null
      : Math.round(values.purchase_amount * 100);
  await db
    .prepare(
      `UPDATE assets SET ${Object.keys(values)
        .map((k) => `${k}=?`)
        .join(
          ",",
        )}, version=version+1, updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=?`,
    )
    .run(...Object.values(values), assetId);
  const after = await getAsset(db, assetId);
  await logEvent(db, actor, "edit", {
    assetId,
    before,
    after,
    details: {
      notes: input.notes,
    },
  });
  return after;
}
export async function assetAction(db, actor, assetId, action, input) {
  const before = await getAsset(db, assetId);
  checkVersion(before, input.version);
  if (
    input.effective_date >
    new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Shanghai" })
  )
    throw new AppError(422, "交接日期不能晚于今天");
  const lastEvent = (
    await db
      .prepare(
        "SELECT MAX(effective_date) AS date FROM events WHERE asset_id=? AND action IN ('assign','transfer','return','confirm','repair','restore','retire')",
      )
      .get(assetId)
  ).date;
  if (
    action !== "ownership" &&
    (lastEvent || before.usage_date) &&
    input.effective_date < (lastEvent || before.usage_date)
  )
    throw new AppError(422, "交接日期不能早于上一次流转日期");
  const values = {
    location: input.location,
    condition: input.condition,
    accessories: input.accessories,
  };
  const details = {
    notes: input.notes,
    condition: input.condition,
    accessories: input.accessories,
  };
  let loggedAction = action;
  const requireState = (...states) => {
    if (!states.includes(before.status))
      throw new AppError(409, "当前资产状态不允许此操作");
  };
  const target = async () => {
    if (!input.target_id) throw new AppError(422, "请选择接收人");
    return await person(db, input.target_id, true);
  };
  if (action === "assign") {
    requireState("available");
    const receiver = await target();
    details.receiver = receiver;
    if (input.pending) {
      values.status = "pending";
      loggedAction = "reserve";
      await db
        .prepare(
          "INSERT INTO handovers(asset_id,target_id,target_snapshot,state,effective_date,location,condition,accessories,notes,created_by) VALUES(?,?,?,?,?,?,?,?,?,?)",
        )
        .run(
          assetId,
          receiver.id,
          JSON.stringify(receiver),
          "pending",
          input.effective_date,
          input.location,
          input.condition,
          input.accessories,
          input.notes,
          actor.id,
        );
    } else {
      values.status = "in_use";
      values.user_id = receiver.id;
      values.usage_date = input.effective_date;
    }
  } else if (action === "transfer") {
    requireState("in_use");
    const receiver = await target();
    if (receiver.id === before.user_id)
      throw new AppError(422, "新使用人不能与当前使用人相同");
    values.user_id = receiver.id;
    values.usage_date = input.effective_date;
    details.receiver = receiver;
  } else if (action === "return") {
    requireState("in_use");
    values.user_id = null;
    values.usage_date = null;
    values.status = input.needs_repair ? "repair" : "available";
  } else if (action === "ownership") {
    const owner = await target();
    if (!input.notes) throw new AppError(422, "请填写归属变更原因");
    if (owner.id === before.owner_id)
      throw new AppError(422, "新归属人不能与原归属人相同");
    values.owner_id = owner.id;
    details.new_owner = owner;
    delete values.location;
    delete values.condition;
    delete values.accessories;
  } else if (action === "confirm" || action === "cancel") {
    requireState("pending");
    const handover = await db
      .prepare("SELECT * FROM handovers WHERE asset_id=? AND state='pending'")
      .get(assetId);
    if (!handover) throw new AppError(409, "待交接记录不存在");
    if (action === "confirm") {
      const receiver = await person(db, handover.target_id, true);
      if (input.effective_date < handover.effective_date)
        throw new AppError(422, "确认日期不能早于发起交接日期");
      values.status = "in_use";
      values.user_id = receiver.id;
      values.usage_date = input.effective_date;
      details.receiver = receiver;
      details.confirmed_by_admin = actor.name;
    } else values.status = "available";
    details.handover_id = handover.id;
    await db
      .prepare(
        "UPDATE handovers SET state=?, completed_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=?",
      )
      .run(action === "confirm" ? "confirmed" : "cancelled", handover.id);
  } else if (action === "repair") {
    requireState("available");
    values.status = "repair";
  } else if (action === "restore") {
    requireState("repair");
    values.status = "available";
  } else if (action === "retire") {
    requireState("available", "repair");
    if (!input.notes) throw new AppError(422, "请填写报废原因");
    values.status = "retired";
  } else throw new AppError(404, "操作不存在");
  await db
    .prepare(
      `UPDATE assets SET ${Object.keys(values)
        .map((k) => `${k}=?`)
        .join(
          ",",
        )},version=version+1,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=?`,
    )
    .run(...Object.values(values), assetId);
  const after = await getAsset(db, assetId);
  const eventId = await logEvent(db, actor, loggedAction, {
    assetId,
    before,
    after,
    details,
    effectiveDate: input.effective_date,
  });
  return {
    ...after,
    event_id: eventId,
  };
}
export function decodeEvent(event) {
  return {
    ...event,
    before: event.before_json ? JSON.parse(event.before_json) : null,
    after: event.after_json ? JSON.parse(event.after_json) : null,
    details: JSON.parse(event.details_json),
    before_json: undefined,
    after_json: undefined,
    details_json: undefined,
  };
}
