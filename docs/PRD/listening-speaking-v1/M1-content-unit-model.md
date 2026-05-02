# M1 content-unit-model

## 背景 / 要解决的问题

V1 的学习体验建立在“一个表达一个短单元”上。内容既可能由运营上传，也可能从 BBC 页面下载素材后再整理，因此必须先定义稳定的学习单元模型，保证学习端、同步、评分、进度、复习使用同一套字段。

## 规则

1. 学习单元必须拥有唯一 `unitId`、标题、目标表达 `expression`、中文释义、难度、场景标签、发布时间、发布状态。
2. 学习单元必须包含一个主音频 `audioAsset`，字段包括 `audioId`、文件地址、时长、格式、上传人、上传时间。
3. 学习单元必须包含文字稿 `transcriptSegments`，每段至少包含 `segmentId`、英文文本、中文辅助说明、角色名、段落顺序。
4. 学习单元必须包含至少 1 个目标跟读句 `targetSentence`，每句包含 `targetSentenceId`、英文文本、中文提示、是否包含目标表达、绑定的 `segmentId`。
5. 学习单元必须包含至少 1 个替换说练习 `speakingPrompt`，字段包括 `speakingPromptId`、中文场景、英文提示缺口、目标表达、期望答句。
6. 内容来源必须记录 `sourceType`，可选值为 `manual_upload`、`bbc_url_import`、`other_url_import`。
7. `sourceUrl` 在 `sourceType` 不等于 `manual_upload` 时必填。
8. `licenseStatus` 必填，可选值为 `unknown`、`internal_review`、`approved`、`restricted`、`rejected`。
9. 只有 `publishStatus=published` 且 `licenseStatus=approved` 的单元可进入普通用户 H5 学习列表。
10. `publishStatus=published` 且 `licenseStatus=internal_review` 的单元仅允许内部测试账号访问，不得出现在普通用户列表。
11. 单元内容不定义语法教学、词汇书式释义、长篇阅读理解字段。

## 交互

- 运营创建单元 -> 系统生成 `unitId`，默认 `publishStatus=draft`，默认 `licenseStatus=unknown`。
- 运营补齐音频、文字稿、目标表达和口语练习 -> 系统允许进入同步流程。
- 用户打开学习端 -> 系统只展示可学习状态的单元。
- 学习端请求单元详情 -> 系统返回音频、文字稿、目标句、替换说练习和同步时间轴。

## 视觉 / UI 布局

- 学习端单元卡片显示标题、目标表达、中文释义、难度、预计学习时长、完成状态。
- 单元详情顶部突出目标表达，不把长篇文字稿作为首屏主体。
- 内容后台以表单和分区展示：基础信息、音频、文字稿、口语练习、来源授权。

## 边界行为

- 缺少主音频时，单元不得发布。
- 缺少文字稿时，单元不得进入同步流程。
- 文字稿为空段、重复段落顺序、缺少目标跟读句时，系统提示运营修复。
- `licenseStatus=restricted` 或 `rejected` 的单元不得被 H5 用户访问。
- 音频时长超过 8 分钟时，系统提示不符合 V1 短单元原则，但是否强拦由 @tech-lead / @pm 二次确认。

## 验收 checklist

- [ ] 可创建包含目标表达、音频、文字稿、口语练习的学习单元。
- [ ] 单元来源和授权状态有明确字段记录。
- [ ] 未发布或授权不可用的单元不会出现在普通用户学习列表。
- [ ] 学习端可以基于 `unitId` 获取完整单元详情。
- [ ] 每个发布单元至少有 1 个带 `targetSentenceId` 的目标跟读句和 1 个带 `speakingPromptId` 的替换说练习。

## 非目标

- 不定义支付、会员、社区内容。
- 不定义完整课程体系和等级考试体系。
- 不解决 BBC 内容授权本身，只记录授权状态并提供产品约束。

## 依赖

- 上游：无。
- 下游：M3 使用 `unitId`、`sourceType`、`sourceUrl`、`licenseStatus`、`publishStatus` 写入和发布内容；M4 使用 `audioAsset`、`transcriptSegments`、`targetSentence.segmentId` 生成同步时间轴；M5 使用目标表达、目标句、替换说练习构建学习流程；M6 使用 `targetSentenceId` 或 `speakingPromptId` 创建评分对象；M7 使用单元卡片字段展示列表。

## 决策记录

- 2026-05-02：将内容授权状态纳入单元模型。原因：用户希望下载 BBC 文字稿和音频，但 V1 不能默认拥有再分发授权，需要把风险显式产品化。
- 2026-05-02：补充 `targetSentenceId`、`speakingPromptId` 并区分普通用户与内部测试账号可见范围。原因：修复 QA 前审阅发现的评分对象不闭合和 `internal_review` 可见性歧义；见 conflicts.md/C1、C3。
