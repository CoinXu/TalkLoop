# Listening Speaking V1 PRD 看板

## 概览

- 模块总数：7
- 已完成：7
- 进行中：0
- 待办：0
- 状态：PRD 就绪
- 说明：标准 PM workflow 看板已写入 `.codex/task/listening-speaking-v1.md`。本文件保留为 feature 产出区的镜像，便于非 `.codex` 目录读者查看。

## 模块表

| ID | 模块名 | 状态 | 依赖 | PRD 文件 | 负责人 |
|---|---|---|---|---|---|
| M1 | content-unit-model | [x] | - | docs/PRD/listening-speaking-v1/M1-content-unit-model.md | @pm |
| M2 | account-progress | [x] | - | docs/PRD/listening-speaking-v1/M2-account-progress.md | @pm |
| M3 | content-ingestion | [x] | M1 | docs/PRD/listening-speaking-v1/M3-content-ingestion.md | @pm |
| M4 | transcript-sync | [x] | M1, M3 | docs/PRD/listening-speaking-v1/M4-transcript-sync.md | @pm |
| M5 | learning-session | [x] | M1, M2, M4 | docs/PRD/listening-speaking-v1/M5-learning-session.md | @pm |
| M6 | speaking-score | [x] | M1, M2, M5 | docs/PRD/listening-speaking-v1/M6-speaking-score.md | @pm |
| M7 | home-review | [x] | M1, M2, M6 | docs/PRD/listening-speaking-v1/M7-home-review.md | @pm |

## 依赖图

```text
M1 content-unit-model ──┬─→ M3 content-ingestion ──→ M4 transcript-sync ──┐
                        │                                                 │
                        ├─────────────────────────────────────────────────┼─→ M5 learning-session ──→ M6 speaking-score
                        │                                                 │             │                    │
                        └─────────────────────────────────────────────────┘             │                    │
M2 account-progress ────────────────────────────────────────────────────────────────────┴────────────────────┴─→ M7 home-review
```
