import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
const schema = execFileSync(
  "docker",
  [
    "compose",
    "-f",
    "compose.local.yml",
    "exec",
    "-T",
    "db",
    "pg_dump",
    "-U",
    "assets",
    "-d",
    "assets",
    "--schema-only",
    "--no-owner",
    "--no-privileges",
  ],
  { encoding: "utf8" },
);
mkdirSync("db", { recursive: true });
writeFileSync("db/schema.sql", schema);
console.log(
  "Exported PostgreSQL structure to db/schema.sql (no business data)",
);
