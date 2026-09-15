# 源码结构

这是公司电脑及办公设备资产管理系统的完整源码。资产归属人和当前使用人是独立关系：分配、转交、归还仅改变使用人；归属变更需单独记录原因和操作日志。

## 运行组成

| 模块       | 路径                                                                          | 作用                                                                 |
| ---------- | ----------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| 前端       | `src/`                                                                        | React 管理界面：台账、右侧资产详情、员工、统计、账号和日志分类 Tab。 |
| API        | `server/`                                                                     | Express API、会话权限、资产状态流转、CSV、附件和统计。               |
| 数据库     | `server/database.mjs`、`db/schema.sql`                                        | PostgreSQL 18 表结构、约束、索引与事务。                             |
| 业务定义   | `server/domain.mjs`、`shared/event-categories.mjs`                            | 资产规则、人员关系、日志大类和字段校验。                             |
| 自动测试   | `tests/`、`scripts/browser-check.mjs`                                         | 17 项真实数据库测试与浏览器用户交互验收。                            |
| 本地部署   | `compose.local.yml`、`scripts/init-local.mjs`                                 | 独立 PostgreSQL 服务和本地运行初始化。                               |
| 腾讯云部署 | `Dockerfile`、`compose.production.yml`、`compose.certificates.yml`、`deploy/` | 应用、数据库、证书续期、备份及域名回源配置。                         |

## 本地启动

```bash
npm ci
node scripts/init-local.mjs
docker compose -f compose.local.yml up -d --wait
npm run build
npm start
```

访问 `http://127.0.0.1:4318`。初始化生成的账号和数据库密码只保存到本机被忽略的文件中，不会出现在本源码目录。

## 校验命令

```bash
npm test
npm run build
npm audit --omit=dev
```

详细运维、域名、证书与恢复流程参见 `README.md`；完整测试证据参见 `TEST_REPORT.md`。
