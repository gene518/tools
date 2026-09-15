import { existsSync, writeFileSync, mkdirSync } from "node:fs";
import { randomBytes } from "node:crypto";
if (existsSync(".env")) throw new Error(".env already exists; no changes made");
const databasePassword = randomBytes(24).toString("base64url");
const adminPassword = randomBytes(18).toString("base64url");
writeFileSync(
  ".env",
  `PORT=4318\nHOST=127.0.0.1\nDATA_DIR=./data\nDATABASE_URL=postgresql://assets:${databasePassword}@127.0.0.1:5448/assets\nPOSTGRES_PASSWORD=${databasePassword}\nADMIN_USERNAME=admin\nADMIN_PASSWORD=${adminPassword}\nCOOKIE_SECURE=false\nAPP_ORIGIN=http://127.0.0.1:4318,http://127.0.0.1:5178\n`,
  { mode: 0o600 },
);
mkdirSync("data", { recursive: true, mode: 0o700 });
writeFileSync(
  "data/local-login.txt",
  `本地地址：http://127.0.0.1:4318\n账号：admin\n密码：${adminPassword}\n`,
  { mode: 0o600 },
);
console.log("Created .env and data/local-login.txt");
