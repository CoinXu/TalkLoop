# BE Dev 测试报告 content-admin-console-v1

## 类型检查

- `npm run typecheck`: 通过

## 单测

- `npm run test:unit -- src/services/ContentAdminService.test.ts`: 通过
- 实际脚本会执行 `src/**/*.test.ts`，结果 3 个测试文件 / 5 个测试全部通过。

## 构建

- `npm run build`: 通过

## 集成烟测

- `npm run test:integration`: 未通过
- 原因：脚本启动时读取 `services/vocabulary/resource/SUBTLEXusfrequencyabove1.xls`，当前工作区该旧路径文件缺失。失败发生在测试资源读取阶段，尚未进入本次新增 `/admin/content/*` API 流程。
