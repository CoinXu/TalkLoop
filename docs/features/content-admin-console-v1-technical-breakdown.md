# Content Admin Console v1 FE 技术拆解

## 需求理解

本次产品更新新增面向超级管理员的内容管理后台，覆盖场景、课程、句子池、批量导入、课程编排、默认音频兜底和发布校验。前端首版在不单边修改契约的前提下，先提供可运行的工作台式后台体验和与 M9 API 对齐的数据形态。

## 任务依赖图

```text
FE1 类型/样例数据 ──→ FE2 ContentAdminConsole ──→ FE3 App 导航接入 ──→ FE4 测试/构建验证
                    └─→ FE5 PRD 增量补齐 ───────┘
```

## Dev 任务

| ID | 任务 | 前置 | 产出文件 | 状态 | 验证命令 |
|---|---|---|---|---|---|
| FE1 | 定义内容后台状态、音频状态、发布校验和批量结果类型，并准备样例数据 | PRD M1-M9 | `apps/web/src/features/contentAdmin/types.ts`, `mockData.ts` | [x] | `npm run typecheck` |
| FE2 | 实现后台概览、场景、课程、句子池、导入、编排、发布校验面板 | FE1 | `apps/web/src/features/contentAdmin/components/ContentAdminConsole.tsx` | [x] | `npm run typecheck` |
| FE3 | 将管理后台导航从旧学习激活模块切换为 Content Admin Console v1 模块 | FE2 | `apps/web/src/App.tsx`, `apps/web/src/styles.css` | [x] | `npm test -- App.test.tsx` |
| FE4 | 增加登录态烟测并运行本 feature 相关验证 | FE3 | `apps/web/src/App.test.tsx` | [x] | `npm run typecheck`, `npm test -- App.test.tsx`, `npm run build` |
| FE5 | 补齐新建场景/课程、完整句子筛选、批量分配、审计展示和分页摘要 | FE1, FE2, FE3 | `apps/web/src/features/contentAdmin/types.ts`, `mockData.ts`, `components/ContentAdminConsole.tsx`, `apps/web/src/App.tsx`, `apps/web/src/App.test.tsx`, `apps/web/src/styles.css` | [x] | `npm run typecheck`, `npm run lint`, `npm test -- App.test.tsx`, `npm run build` |
