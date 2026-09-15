import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { setTimeout } from "node:timers/promises";
const pid = Number(readFileSync("data/server.pid", "utf8"));
const command = execFileSync("ps", ["-p", String(pid), "-o", "command="], {
  encoding: "utf8",
});
if (!command.includes("server/index.mjs"))
  throw new Error("PID no longer belongs to this service");
process.kill(pid, "SIGTERM");
for (let i = 0; i < 40; i++) {
  try {
    process.kill(pid, 0);
    await setTimeout(250);
  } catch {
    console.log("Local backend stopped");
    process.exit(0);
  }
}
throw new Error("Backend has not stopped yet");
