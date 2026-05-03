# Learning Activation v1.0 BE 技术拆解

## 需求源

- `docs/PRD/learning-activation-v1/overview.md`
- `docs/PRD/learning-activation-v1/M1-admin-foundation.md` 至 `M10-course-report-progress.md`
- `docs/PRD/learning-activation-v1/acceptance.md`

旧 `listening-speaking-v1`、旧 `vocabulary-activation-v0.1`、旧 `admin-console` 需求不再作为实现依据。

## 保留基础代码

- Fastify 应用骨架：`services/api/src/app.ts` 中的插件注册、错误处理、Swagger 输出、`/health`、`/openapi/json`。
- 配置加载：`services/api/src/config/**`，保留并扩展 v1.0 需要的 ASR/TTS/对象存储配置。
- 数据库连接：`services/api/src/infrastructure/database/Database.ts`。
- ID 生成：`services/api/src/infrastructure/SnowflakeIdGenerator.ts`。
- 通用错误与 JSON 输出：`AppError.ts`、`HttpErrorHandler.ts`、`JsonPresenter.ts`。
- 可复用 Provider 基础：对象存储、ASR/语音识别 provider 可保留，旧 speaking score provider 只在能适配 M9 文本匹配/录音反馈时复用。

## 删除旧模块

- 旧学习内容链路：`ContentRoutes`、`LearningRoutes`、`SpeakingScoreRoutes`、`HomeRoutes` 对应 service/repository/schema/model。
- 旧 BBC 内容导入：`importLearningUnit.ts`、`ContentImportProvider`、`MockContentImportProvider`、`TranscriptSyncProvider` 及 BBC import 工具。
- 旧数据库对象：`content_units`、`audio_assets`、`transcript_segments`、`target_sentences`、`speaking_prompts`、`synced_segments`、`unit_progress`、`score_records`、`ingestion_jobs` 及相关 enum。
- 若工作树中存在旧 admin/vocabulary 主链路文件，应删除旧 `AdminRoutes`、`AdminVocabularyRoutes`、`VocabularyRoutes`、旧 repository/service/schema，并按 v1.0 重建。
- 旧 seed/mock/smoke 逻辑全部改为 v1.0 数据结构。

## 新增后端模块

| 模块 | Repository | Service | Routes |
|---|---|---|---|
| M1 admin-foundation | `AdminRepository` | `AdminService` | `AdminRoutes` |
| M2 word-library-system | `WordLibraryRepository` | `WordLibraryService` | `WordLibraryRoutes`, `AdminWordLibraryRoutes` |
| M3 corpus-course-system | `CorpusRepository` | `CorpusService` | `CourseRoutes`, `AdminCorpusRoutes` |
| M4 auto-annotation-pipeline | `AnnotationRepository` | `AnnotationService` | `AdminAnnotationRoutes` |
| M5 level-assessment | `AssessmentRepository` | `AssessmentService` | `AssessmentRoutes`, `AdminAssessmentRoutes` |
| M6 user-vocabulary-runtime | `UserVocabularyRepository` | `UserVocabularyService` | `UserVocabularyRoutes`, `AdminUserVocabularyRoutes` |
| M7 word-activation-practice | `ActivationPracticeRepository` | `ActivationPracticeService` | `ActivationPracticeRoutes`, `AdminPracticeRulesRoutes` |
| M8 daily-task-visualization | `DailyTaskRepository` | `DailyTaskService` | `DailyTaskRoutes`, `AdminTaskStrategyRoutes` |
| M9 listen-repeat-practice | `ListenRepeatRepository` | `ListenRepeatService` | `ListenRepeatRoutes`, `AdminListenRepeatRoutes` |
| M10 course-report-progress | `CourseReportRepository` | `CourseReportService` | `CourseReportRoutes`, `AdminCourseReportRoutes` |

## 新增表

- M1：`admin_users`、`admin_sessions`、`admin_permissions`、`admin_role_permissions`、`admin_audit_logs`。
- 账号基础：保留或重建 `users`、`sessions`，字段对齐 v1.0 学习端登录与用户画像。
- M2：`word_entries`、`word_frequency_sources`、`word_audio_assets`、`word_references`、`word_versions`。
- M3：`learning_scenes`、`learning_courses`、`corpus_sentences`、`sentence_word_links`、`sentence_audio_assets`、`course_sentence_order`。
- M4：`annotation_jobs`、`annotation_results`、`annotation_result_versions`、`annotation_review_items`。
- M5：`assessment_versions`、`assessment_questions`、`assessment_options`、`assessment_estimate_matrix`、`assessment_sampling_rules`、`user_assessments`、`verification_rounds`。
- M6：`user_vocabulary_items`、`user_vocabulary_events`、`user_vocabulary_rebuild_jobs`。
- M7：`practice_rule_versions`、`audio_meaning_attempts`、`sentence_word_attempts`、`word_activation_events`。
- M8：`task_strategy_versions`、`daily_tasks`、`daily_task_items`、`task_generation_logs`。
- M9：`listen_repeat_attempts`、`listen_repeat_recordings`、`listen_repeat_feedback`、`listen_repeat_phrase_attempts`。
- M10：`user_course_progress`、`user_sentence_progress`、`course_report_snapshots`、`user_learning_stats`。

## 迁移步骤

1. 本地/开发：允许重置数据库，使用新的 v1.0 baseline migration 重建全库。
2. 测试/预发：新增迁移脚本先创建 v1.0 表，再迁移可保留的 `users/sessions`，旧表改名归档或分阶段下线。
3. 生产/真实数据：不得直接 drop；先做全库备份、数据映射评审、回滚方案、灰度验证，再执行只增不删迁移。
4. `provisionDatabase.ts` 改为识别 v1.0 schema marker，不再以旧 `users` 表作为“已迁移”判断。
5. 旧 migrations 不作为 v1.0 主链路；新增 `0001_learning_activation_v1.sql` 或 `0100_learning_activation_v1_baseline.sql` 作为基线。

## 实现批次

```text
BE1 清理旧 schema/enums/routes/services/repos/scripts
  └─→ BE2 v1.0 migration + ORM schema
      └─→ BE3 M1 admin-foundation
          ├─→ BE4 M2/M3 内容基座
          │   └─→ BE5 M4 自动标注与审核
          ├─→ BE6 M5/M6 评估与用户词库
          │   └─→ BE7 M7/M8 激活练习与每日任务
          └─→ BE8 M9/M10 听读与课程报告
              └─→ BE9 provision/import/smoke + 文档
```

## 风险点

- 本次是破坏性重建，前端旧 API 会失效；BE 只能改后端，前端需单独按 v1.0 对接。
- PRD 要求每个模块都有后台能力，不能只做学习端 MVP。
- SUBTLEXus、CMU/g2p、TTS 的真实数据源和工具需要配置；缺失时只能提供 mock provider 和导入格式。
- M9 文本匹配、录音、ASR 反馈会依赖浏览器录音与语音识别 provider，后端需先定义可替换 provider。
- 测试/预发/生产必须区分迁移策略；生产或真实数据环境必须先备份和评审。

## 2026-05-03 清理执行记录

- 已删除旧 `listening-speaking-v1` 后端主链路文件：内容导入、学习单元、学习进度、口语评分、首页、旧账号会话相关 routes/services/repositories/schemas/providers。
- 已删除旧 `0001_listening_speaking_v1.sql`，新增 `0001_learning_activation_v1.sql` 作为 v1.0 清洁基线 marker。
- `app.ts` 已收敛到系统端点、Swagger、错误处理和静态资源路由，后续 M1-M10 从空业务路由开始重建。
- `provisionDatabase.ts` 已改为识别 `learning_activation_schema_meta`，不再以旧 `users` 表判断迁移状态。
- 新增 `npm run db:reset:local`，仅在 `LEARNING_ACTIVATION_ALLOW_LOCAL_RESET=1` 且非 production 环境时清理本地/开发库 schema；测试/预发/生产不使用该脚本。
- 未触碰 `apps/**` 前端目录；前端可按 v1.0 独立重建。

## 2026-05-03 开发库重置记录

- 用户确认当前 `DATABASE_URL` 指向本项目专用开发库。
- 已执行 `LEARNING_ACTIVATION_ALLOW_LOCAL_RESET=1 npm run db:reset:local` 清理开发库 `public` schema。
- 已执行 `npm run db:provision` 应用 `0001_learning_activation_v1.sql`。
- 已执行 `npm run test:integration`，结果：`v1 api skeleton smoke test passed`。

## 2026-05-03 M1 admin-foundation 开发记录

- 新增 `0002_learning_activation_v1_admin_foundation.sql`：管理员账号、会话、权限、角色权限、审计日志表。
- 新增 `AdminRepository`、`AdminService`、`AdminRoutes`、`AdminSchemas`。
- 已实现后台登录、登出、当前管理员、管理员账号列表/创建/启停/重置密码、审计日志列表。
- `npm run db:provision` 会按缺表检测补应用 v1.0 migrations，并在设置 `ADMIN_BOOTSTRAP_LOGIN` / `ADMIN_BOOTSTRAP_PASSWORD` 时创建首个超级管理员。

## 2026-05-03 M2 word-library-system 开发记录

- 新增 `0003_learning_activation_v1_word_library.sql`：词条表保留 SUBTLEXus 词频和上下文多样性字段。
- 新增 `WordLibraryRepository`、`WordLibraryService`、`WordLibraryRoutes`、`WordLibrarySchemas`。
- 已实现学习端 `GET /word-library/words`，只返回已发布、审核通过、音频 ready、字段完整且未排除的词条。
- 已实现后台 `GET/POST/PATCH /admin/word-library/words` 与 `POST /admin/word-library/words/:id/publish`。
- 发布词条会校验审核状态、音频、释义、词频、上下文多样性、难度和排除状态，并写审计日志。
