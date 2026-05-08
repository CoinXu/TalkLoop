# BE Dev 测试报告 content-admin-console-v1

## 类型检查

- `npm run typecheck`: 通过

## 单测

- `npm run test:unit -- src/services/ContentAdminService.test.ts`: 通过
- `npm run test:unit`: 通过
- 实际脚本执行 `src/**/*.test.ts`，结果 5 个测试文件 / 16 个测试全部通过。
- 新增覆盖：批量发布校验对象级结果、导入结果持久化、失败行 CSV、部分成功导入。

## 构建

- `npm run build`: 通过

## 集成烟测

- `npm run test:integration`: 通过
- 修复：SUBTLEXus fixture 路径支持当前 `services/vocabulary/subtlexus/SUBTLEXusfrequencyabove1.xls`。
- 新增覆盖：`GET /admin/content/summary`、`POST /admin/content/imports/validate`、`GET /admin/content/imports/:importBatchId`。
