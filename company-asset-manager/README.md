# 公司资产管理

React 前端、Node.js / Express 服务端、PostgreSQL 18 数据库。所有代码、数据库初始化定义、测试和部署文件保存在本项目内。

## 业务范围

- 资产台账：新增入库、已有闲置及在用资产登记、档案修正、搜索、人员和部门筛选、分页。
- 资产归属人与当前使用人独立关联员工。分配、转交、归还只改变使用关系；归属变更需单独提交并记录原因。
- 待交接锁定、确认与取消、直接分配、转交、归还、归还送修、维修完成、报废。
- 员工及部门、离职标记、离职员工未归还查询、人员名下归属资产和使用设备查询。
- CSV 模板、整批校验与导入、逐行错误提示、按当前筛选导出。每批最多 500 条；历史领用日期允许未知。
- PDF / PNG / JPG 附件上传、授权下载、资产流转时间线、字段变更前后对比。
- 管理员及只读账号、密码修改、账号停用、角色权限及操作日志。
- 日志按设备信息、领用交接、人员变更、账号安全四个 Tab 分类，默认设备信息，每类聚合多种操作。
- 台账右侧固定的“查看详情”按钮打开右侧抽屉，手机端横向滚动表格时仍可直接操作。
- 资产状态统计、按归属部门统计、采购金额及保修和离职提醒。

第一版由管理员统一办理并确认交接；使用人是员工档案中的业务人员，员工不必拥有登录账号。

## 本地运行

需要 Node.js 24+ 和已启动的 Docker Desktop。

```bash
npm ci
# 仅首次运行；已有 .env 时不要重复初始化
node scripts/init-local.mjs
docker compose -f compose.local.yml up -d --wait
npm run build
npm start
```

本地入口：<http://127.0.0.1:4318>。前端构建由同一 Node.js 服务提供，API 位于 `/api`。

初始管理员凭据保存在 `data/local-login.txt`；数据库凭据位于 `.env`，两个文件均以 600 权限保存并被 Git 忽略。后台日志为 `data/server.log`。

PostgreSQL 单独运行于 `asset-manager-db-1` 容器，仅绑定本机 `127.0.0.1:5448`，数据库名 `assets`、用户 `assets`。数据库内容持久保存在 Docker 卷 `asset-manager_asset-postgres-local`；附件位于 `data/uploads/`。

修改前端时可另开开发服务：

```bash
npm run dev
```

开发入口为 <http://127.0.0.1:5178>，自动代理到本地后端 4318。

停止本项目后端：`node scripts/stop-local.mjs`。停止数据库：`docker compose -f compose.local.yml stop`。停止或重启均不删除数据卷。

## 代码位置

| 路径                                              | 内容                                          |
| ------------------------------------------------- | --------------------------------------------- |
| `src/main.jsx`、`src/style.css`                   | 前端页面、表单、详情与响应式样式              |
| `src/api.js`                                      | 浏览器请求和登录失效处理                      |
| `server/app.mjs`                                  | API 路由、权限、附件和统计                    |
| `server/domain.mjs`                               | 校验、人员关系、状态流转和快照                |
| `server/database.mjs`                             | PostgreSQL 表结构、索引、约束、事务和连接池   |
| `db/schema.sql`                                   | 从本地实际数据库导出的 SQL 结构，不含业务数据 |
| `server/auth.mjs`                                 | 密码哈希、会话、登录限制及来源校验            |
| `server/import-export.mjs`                        | CSV 解析、校验、导入及导出                    |
| `tests/api.test.mjs`                              | 真实 PostgreSQL 上的接口与事务测试            |
| `scripts/browser-check.mjs`                       | Playwright 浏览器用户交互验收                 |
| `compose.local.yml`                               | 本地独立 SQL 服务                             |
| `Dockerfile`、`compose.production.yml`、`deploy/` | 腾讯云部署及备份                              |

## 自测

```bash
npm test
npm run build
npm audit --omit=dev
```

接口测试创建独立临时数据库，结束后只删除该测试数据库，避免修改开发业务数据。17 个测试覆盖权限、状态机、归属与使用分离、并发争用、历史快照、导入回滚、附件、日志分组和分页、重启后持久化。

浏览器验收使用真实表单、点击、文件选择和下载，不使用 API 请求代替用户操作。需要安装 `playwright-cli`。在空业务数据库上按以下顺序执行，测试数据带有 `UAT-` / `验收` 标记；不要对已有同名验收数据重复执行创建步骤。

```bash
playwright-cli -s=assets-local open http://127.0.0.1:4318 --headed
node scripts/browser-check.mjs local login
node scripts/browser-check.mjs local employees
node scripts/browser-check.mjs local assets
node scripts/browser-check.mjs local handovers
node scripts/browser-check.mjs local importAttachments
node scripts/browser-check.mjs local accounts
node scripts/browser-check.mjs local advanced
node scripts/browser-check.mjs local mobile
```

截图和下载文件位于 `output/playwright/local/`；云端首次验收位于 `output/playwright/cloud/`，公网直连验收位于 `output/playwright/public/`。公网验收使用 `assets-public` 浏览器会话，将命令中的 `local` 替换为 `public`，入口改为 `https://124.221.244.227/asset-manager/`。预期的错误用例包括未登录、重复序列号和无效导入；这些请求返回 401 / 409 / 422，不代表测试失败。

## 腾讯云部署

服务器：`ubuntu@124.221.244.227`，项目目录：`/home/ubuntu/company-assets`。应用仅监听服务器回环地址 4318，PostgreSQL 不发布公网端口，Caddy 转发 `/asset-manager/`。原有根路径服务仍使用 8080。

```bash
npm run build:cloud
# 上传项目及 dist-cloud，单独放置生产 .env 后，在服务器执行
docker compose -f compose.production.yml build
docker compose -f compose.production.yml -f compose.certificates.yml up -d --wait
```

生产凭据保存在本地 `deploy/production-login.local.txt` 和 `deploy/production.local.env`。生产环境使用独立密码和独立数据库，不复制本地业务数据。

### 当前访问状态

正式入口：<https://tencent.geneecho.top/asset-manager/>。备用 IP 入口：<https://124.221.244.227/asset-manager/>。两者均使用有效 HTTPS 证书，普通浏览器可以直接访问，无需 SSH 或忽略证书警告。

可运行 `bash deploy/open-cloud.command` 在默认浏览器中打开正式入口。域名通过 Cloudflare 代理访问，A 记录仍指向 `124.221.244.227`。源服务器规则 `Tencent HTTPS origin 8443` 仅将该域名的 HTTPS 请求转发到 8443；重定向规则 `Tencent HTTP to HTTPS` 将 HTTP 301 跳转到 HTTPS 并保留查询参数。腾讯云已放行 TCP 8443；Caddy 在此端口使用 HTTPS / HTTP/1.1 回源，避免原 443 链路握手重置及回源连接不稳定。

Cloudflare 的既有 Full 加密模式保持不变，浏览器到边缘、边缘到源站均使用 TLS。其他 DNS 记录未修改。原域名根路径仍是 Web Test Agent；资产管理入口包含 `/asset-manager/`。部署配置摘要见 `deploy/domain-routing.json`。

原 Caddy 配置备份为 `/etc/caddy/Caddyfile.before-company-assets-20260912T053430Z`。`deploy/install-proxy.sh` 是本次首次安装脚本，使用原配置哈希保护，后续修改代理应先重新检查服务器当前配置。

### IP 证书续期

`compose.certificates.yml` 中的 Caddy 2.10.2 容器仅监听服务器回环地址，负责通过 Let’s Encrypt `shortlived` profile 自动申请并续期 IP 证书。HTTP 80 上仅 `/.well-known/acme-challenge/` 转发到其临时验证端口 8088；不要关闭 80，否则后续证书续期无法完成。私钥与 ACME 账号保存在服务器项目的 `certificates/`，不包含在源码包内。

系统定时器 `company-assets-certificate.timer` 每五分钟运行同步服务。`deploy/sync-ip-certificate.sh` 校验 IP、有效期、证书链及密钥匹配后，原子切换 `/etc/caddy/company-assets-tls/current` 并强制重新加载 Caddy；失败时保留或恢复旧证书。部署时已执行同步及加载验证。

```bash
# 服务器上的维护检查
systemctl status company-assets-certificate.timer
systemctl show company-assets-certificate.service -p Result -p ExecMainStatus
docker compose -f compose.production.yml -f compose.certificates.yml logs --tail 30 certificates
curl --fail https://124.221.244.227/asset-manager/api/health
```

新机器首次部署时，先设置 `deploy/Caddyfile` 中的 HTTP 验证路由并启动证书容器，证书签发后执行 `sudo bash deploy/sync-ip-certificate.sh --stage-only`，再加载完整代理配置。将同步脚本以 root 所有者安装到 `/usr/local/sbin/company-assets-sync-certificate`，将 `deploy/company-assets-certificate.service` 和 `.timer` 安装到 `/etc/systemd/system/` 并启用 timer。已有机器更新配置使用 `deploy/apply-proxy.sh`，参数为刚检查的当前 Caddyfile SHA-256。

域名证书由宿主机 Caddy 自动管理。Cloudflare 回源端口规则必须仅匹配 HTTPS，保留 HTTP 80 的 ACME 验证路径。

前端部署前缀必须与 `BASE_PATH` 一致。允许的浏览器来源由 `APP_ORIGIN` 指定。生产启用 Secure / HttpOnly / SameSite=Strict 会话 Cookie；会话有效期 8 小时，修改密码或停用账号会撤销既有会话。

## 备份

本地执行 `npm run backup`，服务器执行 `bash deploy/backup.sh`，生成 PostgreSQL 自包含备份及附件压缩包，并校验数据库备份目录。输出位于 `backups/时间戳/`，文件权限仅限当前用户。

恢复前应停止应用，保留当前数据库副本，再用 PostgreSQL 18 的 `pg_restore` 将 `assets.dump` 恢复到新建数据库，并还原对应的 `uploads.tar.gz`。将 `DATABASE_URL` 切到新库后再启动应用，避免覆盖现有数据。
