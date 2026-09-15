import pg from "pg";
import { AsyncLocalStorage } from "node:async_hooks";
pg.types.setTypeParser(20, (value) => Number(value));
const timestamp = `to_char(clock_timestamp() AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')`;

export function openDatabase(connectionString) {
  if (!connectionString) throw new Error("DATABASE_URL is required");
  const pool = new pg.Pool({
    connectionString,
    max: 10,
    connectionTimeoutMillis: 10000,
  });
  const context = new AsyncLocalStorage();
  const db = {
    pool,
    inTransaction: () => Boolean(context.getStore()),
    async query(sql, values = []) {
      return (context.getStore() || pool).query(sql, values);
    },
    prepare(sql) {
      let n = 0;
      const query = sql
        .replace(/\?/g, () => `$${++n}`)
        .replaceAll("strftime('%Y-%m-%dT%H:%M:%fZ','now')", timestamp)
        .replaceAll(
          "date('now','+30 days')",
          "to_char(CURRENT_DATE + 30, 'YYYY-MM-DD')",
        )
        .replaceAll("date('now')", "to_char(CURRENT_DATE, 'YYYY-MM-DD')");
      return {
        async all(...values) {
          return (await db.query(query, values)).rows;
        },
        async get(...values) {
          return (await db.query(query, values)).rows[0];
        },
        async run(...values) {
          const returning =
            /^INSERT INTO (employees|accounts|assets|handovers|events|attachments)\b/i.test(
              query,
            );
          const result = await db.query(
            query + (returning ? " RETURNING id" : ""),
            values,
          );
          return {
            lastInsertRowid: result.rows[0]?.id,
            changes: result.rowCount,
          };
        },
      };
    },
    async initialize() {
      await db.query(`CREATE EXTENSION IF NOT EXISTS citext;
        CREATE TABLE IF NOT EXISTS employees (
          id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY, code CITEXT NOT NULL UNIQUE, name TEXT NOT NULL,
          department TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','departed')),
          created_at TEXT NOT NULL DEFAULT (${timestamp})
        );
        CREATE TABLE IF NOT EXISTS accounts (
          id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY, username CITEXT NOT NULL UNIQUE, name TEXT NOT NULL,
          password_hash TEXT NOT NULL, role TEXT NOT NULL CHECK(role IN ('admin','viewer')), active INTEGER NOT NULL DEFAULT 1,
          created_at TEXT NOT NULL DEFAULT (${timestamp})
        );
        CREATE TABLE IF NOT EXISTS sessions (
          token_hash TEXT PRIMARY KEY, account_id INTEGER NOT NULL REFERENCES accounts(id), expires_at BIGINT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS assets (
          id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY, code CITEXT NOT NULL UNIQUE, name TEXT NOT NULL,
          category TEXT NOT NULL DEFAULT '笔记本电脑', brand TEXT NOT NULL DEFAULT '', model TEXT NOT NULL DEFAULT '',
          serial CITEXT UNIQUE, cpu TEXT NOT NULL DEFAULT '', memory TEXT NOT NULL DEFAULT '', disk TEXT NOT NULL DEFAULT '',
          source TEXT NOT NULL CHECK(source IN ('existing','new')), entry_date TEXT NOT NULL,
          purchase_date TEXT, purchase_amount BIGINT, warranty_date TEXT,
          owner_id INTEGER NOT NULL REFERENCES employees(id), user_id INTEGER REFERENCES employees(id),
          status TEXT NOT NULL CHECK(status IN ('available','pending','in_use','repair','retired')),
          location TEXT NOT NULL DEFAULT '', condition TEXT NOT NULL DEFAULT '完好', accessories TEXT NOT NULL DEFAULT '',
          notes TEXT NOT NULL DEFAULT '', usage_date TEXT, version INTEGER NOT NULL DEFAULT 1,
          created_at TEXT NOT NULL DEFAULT (${timestamp}), updated_at TEXT NOT NULL DEFAULT (${timestamp}),
          CHECK((status='in_use' AND user_id IS NOT NULL) OR (status<>'in_use' AND user_id IS NULL)),
          CHECK(purchase_amount IS NULL OR purchase_amount >= 0)
        );
        CREATE TABLE IF NOT EXISTS handovers (
          id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY, asset_id INTEGER NOT NULL REFERENCES assets(id),
          target_id INTEGER NOT NULL REFERENCES employees(id), target_snapshot TEXT NOT NULL,
          state TEXT NOT NULL CHECK(state IN ('pending','confirmed','cancelled')),
          effective_date TEXT NOT NULL, location TEXT NOT NULL, condition TEXT NOT NULL, accessories TEXT NOT NULL,
          notes TEXT NOT NULL DEFAULT '', created_by INTEGER NOT NULL REFERENCES accounts(id),
          created_at TEXT NOT NULL DEFAULT (${timestamp}), completed_at TEXT
        );
        CREATE UNIQUE INDEX IF NOT EXISTS one_pending_handover ON handovers(asset_id) WHERE state='pending';
        CREATE TABLE IF NOT EXISTS events (
          id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY, asset_id INTEGER REFERENCES assets(id), entity TEXT NOT NULL, action TEXT NOT NULL,
          actor_id INTEGER NOT NULL REFERENCES accounts(id), actor_name TEXT NOT NULL, effective_date TEXT,
          before_json TEXT, after_json TEXT, details_json TEXT NOT NULL DEFAULT '{}',
          created_at TEXT NOT NULL DEFAULT (${timestamp})
        );
        CREATE INDEX IF NOT EXISTS events_asset ON events(asset_id,id);
        CREATE INDEX IF NOT EXISTS assets_owner ON assets(owner_id);
        CREATE INDEX IF NOT EXISTS assets_user ON assets(user_id);
        CREATE TABLE IF NOT EXISTS attachments (
          id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY, asset_id INTEGER NOT NULL REFERENCES assets(id), event_id INTEGER REFERENCES events(id),
          original_name TEXT NOT NULL, stored_name TEXT NOT NULL UNIQUE, mime TEXT NOT NULL, size INTEGER NOT NULL,
          actor_id INTEGER NOT NULL REFERENCES accounts(id), created_at TEXT NOT NULL DEFAULT (${timestamp})
        );
        CREATE TABLE IF NOT EXISTS schema_versions (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL DEFAULT (${timestamp}));
        INSERT INTO schema_versions(version) VALUES(1) ON CONFLICT DO NOTHING;
      `);
    },
    async transaction(fn) {
      if (context.getStore())
        throw new Error("Nested transactions are not supported");
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const result = await context.run(client, fn);
        await client.query("COMMIT");
        return result;
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    },
    async close() {
      await pool.end();
    },
  };
  return db;
}
export function transaction(db, fn) {
  return db.transaction(fn);
}
