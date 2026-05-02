# Listening Speaking V1 产品概述

## 背景

目标是参考 BBC Learning English 中文站「地道英语」的学习方式，做一个面向中文母语学习者的英语学习 H5 验证版。参考对象的核心特点是：中级难度、单集短内容、真实地道表达、音频加文字稿、围绕一个表达讲解使用场景。

V1 不做完整英语学习平台，只解决一个明确问题：有一定英语基础的用户能看懂单词和句子，但听不懂自然语速，也说不出来。产品训练重点放在“说出来”，听力只服务于口语输入、模仿和复现。

## 用户与目标

- 目标用户：中文母语、英语中级左右、有词汇和语法基础，但听真实表达吃力、开口反应慢的学习者。
- 核心场景：用户在碎片时间学习一个真实表达，先听懂，再跟读，再在替换场景中说出来。
- V1 达成标志：用户完成一个单元后，可以在不给原句全文提示的情况下，说出目标表达，并获得一次口语评分。

## V1 产品原则

1. 说优先：每个学习单元必须以一次可评分的开口练习结束。
2. 短闭环：单元学习时长控制在 3-5 分钟，适合 H5 验证。
3. 自主对比：系统只给评分和录音回放，不做纠错；用户自己对比示范音频和自己的发音。
4. 内容可运营：后台支持上传文字稿和音频，也支持从 BBC 页面抓取文字稿和音频作为素材来源。
5. 账号与数据沉淀：V1 需要账号、学习记录、口语评分记录和单元完成状态。

## 版权与内容边界

- 产品内容定位为“自有内容体系”，学习法和栏目结构可参考 BBC Learning English。
- 若从 BBC 页面下载文字稿和音频，V1 PRD 将定义为“内容导入能力”，不默认拥有再分发授权。
- 对外发布前需要 @tech-lead / 法务确认 BBC 内容抓取、存储、播放、改写、展示的授权边界。
- 后台必须保留内容来源字段，支持标记 `sourceType`、`sourceUrl`、`licenseStatus`，避免来源不可追踪。

## 模块清单

| ID | 模块名 | 单一职责 | 产出文档 |
|---|---|---|---|
| M1 | content-unit-model | 定义学习单元、文字稿、音频、表达、句子、时间轴、来源授权等内容数据规则 | M1-content-unit-model.md |
| M2 | account-progress | 定义账号、登录、学习进度、完成状态、评分记录的数据规则 | M2-account-progress.md |
| M3 | content-ingestion | 定义后台上传文字稿/音频、BBC URL 导入、素材审核和发布流程 | M3-content-ingestion.md |
| M4 | transcript-sync | 定义文字稿与音频自动同步、人工校准和播放高亮规则 | M4-transcript-sync.md |
| M5 | learning-session | 定义 H5 学习单元的听、看、跟读、替换说的主流程 | M5-learning-session.md |
| M6 | speaking-score | 定义录音、回放、口语评分、评分保存和不纠错规则 | M6-speaking-score.md |
| M7 | home-review | 定义 H5 首页、单元列表、继续学习、历史记录和复习入口 | M7-home-review.md |

## 模块依赖

### 上游输入与下游输出

- M1 输出 `unitId`、`expression`、`transcriptSegments`、`audioAsset`、`targetSentence`、`speakingPrompt`、`sourceType`、`sourceUrl`、`licenseStatus`、`publishStatus`，供 M3、M4、M5、M6、M7 使用。
- M2 输出 `userId`、`sessionId`、`unitProgress`、`scoreHistory`、`isInternalTester`，供 M5、M6、M7 使用。
- M3 使用 M1 的内容字段创建或更新学习单元，输出可发布的 `unitId` 与 `publishStatus`。
- M4 使用 M1 的 `audioAsset` 和 `transcriptSegments`，输出带时间戳的 `syncedSegments` 和 `syncStatus`，供 M5 播放高亮和跟读定位使用。
- M5 使用 M1 的学习单元字段、M2 的登录用户和进度字段、M4 的 `syncedSegments` 与 `syncStatus`，输出本次学习事件和待评分录音任务。
- M6 使用 M5 的录音任务、M1 的目标句或替换说练习、M2 的 `userId`，输出 `speakingScore` 与录音回放记录。
- M7 使用 M1 的已发布单元、M2 的进度和 M6 的评分记录，输出用户可见的继续学习和复习入口。

### 依赖图

```text
M1 content-unit-model ──┬─→ M3 content-ingestion ──→ M4 transcript-sync ──┐
                        │                                                 │
                        ├─────────────────────────────────────────────────┼─→ M5 learning-session ──→ M6 speaking-score
                        │                                                 │             │                    │
                        └─────────────────────────────────────────────────┘             │                    │
M2 account-progress ────────────────────────────────────────────────────────────────────┴────────────────────┴─→ M7 home-review
```

## 版本范围

### V1 包含

- H5 学习端。
- 账号登录和数据库记录。
- 后台内容导入：上传文字稿、上传音频、从 BBC URL 抽取素材。
- 音频播放与文字稿同步高亮。
- 以说为核心的学习流程：听原音、看文本、跟读、替换表达、录音评分、回放对比。
- 评分记录、单元完成状态、继续学习入口。

### V1 不包含

- 完整语法纠错、逐词纠音、AI 老师对话。
- 社区、排行榜、打卡分享。
- 课程商城、支付、会员。
- 多语言学习。
- 原生 iOS / Android App。
- 大规模版权内容库运营；V1 只定义内容导入与授权状态管理。

## 交付说明

- 模块数：7
- PRD 文件列表：
  - `M1-content-unit-model.md`
  - `M2-account-progress.md`
  - `M3-content-ingestion.md`
  - `M4-transcript-sync.md`
  - `M5-learning-session.md`
  - `M6-speaking-score.md`
  - `M7-home-review.md`
- 总验收清单：`acceptance.md`
- 冲突审阅：`conflicts.md`
- 冲突修复数：5
- 总验收条数：40
- 看板：`.codex/task/listening-speaking-v1.md`

## 决策记录

- 2026-05-02：V1 先做 H5 验证，不做原生 App。原因：用户确认先验证学习闭环。
- 2026-05-02：V1 以“说出来”为核心，听力步骤服务于模仿和输出。原因：用户确认重点是培养说的能力。
- 2026-05-02：评分模块不做纠错，只做评分和回放对比。原因：用户确认学习者会自行对比自己的发音和音频。
- 2026-05-02：需要账号和数据库。原因：用户确认要沉淀学习进度与评分记录。
- 2026-05-02：单元完成条件明确为替换说练习完成一次有效评分。原因：V1 目标是培养说的能力，跟读评分只能作为过程练习，不能代表用户已能在场景中说出目标表达。
