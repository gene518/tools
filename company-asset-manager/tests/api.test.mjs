import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import request from "supertest";
import pg from "pg";
import { createApp } from "../server/app.mjs";

let app, db, control, admin, owner, user, other, departed;
const password = "Test-only-password-6789";
const databaseName = `assets_test_${process.pid}_${Date.now()}`;
const dataDir = mkdtempSync(join(tmpdir(), "assets-test-"));
const header = { "X-Requested-With": "asset-manager" };
const input = (overrides = {}) => ({
  name: "测试笔记本",
  owner_id: owner.id,
  entry_date: "2026-08-01",
  ...overrides,
});
const action = (asset, overrides = {}) => ({
  version: asset.version,
  effective_date: "2026-08-03",
  location: "总部 A 区",
  condition: "完好",
  accessories: "电源适配器",
  ...overrides,
});
const post = (url, body, agent = admin) =>
  agent.post(url).set(header).send(body);
const put = (url, body, agent = admin) => agent.put(url).set(header).send(body);
async function create(overrides = {}) {
  const r = await post("/api/assets", input(overrides));
  assert.equal(r.status, 201, JSON.stringify(r.body));
  return r.body;
}
async function act(asset, type, overrides = {}) {
  const r = await post(
    `/api/assets/${asset.id}/actions/${type}`,
    action(asset, overrides),
  );
  assert.equal(r.status, 200, JSON.stringify(r.body));
  return r.body;
}

before(async () => {
  const connectionString = process.env.DATABASE_URL;
  assert.ok(connectionString, "Run the local PostgreSQL service first");
  control = new pg.Pool({ connectionString });
  await control.query(`CREATE DATABASE ${databaseName}`);
  const url = new URL(connectionString);
  url.pathname = "/" + databaseName;
  ({ app, db } = await createApp({
    databaseUrl: url.toString(),
    dataDir,
    adminUsername: "admin",
    adminPassword: password,
    testMode: true,
    appOrigin: "http://localhost",
  }));
  admin = request.agent(app);
  assert.equal(
    (await post("/api/login", { username: "admin", password })).status,
    200,
  );
  owner = (
    await post("/api/employees", {
      code: "E001",
      name: "归属人甲",
      department: "信息部",
    })
  ).body;
  user = (
    await post("/api/employees", {
      code: "E002",
      name: "使用人乙",
      department: "产品部",
    })
  ).body;
  other = (
    await post("/api/employees", {
      code: "E003",
      name: "使用人丙",
      department: "研发部",
    })
  ).body;
  departed = (
    await post("/api/employees", {
      code: "E004",
      name: "离职员工",
      department: "市场部",
      status: "departed",
    })
  ).body;
  assert.ok(owner.id && user.id && other.id && departed.id);
});
after(async () => {
  if (db) await db.close();
  if (control) {
    await control.query(`DROP DATABASE IF EXISTS ${databaseName} WITH (FORCE)`);
    await control.end();
  }
  rmSync(dataDir, { recursive: true, force: true });
});

test("login, anonymous protection, CSRF, password hashing and session cookies", async () => {
  assert.equal((await request(app).get("/api/health")).status, 200);
  assert.equal((await request(app).get("/api/assets")).status, 401);
  assert.equal(
    (
      await request(app)
        .post("/api/login")
        .send({ username: "admin", password })
    ).status,
    403,
  );
  assert.equal(
    (
      await post(
        "/api/login",
        { username: "admin", password: "wrong" },
        request(app),
      )
    ).status,
    401,
  );
  assert.equal(
    (
      await admin
        .post("/api/employees")
        .set(header)
        .set("Origin", "https://foreign.example")
        .send({})
    ).status,
    403,
  );
  const login = await post(
    "/api/login",
    { username: "admin", password },
    request(app),
  );
  assert.match(login.headers["set-cookie"][0], /HttpOnly/);
  assert.match(login.headers["set-cookie"][0], /SameSite=Strict/);
  const account = await db
    .prepare("SELECT password_hash FROM accounts WHERE username='admin'")
    .get();
  assert.notEqual(account.password_hash, password);
  assert.ok(!JSON.stringify(login.body).includes("password_hash"));
});
test("existing in-use assets preserve different owner/user and unknown historical date", async () => {
  const a = await create({
    source: "existing",
    status: "in_use",
    user_id: user.id,
    code: "OLD-001",
  });
  assert.equal(a.owner_id, owner.id);
  assert.equal(a.user_id, user.id);
  assert.equal(a.usage_date, null);
  const detail = (await admin.get(`/api/assets/${a.id}`)).body;
  assert.equal(detail.events[0].details.historical_usage_date_unknown, true);
  assert.equal(detail.events[0].after.user_department, "产品部");
});
test("new assets require stock intake and identifiers are case-insensitive unique", async () => {
  await create({ code: "SN-CASE", serial: "SERIAL-CASE" });
  assert.equal(
    (await post("/api/assets", input({ code: "sn-case" }))).status,
    409,
  );
  assert.equal(
    (await post("/api/assets", input({ serial: "serial-case" }))).status,
    409,
  );
  assert.equal(
    (await post("/api/assets", input({ status: "in_use", user_id: user.id })))
      .status,
    422,
  );
  assert.equal(
    (
      await post(
        "/api/assets",
        input({ source: "existing", status: "available", user_id: user.id }),
      )
    ).status,
    422,
  );
  assert.equal(
    (await post("/api/assets", input({ source: "existing", status: "in_use" })))
      .status,
    422,
  );
  assert.equal(
    (await post("/api/assets", input({ purchase_amount: -1 }))).status,
    422,
  );
  assert.equal(
    (await post("/api/assets", input({ purchase_amount: 1.111 }))).status,
    422,
  );
  assert.equal(
    (await post("/api/assets", input({ entry_date: "2026-02-30" }))).status,
    422,
  );
});
test("assignment, transfer and return update users while preserving ownership and history", async () => {
  let a = await create();
  a = await act(a, "assign", { target_id: user.id });
  assert.equal(a.user_id, user.id);
  assert.equal(a.owner_id, owner.id);
  a = await act(a, "transfer", {
    target_id: other.id,
    effective_date: "2026-08-04",
  });
  assert.equal(a.user_id, other.id);
  assert.equal(a.owner_id, owner.id);
  a = await act(a, "return", { effective_date: "2026-08-05" });
  assert.equal(a.user_id, null);
  assert.equal(a.status, "available");
  assert.equal(a.owner_id, owner.id);
  const detail = (await admin.get(`/api/assets/${a.id}`)).body;
  assert.deepEqual(
    detail.events.map((e) => e.action),
    ["return", "transfer", "assign", "create"],
  );
  assert.equal(detail.events[1].before.user_name, "使用人乙");
  assert.equal(detail.events[1].after.user_name, "使用人丙");
});
test("ownership is a separate audited change that preserves the active user", async () => {
  let a = await create();
  a = await act(a, "assign", { target_id: user.id });
  assert.equal(
    (
      await post(
        `/api/assets/${a.id}/actions/ownership`,
        action(a, { target_id: other.id }),
      )
    ).status,
    422,
  );
  a = await act(a, "ownership", {
    target_id: other.id,
    notes: "部门资产责任调整",
  });
  assert.equal(a.owner_id, other.id);
  assert.equal(a.user_id, user.id);
  assert.equal(a.status, "in_use");
  const detail = (await admin.get(`/api/assets/${a.id}`)).body;
  assert.equal(detail.events[0].before.owner_id, owner.id);
  assert.equal(detail.events[0].after.owner_id, other.id);
});
test("pending handover reserves the asset, can cancel, and can confirm only once", async () => {
  let a = await create();
  a = await act(a, "assign", { target_id: user.id, pending: true });
  assert.equal(a.status, "pending");
  assert.equal(a.user_id, null);
  assert.equal(
    (
      await post(
        `/api/assets/${a.id}/actions/assign`,
        action(a, { target_id: other.id }),
      )
    ).status,
    409,
  );
  a = await act(a, "cancel");
  assert.equal(a.status, "available");
  a = await act(a, "assign", { target_id: user.id, pending: true });
  a = await act(a, "confirm");
  assert.equal(a.status, "in_use");
  assert.equal(a.user_id, user.id);
  assert.equal(
    (await post(`/api/assets/${a.id}/actions/confirm`, action(a))).status,
    409,
  );
  assert.equal(
    (
      await db
        .prepare(
          "SELECT count(*) AS n FROM handovers WHERE asset_id=? AND state='pending'",
        )
        .get(a.id)
    ).n,
    0,
  );
});
test("concurrent assignment commits one receiver and rejects the stale operation", async () => {
  const a = await create();
  const responses = await Promise.all([
    post(
      `/api/assets/${a.id}/actions/assign`,
      action(a, { target_id: user.id }),
    ),
    post(
      `/api/assets/${a.id}/actions/assign`,
      action(a, { target_id: other.id }),
    ),
  ]);
  assert.deepEqual(responses.map((r) => r.status).sort(), [200, 409]);
  const detail = (await admin.get(`/api/assets/${a.id}`)).body;
  assert.equal(detail.events.filter((e) => e.action === "assign").length, 1);
  assert.equal(detail.version, 2);
});
test("repair and retirement enforce the state machine", async () => {
  let a = await create();
  a = await act(a, "repair");
  assert.equal(
    (
      await post(
        `/api/assets/${a.id}/actions/assign`,
        action(a, { target_id: user.id }),
      )
    ).status,
    409,
  );
  a = await act(a, "restore");
  a = await act(a, "assign", { target_id: user.id });
  assert.equal(
    (
      await post(
        `/api/assets/${a.id}/actions/retire`,
        action(a, { notes: "报废" }),
      )
    ).status,
    409,
  );
  a = await act(a, "return", { needs_repair: true });
  assert.equal(a.status, "repair");
  a = await act(a, "retire", { notes: "主板损坏" });
  assert.equal(a.status, "retired");
  assert.equal(
    (
      await post(
        `/api/assets/${a.id}/actions/assign`,
        action(a, { target_id: user.id }),
      )
    ).status,
    409,
  );
  assert.equal(
    (await admin.delete(`/api/assets/${a.id}`).set(header)).status,
    404,
  );
});
test("departure prevents new allocations and historical department snapshots remain intact", async () => {
  let a = await create();
  assert.equal(
    (
      await post(
        `/api/assets/${a.id}/actions/assign`,
        action(a, { target_id: departed.id }),
      )
    ).status,
    422,
  );
  const temp = (
    await post("/api/employees", {
      code: "E005",
      name: "调动员工",
      department: "原部门",
    })
  ).body;
  a = await act(a, "assign", { target_id: temp.id });
  assert.equal(
    (
      await put(`/api/employees/${temp.id}`, {
        code: "E005",
        name: "调动员工",
        department: "新部门",
        status: "departed",
      })
    ).status,
    200,
  );
  const detail = (await admin.get(`/api/assets/${a.id}`)).body;
  assert.equal(detail.user_department, "新部门");
  assert.equal(detail.events[0].after.user_department, "原部门");
  assert.ok(
    (await admin.get("/api/assets?departed=1")).body.items.some(
      (x) => x.id === a.id,
    ),
  );
  assert.ok((await admin.get("/api/stats")).body.warnings.departed_users >= 1);
});
test("metadata corrections preserve relationships and reject stale edits", async () => {
  const a = await create({ purchase_amount: 1234.56 });
  const body = input({
    code: a.code,
    name: "更新后的名称",
    version: a.version,
    purchase_amount: 1234.56,
  });
  delete body.owner_id;
  const changed = await put(`/api/assets/${a.id}`, body);
  assert.equal(changed.status, 200, JSON.stringify(changed.body));
  assert.equal(changed.body.purchase_amount, 1234.56);
  assert.equal(changed.body.owner_id, owner.id);
  assert.equal((await put(`/api/assets/${a.id}`, body)).status, 409);
  assert.equal(
    (
      await put(`/api/assets/${a.id}`, {
        ...body,
        version: 2,
        owner_id: user.id,
      })
    ).status,
    422,
  );
});
test("CSV validation reports rows, rolls back invalid batches, and supports historical users", async () => {
  const headers =
    "资产编号,设备名称,归属人工号,使用人工号,来源,状态,入库日期,采购金额\n";
  const invalid =
    headers +
    "IMP-1,存量电脑,E001,E002,存量登记,使用中,2026-01-01,2999.99\nIMP-2,坏数据,UNKNOWN,,存量登记,待分配,2026-01-01,1";
  const failed = await admin
    .post("/api/assets/import")
    .set(header)
    .type("text/csv")
    .send(invalid);
  assert.equal(failed.status, 422);
  assert.equal(failed.body.details[0].row, 3);
  assert.equal((await admin.get("/api/assets?q=IMP-1")).body.total, 0);
  const valid =
    headers +
    "IMP-1,存量电脑,E001,E002,存量登记,使用中,2026-01-01,2999.99\nIMP-2,库存电脑,E001,,存量登记,待分配,2026-01-01,1";
  assert.equal(
    (
      await admin
        .post("/api/assets/import?dry_run=1")
        .set(header)
        .type("text/csv")
        .send(valid)
    ).body.count,
    2,
  );
  assert.equal((await admin.get("/api/assets?q=IMP-1")).body.total, 0);
  const done = await admin
    .post("/api/assets/import")
    .set(header)
    .type("text/csv")
    .send(valid);
  assert.equal(done.status, 200, JSON.stringify(done.body));
  assert.equal(done.body.assets.length, 2);
  assert.equal(done.body.assets[0].user_id, user.id);
  assert.equal(done.body.assets[0].usage_date, null);
  assert.equal(
    (
      await admin
        .post("/api/assets/import")
        .set(header)
        .type("text/csv")
        .send(valid)
    ).status,
    422,
  );
  const repeated =
    headers +
    "IMP-X,重复,E001,,存量登记,待分配,2026-01-01,1\nimp-x,重复,E001,,存量登记,待分配,2026-01-01,1";
  assert.equal(
    (
      await admin
        .post("/api/assets/import")
        .set(header)
        .type("text/csv")
        .send(repeated)
    ).status,
    422,
  );
});
test("filtered export includes independent owner and user and prevents spreadsheet formulas", async () => {
  const a = await create({
    name: "=SUM(1,2)",
    source: "existing",
    status: "in_use",
    user_id: user.id,
  });
  const exported = await admin.get(
    `/api/assets/export?owner_id=${owner.id}&q=${encodeURIComponent(a.code)}`,
  );
  assert.equal(exported.status, 200);
  assert.match(exported.text, /归属人工号/);
  assert.match(exported.text, /使用人工号/);
  assert.match(exported.text, /E001,E002/);
  assert.match(exported.text, /'=SUM/);
  assert.equal(
    (await admin.get(`/api/assets?user_id=${user.id}`)).body.items.every(
      (x) => x.user_id === user.id,
    ),
    true,
  );
});
test("viewer can inspect and export but cannot mutate records or access accounts", async () => {
  const created = await post("/api/accounts", {
    username: "viewer",
    name: "审计账号",
    role: "viewer",
    password,
  });
  assert.equal(created.status, 201);
  const viewer = request.agent(app);
  assert.equal(
    (await post("/api/login", { username: "viewer", password }, viewer)).status,
    200,
  );
  assert.equal((await viewer.get("/api/assets")).status, 200);
  assert.equal((await viewer.get("/api/events")).status, 200);
  assert.equal((await viewer.get("/api/assets/export")).status, 200);
  assert.equal((await viewer.get("/api/accounts")).status, 403);
  assert.equal((await post("/api/assets", input(), viewer)).status, 403);
  assert.equal(
    (
      await post(
        "/api/employees",
        { code: "NO", name: "NO", department: "NO" },
        viewer,
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await put(`/api/accounts/${created.body.id}`, {
        name: "审计账号",
        role: "viewer",
        active: false,
      })
    ).status,
    200,
  );
  assert.equal((await viewer.get("/api/me")).status, 401);
});
test("attachments are authorized, tied to assets, validated and downloadable", async () => {
  const a = await create();
  const pdf = Buffer.from("%PDF-1.4\n%%EOF");
  const bad = await admin
    .post(`/api/assets/${a.id}/attachments`)
    .set(header)
    .attach("file", Buffer.from("not-pdf"), {
      filename: "bad.pdf",
      contentType: "application/pdf",
    });
  assert.equal(bad.status, 422);
  const uploaded = await admin
    .post(`/api/assets/${a.id}/attachments`)
    .set(header)
    .attach("file", pdf, {
      filename: "receipt.pdf",
      contentType: "application/pdf",
    });
  assert.equal(uploaded.status, 201, JSON.stringify(uploaded.body));
  assert.equal(
    (await request(app).get(`/api/attachments/${uploaded.body.id}`)).status,
    401,
  );
  const download = await admin.get(`/api/attachments/${uploaded.body.id}`);
  assert.equal(download.status, 200);
  assert.equal(download.body.toString(), pdf.toString());
  assert.equal(
    (await admin.get(`/api/assets/${a.id}`)).body.attachments.length,
    1,
  );
});
test("business dates cannot go backwards and historic departed holders can be recorded", async () => {
  let a = await create({
    source: "existing",
    status: "in_use",
    user_id: departed.id,
    usage_date: "2026-08-06",
  });
  assert.equal(
    (
      await post(
        `/api/assets/${a.id}/actions/return`,
        action(a, { effective_date: "2026-08-05" }),
      )
    ).status,
    422,
  );
  a = await act(a, "return", { effective_date: "2026-08-07" });
  assert.equal(a.user_id, null);
  assert.equal(
    (
      await post(
        `/api/assets/${a.id}/actions/assign`,
        action(a, { target_id: user.id, effective_date: "2099-01-01" }),
      )
    ).status,
    422,
  );
});
test("log categories group multiple actions and keep filtering, counts and pagination consistent", async () => {
  let asset = await create({ code: "LOG-CATEGORIES" });
  asset = await act(asset, "repair");
  asset = await act(asset, "restore");
  asset = await act(asset, "assign", { target_id: user.id });
  const device = await admin.get("/api/events?category=device&pageSize=100");
  assert.equal(device.status, 200);
  const deviceActions = device.body.items
    .filter((e) => e.asset_id === asset.id)
    .map((e) => e.action);
  assert.deepEqual(deviceActions, ["restore", "repair", "create"]);
  assert.ok(
    device.body.items.every(
      (e) =>
        !["assign", "transfer", "login", "employee_create"].includes(e.action),
    ),
  );
  assert.equal(device.body.counts.device, device.body.total);
  const handover = await admin.get(
    "/api/events?category=handover&pageSize=100",
  );
  assert.equal(handover.status, 200);
  assert.deepEqual(
    handover.body.items
      .filter((e) => e.asset_id === asset.id)
      .map((e) => e.action),
    ["assign"],
  );
  assert.equal(handover.body.counts.handover, handover.body.total);
  const people = await admin.get("/api/events?category=people&pageSize=100");
  assert.ok(people.body.total >= 4);
  assert.ok(
    people.body.items.every((e) =>
      ["employee_create", "employee_edit"].includes(e.action),
    ),
  );
  const account = await admin.get("/api/events?category=account&pageSize=100");
  assert.ok(account.body.items.some((e) => e.action === "login"));
  assert.ok(
    account.body.items.every((e) =>
      [
        "account_create",
        "account_edit",
        "login",
        "logout",
        "password",
      ].includes(e.action),
    ),
  );
  const first = (
    await admin.get("/api/events?category=device&pageSize=2&page=1")
  ).body;
  const second = (
    await admin.get("/api/events?category=device&pageSize=2&page=2")
  ).body;
  assert.equal(first.items.length, 2);
  assert.equal(second.items.length, 2);
  assert.ok(second.items.every((e) => !first.items.some((x) => x.id === e.id)));
  assert.equal(first.total, second.total);
  assert.deepEqual(first.counts, second.counts);
  assert.equal(
    (await admin.get("/api/events?category=device&action=login")).body.total,
    0,
  );
  assert.equal((await admin.get("/api/events?category=invalid")).status, 422);
});

test("saved data remains after a new backend instance opens the database", async () => {
  const a = await create({ code: "PERSISTENCE" });
  const url = new URL(process.env.DATABASE_URL);
  url.pathname = "/" + databaseName;
  const next = await createApp({
    databaseUrl: url.toString(),
    dataDir,
    testMode: true,
  });
  try {
    const session = request.agent(next.app);
    assert.equal(
      (await post("/api/login", { username: "admin", password }, session))
        .status,
      200,
    );
    const saved = (await session.get(`/api/assets/${a.id}`)).body;
    assert.equal(saved.code, "PERSISTENCE");
    assert.equal(saved.owner_id, owner.id);
  } finally {
    await next.db.close();
  }
});
