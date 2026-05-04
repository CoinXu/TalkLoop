# Dev 交付说明 content-admin-console-v1

## 新增文件

- `apps/web/src/features/contentAdmin/types.ts`
- `apps/web/src/features/contentAdmin/mockData.ts`
- `apps/web/src/features/contentAdmin/components/ContentAdminConsole.tsx`
- `docs/features/content-admin-console-v1-technical-breakdown.md`
- `docs/features/content-admin-console-v1-dev-summary.md`

## 修改文件

- `apps/web/src/App.tsx`
- `apps/web/src/App.test.tsx`
- `apps/web/src/styles.css`
- `apps/web/src/features/contentAdmin/types.ts`
- `apps/web/src/features/contentAdmin/mockData.ts`
- `apps/web/src/features/contentAdmin/components/ContentAdminConsole.tsx`
- `docs/features/content-admin-console-v1-technical-breakdown.md`
- `docs/features/content-admin-console-v1-dev-test-report.md`

## 契约变更

无。前端没有修改 `contracts/**` 或 `shared_contract/**`。当前后台使用前端样例数据对齐 M9 所需字段和批量结果形态，后续后端 API 就绪后可替换数据层。

## 实现范围

- 新增 Content Admin Console v1 导航：内容概览、场景管理、课程管理、句子池、批量导入、课程编排、发布校验。
- 场景、课程、句子池支持关键词、状态筛选、批量选择、批量发布/下架/归档/恢复草稿和对象级失败原因。
- 场景和课程列表支持新建草稿对象、更新时间列、分页摘要；课程列表展示实际句子数和句子数规则。
- 句子池补齐 targetWord、sceneTag、难度、课程分配状态、音频、场景、课程等筛选，并支持批量分配课程。
- 内容后台状态新增最近审计记录；新建、保存、批量状态、批量分配和编排调整都会写入操作者、时间、操作类型、对象 ID 和摘要。
- 课程编排支持候选句子添加、移除、上移、下移，并将课程标记为需重新校验。
- 句子详情展示短语块、sceneTag、音频 URL、归属和引用信息，并提示文本修改的下游影响。
- 发布校验覆盖场景可发布课程、课程句子数、课程排序、场景状态、目标词/难度、默认音频兜底提示和缺音频阻断。
- 批量导入页提供 CSV/JSON 步骤、预校验结果、错误阻断、失败行下载入口。
