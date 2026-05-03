# Learning Activation v1.0 产品概述

## 背景

v1.0 面向“阅读认识，但听不出、说不出”的英语学习者。产品以词库系统为数据基座，通过水平评估建立用户词库，再用单词激活和听读课程把认知词转化为听觉词、活跃词。

本版以 `docs/tmp/v0.3.md` 为唯一需求来源，旧版同类 PRD 已废弃重建。每个业务功能都必须同时定义学习端能力和管理后台能力，避免内容生产、发布、抽检、用户状态排障缺少后台闭环。

## 用户与目标

- 学习端用户：有 1000-7000 词阅读基础，但听力反应慢、口语调不出词的学习者。
- 后台用户：超级管理员、后续内容管理员、运营/客服角色。v1.0 只开放超级管理员，但权限模型必须支持扩展。
- 达成标志：用户可完成水平评估、每日激活、听读课程和课程报告；管理员可管理词表、语料、标注、评估配置、任务策略、课程、练习记录和审计。

## 模块清单

| ID | 模块名 | 单一职责 | 产出文档 |
|---|---|---|---|
| M1 | admin-foundation | 后台登录、管理员账号、权限、审计与通用后台框架 | M1-admin-foundation.md |
| M2 | word-library-system | SUBTLEXus 词表、难度分级、场景标签、用户词库基础 | M2-word-library-system.md |
| M3 | corpus-course-system | 句库、课程、音频规范、内容生产和发布 | M3-corpus-course-system.md |
| M4 | auto-annotation-pipeline | 听力陷阱、干扰项、目标词、意群断句自动标注与审核 | M4-auto-annotation-pipeline.md |
| M5 | level-assessment | 自我描述、词汇量验证测试、持续校准 | M5-level-assessment.md |
| M6 | user-vocabulary-runtime | 用户词库状态、扩展、SRS、运行时记录 | M6-user-vocabulary-runtime.md |
| M7 | word-activation-practice | 听音辨义、听句辨词、跟读激活、状态流转 | M7-word-activation-practice.md |
| M8 | daily-task-visualization | 每日激活任务、优先级、进度和词汇可视化 | M8-daily-task-visualization.md |
| M9 | listen-repeat-practice | A/B/C 三种听读模式、录音回放、反馈与辅助功能 | M9-listen-repeat-practice.md |
| M10 | course-report-progress | 课程解锁、课程报告、句/课/用户统计 | M10-course-report-progress.md |

## 模块依赖

- M1 输出 `adminUserId`、`adminRole`、`permissionKey`、`adminSessionId`、审计字段和后台通用列表/详情/确认规则，供 M2-M10 的后台能力使用。
- M2 输出词表字段、难度等级、场景标签和用户词库基础字段，供 M3-M10 使用。
- M3 使用 M2 的词表和场景标签生产句子、课程和音频，供 M4、M7、M9、M10 使用。
- M4 使用 M2/M3 的词表和句库生成标注，输出听力陷阱、干扰项、`target_words`、`bonus_words`、`phrase_chunks`，供 M2/M3/M7/M9 使用。
- M5 使用 M2 词频分层生成评估结果，输出 `vocabularyEstimate` 和词频边界，供 M6 初始化用户词库。
- M6 使用 M2/M5 生成用户词库运行时状态，输出 `activation_status`、SRS、练习记录，供 M7/M8/M10 使用。
- M7 使用 M2/M3/M4/M6 执行听音辨义和听句辨词，并使用 M9 的跟读结果完成活跃词判定，输出状态升级/降级和练习结果，供 M8/M10 使用。
- M8 使用 M6/M7 的状态和优先级算法生成每日任务与可视化。
- M9 使用 M3/M4 的句子、音频、意群和 M6 的目标词状态执行听读练习，输出跟读结果给 M7/M10。
- M10 使用 M3/M7/M8/M9 的课程、任务、练习结果生成报告和统计。

## 依赖图

```text
M1 admin-foundation ───────────────────────────────→ M2-M10 admin capabilities

M2 word-library-system ──┬─→ M3 corpus-course-system ──┬─→ M4 auto-annotation-pipeline
                         │                              │
                         │                              └─→ M9 listen-repeat-practice ──┬─→ M7 word-activation-practice ──┬─→ M8 daily-task-visualization
                         │                                                               │                                │
                         ├─→ M5 level-assessment ──→ M6 user-vocabulary-runtime ─────────┘                                └─→ M10 course-report-progress
                         │
                         └────────────────────────────────────────────────────────────────────────────────────────────────→ M8 daily-task-visualization

M4 auto-annotation-pipeline ─────────────────────────→ M7 / M9
M7 word-activation-practice ─────────────────────────→ M8 / M10
```

## 版本范围

### 本期包含

- F0：词表层、语料层、用户词库层。
- F0：词库自动标注算法和人工抽检审核。
- F1：自我描述、词汇量验证测试、持续校准。
- F2：单词激活状态、状态流转、三类激活练习、每日任务和可视化。
- F3：听读课程、A/B/C 三种练习模式、录音回放、文本匹配、波形对比、语速反馈、意群练习、课程报告。
- 管理后台：每个功能模块对应后台配置、内容管理、审核、发布、监控、用户状态查看或修正、审计。

### 本期不包含

- AI 自由对话。
- 用户自建词库或外部词表导入。
- 音素级发音评分。
- 社交、排行榜。
- 付费、订阅。
- 多角色配置 UI；v1.0 只开放超级管理员。

## 交付说明

- 模块数：10
- 总验收清单：`acceptance.md`
- 冲突审阅：`conflicts.md`
- 总验收条数：70
- 冲突修复数：0

## 决策记录

- 2026-05-03：以 `docs/tmp/v0.3.md` 重建 v1.0 PRD。原因：用户确认需求变化，旧同类需求全部废弃。
- 2026-05-03：每个功能模块都必须包含管理后台能力。原因：词库、语料、标注、评估和练习规则都需要后台维护、审核和排障闭环。
