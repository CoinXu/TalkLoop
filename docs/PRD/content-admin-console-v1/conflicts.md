# 模块间冲突清单

## 审阅范围

- M1 admin-shell-navigation
- M2 scene-management
- M3 course-management
- M4 sentence-pool-management
- M5 bulk-import-validation
- M6 course-composition
- M7 audio-asset-policy
- M8 publishing-validation
- M9 admin-api-requirements

## 结果

未发现需要修复的模块间冲突。

## 已检查项

- 规则冲突：状态模型统一为 `draft`、`published`、`unpublished`、`archived`。
- 交互冲突：批量操作、发布校验、归档确认均复用 M1 的通用确认和反馈规则。
- 命名冲突：`sceneId`、`courseId`、`sentenceId`、`sortOrder`、`status` 语义一致。
- 数据流断链：M2 输出场景，M3 输出课程，M4 输出句子，M6 写入课程归属，M8 统一校验，M9 汇总 API。
- 验收矛盾：默认音频在 M7 和 M8 中均为提示项，不阻止发布；默认音频未配置且缺音频为阻断项。
- 非目标重叠：审核流、多角色权限、TTS 生成、在线 Excel 编辑均保持非目标。

