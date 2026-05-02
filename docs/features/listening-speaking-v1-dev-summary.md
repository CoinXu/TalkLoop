# Dev 交付说明 listening-speaking-v1

## 新增文件
- `services/api/package.json`
- `services/api/package-lock.json`
- `services/api/tsconfig.json`
- `services/api/drizzle.config.ts`
- `services/api/src/**`
- `migrations/0001_listening_speaking_v1.sql`
- `docs/features/listening-speaking-v1-dev-test-report.md`
- `docs/features/listening-speaking-v1-api-handoff.md`

## 修改文件
- `.codex/tech-stack/be.md`
- `.codex/task/listening-speaking-v1.md`
- `.gitignore`

## 删除文件
- 无

## 契约变更
- 未修改 `contracts/**` 或 `shared_contract/**`。
- 本轮后端已实现 Fastify 路由，但正式共享契约仍需按 FE/BE 双 review 流程补充 OpenAPI。

## Migration
- `migrations/0001_listening_speaking_v1.sql`
- destructive：否
- 表主键：所有表统一 `id bigint`，由后端雪花算法生成
- 时间字段：所有表统一 `created_at timestamp`、`updated_at timestamp`，应用层写 UTC 时间
- 已初始化数据库：`echo-english` @ `192.168.12.195:5435`

## 后端能力
- 账号登录与 session
- 内容单元草稿创建、BBC URL 导入草稿、发布校验、自动同步
- 学习单元访问控制与进度保存
- 口语评分提交、评分历史保存、替换说评分触发完成
- 首页可学习列表、继续学习、最近评分
- Drizzle ORM repository 层
- Provider 适配层：对象存储、BBC 导入、文字稿同步、口语评分
- 面向对象分层：Routes -> Services -> Repositories / Providers

## 前端交接
- 接口说明：`docs/features/listening-speaking-v1-api-handoff.md`
- Swagger UI：`http://127.0.0.1:3000/docs`
- OpenAPI JSON：`http://127.0.0.1:3000/openapi/json`
- 本地启动命令：
  `DATABASE_URL=postgres://postgres:postgres@192.168.12.195:5435/echo-english npm run dev`
