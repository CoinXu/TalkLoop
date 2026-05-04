# Content Admin Console v1 BE 技术拆解

## 需求理解

本次需求新增超级管理员内容管理后台。后端需要在不改共享契约目录的前提下，提供可支撑场景、课程、句子池、批量导入、课程编排、默认音频兜底、批量状态变更和发布校验的管理 API。

## 任务依赖图

```text
BE1 migration/schema ──→ BE2 repository ──→ BE3 service ──→ BE4 routes/schema ──→ BE5 tests/build
```

## Dev 任务

| ID | 任务 | 前置 | 产出文件 | 状态 | 验证命令 |
|---|---|---|---|---|---|
| BE1 | 扩展内容表字段：slug、课程句子数规则、unpublished 状态、默认音频设置 | PRD M2-M8 | `migrations/0006_content_admin_console_v1.sql`, `schema.ts` | [x] | `npm run typecheck` |
| BE2 | 新增内容后台 Repository，集中封装场景、课程、句子、设置读写 | BE1 | `ContentAdminRepository.ts` | [x] | `npm run typecheck` |
| BE3 | 新增内容后台 Service，处理状态流转、发布校验、编排、导入预校验 | BE2 | `ContentAdminService.ts` | [x] | `npm run typecheck`, `npm run test:unit -- src/services/ContentAdminService.test.ts` |
| BE4 | 新增 `/admin/content/*` API 路由和 Zod schema | BE3 | `ContentAdminRoutes.ts`, `ContentAdminSchemas.ts`, `app.ts` | [x] | `npm run build` |
| BE5 | 补单测、构建和测试报告 | BE4 | `ContentAdminService.test.ts`, `content-admin-console-v1-be-dev-test-report.md` | [x] | `npm run typecheck`, `npm run build` |
