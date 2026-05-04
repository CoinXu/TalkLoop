# BE Dev 交付说明 content-admin-console-v1

## 新增文件

- `migrations/0006_content_admin_console_v1.sql`
- `services/api/src/repositories/ContentAdminRepository.ts`
- `services/api/src/services/ContentAdminService.ts`
- `services/api/src/services/ContentAdminService.test.ts`
- `services/api/src/http/routes/ContentAdminRoutes.ts`
- `services/api/src/http/schemas/ContentAdminSchemas.ts`
- `docs/features/content-admin-console-v1-be-technical-breakdown.md`
- `docs/features/content-admin-console-v1-be-dev-summary.md`
- `docs/features/content-admin-console-v1-be-dev-test-report.md`

## 修改文件

- `services/api/src/app.ts`
- `services/api/src/infrastructure/database/schema.ts`
- `services/api/src/scripts/provisionDatabase.ts`
- `services/api/src/services/LearningActivationService.ts`
- `services/api/src/http/schemas/LearningActivationSchemas.ts`

## API

新增 `/admin/content/*` 管理 API：

- `GET /admin/content/summary`
- `GET|POST /admin/content/scenes`
- `PATCH /admin/content/scenes/:id`
- `GET|POST /admin/content/courses`
- `PATCH /admin/content/courses/:id`
- `GET|POST /admin/content/sentences`
- `GET|PATCH /admin/content/sentences/:id`
- `POST /admin/content/status/batch`
- `POST /admin/content/courses/:id/composition`
- `POST /admin/content/imports/validate`
- `POST /admin/content/imports/confirm`
- `GET|PUT /admin/content/audio/default`
- `GET|POST /admin/content/publishing/validation`
- `POST /admin/content/publishing/publish`

## Migration

- `0006_content_admin_console_v1.sql`
- destructive: 否
- 变更：向现有内容表增加可空/默认字段，放宽状态 CHECK 到 `draft/published/unpublished/archived`，新增 `content_admin_settings`，补充后台内容权限。
- 回滚：删除新增索引/字段和 `content_admin_settings` 表即可；生产回滚前需确认新增字段无业务依赖。

## 契约变更

未修改 `contracts/**` 或 `shared_contract/**`。本次按后端内部路由和 Zod schema 实现新管理 API。
