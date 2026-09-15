import { spawn } from "node:child_process";
import { mkdirSync, openSync, writeFileSync } from "node:fs";
import { setTimeout } from "node:timers/promises";
process.loadEnvFile(".env");
const url = `http://${process.env.HOST || "127.0.0.1"}:${process.env.PORT || 4318}`;
try {
  const response = await fetch(`${url}/api/health`);
  if (response.ok) {
    console.log(`Already running: ${url}`);
    process.exit(0);
  }
} catch {}
mkdirSync("data", { recursive: true, mode: 0o700 });
const log = openSync("data/server.log", "a", 0o600);
const child = spawn(process.execPath, ["--env-file=.env", "server/index.mjs"], {
  cwd: process.cwd(),
  detached: true,
  stdio: ["ignore", log, log],
  env: process.env,
});
child.unref();
writeFileSync("data/server.pid", String(child.pid), { mode: 0o600 });
for (let i = 0; i < 40; i++) {
  await setTimeout(250);
  try {
    const response = await fetch(`${url}/api/health`);
    if (response.ok) {
      console.log(`Running: ${url}`);
      process.exit(0);
    }
  } catch {}
}
throw new Error("Startup failed; check data/server.log");
