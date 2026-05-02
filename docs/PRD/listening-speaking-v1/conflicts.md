# 模块间冲突清单

## 审阅结果

已按 PM workflow 对 7 个模块做全局审阅，覆盖规则冲突、交互冲突、命名冲突、数据流断链、验收矛盾、非目标重叠 6 类问题。

## 发现项

### C1 [高] 完成条件与评分对象不一致

- 位置：M5-learning-session.md 规则 #4 vs M6-speaking-score.md 规则 #1、#7
- 问题：M5 写“至少一次录音评分即可完成”，M6 只声明 `targetSentenceId`，会导致跟读评分也可能完成单元，偏离“替换场景中说出来”的 V1 目标。
- 修复：M5 明确只有替换说步骤的有效评分可完成；M6 增加 `scoreTargetType=target_sentence|speaking_prompt` 和 `speakingPromptId`，并规定只有 `speaking_prompt` 有效评分触发完成。
- 状态：已修复 @ 2026-05-02。

### C2 [中] 游客体验与评分必须绑定 `userId` 的边界不清

- 位置：M2-account-progress.md 规则 #8 vs M5-learning-session.md 边界行为 vs M6-speaking-score.md 规则 #1
- 问题：M2 允许未登录体验公开单元，但 M6 评分输入必须有 `userId`；未明确游客能体验到哪一步，QA 无法判断未登录提交评分的期望行为。
- 修复：M2/M5 明确游客可体验到替换说录音前，提交评分前必须登录；登录后回到原步骤并继续提交。
- 状态：已修复 @ 2026-05-02。

### C3 [中] `internal_review` 可见性和发布校验不一致

- 位置：M1-content-unit-model.md 规则 #9、M3-content-ingestion.md 规则 #7、M7-home-review.md 规则 #7
- 问题：M1 允许 `internal_review` 进入 H5，M7 只禁止普通用户看到 `restricted/rejected/未发布`，M3 发布校验未明确 `unknown` 是否能发布。
- 修复：M1/M7 明确 `approved` 面向普通用户，`internal_review` 仅内部测试账号；M3 阻止 `unknown/rejected` 发布，并明确 `internal_review` 发布为内部测试内容。
- 状态：已修复 @ 2026-05-02。

### C4 [中] 目标跟读句与同步段定位字段不闭合

- 位置：M1-content-unit-model.md 规则 #4 vs M4-transcript-sync.md 规则 #4 vs M5-learning-session.md 规则 #7
- 问题：M4/M5 依赖目标句定位音频片段，但 M1 未声明目标句如何绑定 `segmentId`，存在数据流断链。
- 修复：M1 为 `targetSentence` 增加 `targetSentenceId` 和绑定 `segmentId`；M4 要求目标句绑定的 `segmentId` 必须存在于 `syncedSegments`。
- 状态：已修复 @ 2026-05-02。

### C5 [低] 登录方式不可测试

- 位置：M2-account-progress.md 规则 #2
- 问题：原表述为“至少支持手机号验证码或邮箱验证码一种”，但未说明 QA 如何确定当前环境应测哪一种。
- 修复：改为部署配置确定 `phone_otp` 或 `email_otp`，同一部署环境固定一种，QA 按当前配置验证。
- 状态：已修复 @ 2026-05-02。

## 风险备注

### R1 [中] BBC 内容授权边界需要 Tech Lead / 法务确认

- 位置：M1、M3
- 说明：PRD 已通过 `sourceType`、`sourceUrl`、`licenseStatus` 限制发布和访问，但无法替代授权确认。
- 建议：开发前由 @tech-lead 明确内容下载、存储、播放、展示的合规边界。

### R2 [低] 自动同步质量依赖技术实现

- 位置：M4、M5
- 说明：PRD 已允许人工校准，避免自动同步失败阻断运营。
- 建议：V1 技术实现优先保障人工校准链路可用。

## 决策记录

- 2026-05-02：二次审阅修复 5 个 QA 前置问题。原因：用户准备切换 QA 角色写测试用例，PRD 需要在完成条件、可见性、登录边界和数据字段上可测试、可判定。
