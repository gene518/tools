import { existsSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
const file = "deploy/production.local.env";
if (existsSync(file))
  throw new Error("Production settings already exist; no changes made");
const password = randomBytes(24).toString("base64url");
const admin = randomBytes(18).toString("base64url");
writeFileSync(
  file,
  `POSTGRES_PASSWORD=${password}\nADMIN_USERNAME=admin\nADMIN_PASSWORD=${admin}\n`,
  { mode: 0o600 },
);
writeFileSync(
  "deploy/production-login.local.txt",
  `腾讯云地址：https://tencent.geneecho.top/asset-manager/\n账号：admin\n密码：${admin}\n`,
  { mode: 0o600 },
);
console.log(
  "Production credentials created in deploy/production-login.local.txt",
);
