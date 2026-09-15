import { unlink } from "node:fs/promises";
import { join } from "node:path";
import { openDatabase, transaction } from "../server/database.mjs";
const db = openDatabase(process.env.DATABASE_URL);
try {
  const files = await transaction(db, async () => {
    const assets = await db
      .prepare("SELECT id,code,name FROM assets ORDER BY code FOR UPDATE")
      .all();
    const employees = await db
      .prepare("SELECT id,code,name FROM employees ORDER BY code FOR UPDATE")
      .all();
    const expectedAssets = [
      "UAT-IMP001",
      "UAT-IMP002",
      "UAT-PC001",
      "UAT-PC002",
    ];
    const expectedEmployees = ["UAT-E001", "UAT-E002", "UAT-E003"];
    if (
      JSON.stringify(assets.map((a) => a.code)) !==
        JSON.stringify(expectedAssets) ||
      assets.some((a) => !a.name.startsWith("验收")) ||
      JSON.stringify(employees.map((e) => e.code)) !==
        JSON.stringify(expectedEmployees) ||
      employees.some((e) => !e.name.startsWith("验收"))
    )
      throw new Error(
        "Data differs from the exact UAT fixture; cleanup refused",
      );
    const accounts = await db.prepare("SELECT id,username FROM accounts").all();
    if (accounts.some((a) => !["admin", "uat-viewer"].includes(a.username)))
      throw new Error("Additional accounts detected; cleanup refused");
    const assetIds = assets.map((a) => a.id),
      employeeIds = employees.map((e) => e.id);
    const files = await db
      .prepare(
        "SELECT stored_name FROM attachments WHERE asset_id=ANY(?::integer[])",
      )
      .all(assetIds);
    await db
      .prepare("DELETE FROM attachments WHERE asset_id=ANY(?::integer[])")
      .run(assetIds);
    await db
      .prepare("DELETE FROM handovers WHERE asset_id=ANY(?::integer[])")
      .run(assetIds);
    await db
      .prepare(
        "DELETE FROM events WHERE asset_id=ANY(?::integer[]) OR entity=ANY(?::text[]) OR actor_id IN (SELECT id FROM accounts WHERE username='uat-viewer') OR entity IN (SELECT 'account:' || id::text FROM accounts WHERE username='uat-viewer')",
      )
      .run(
        assetIds,
        employeeIds.map((i) => `employee:${i}`),
      );
    await db
      .prepare("DELETE FROM assets WHERE id=ANY(?::integer[])")
      .run(assetIds);
    await db
      .prepare("DELETE FROM employees WHERE id=ANY(?::integer[])")
      .run(employeeIds);
    await db
      .prepare(
        "DELETE FROM sessions WHERE account_id IN (SELECT id FROM accounts WHERE username='uat-viewer')",
      )
      .run();
    await db.prepare("DELETE FROM accounts WHERE username='uat-viewer'").run();
    return files;
  });
  for (const file of files)
    await unlink(
      join(process.env.DATA_DIR || "./data", "uploads", file.stored_name),
    );
  console.log(
    "Removed exactly 4 UAT assets, 3 UAT employees, the UAT viewer, and related test records. Admin retained.",
  );
} finally {
  await db.close();
}
