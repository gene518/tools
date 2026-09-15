import { createApp } from "./app.mjs";
import express from "express";
const port = Number(process.env.PORT || 4318);
const { app, db } = await createApp({
  dataDir: process.env.DATA_DIR,
  distDir: process.env.DIST_DIR,
  databaseUrl: process.env.DATABASE_URL,
  basePath: process.env.BASE_PATH || "/",
  adminUsername: process.env.ADMIN_USERNAME,
  adminPassword: process.env.ADMIN_PASSWORD,
  secureCookie: process.env.COOKIE_SECURE === "true",
  appOrigin: process.env.APP_ORIGIN,
  trustProxy: process.env.TRUST_PROXY === "true",
});
const root = express();
root.disable("x-powered-by");
root.use(process.env.BASE_PATH || "/", app);
const server = root.listen(port, process.env.HOST || "127.0.0.1", () =>
  console.log(`Asset manager listening on port ${port}`),
);
function shutdown() {
  server.close(async () => {
    await db.close();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10000).unref();
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
