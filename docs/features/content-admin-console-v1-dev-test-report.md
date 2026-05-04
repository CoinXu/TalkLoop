# Dev 测试报告 content-admin-console-v1

## 类型检查

- `npm run typecheck`: 通过

## Lint

- `npm run lint`: 通过

## 单测

- `npm test -- App.test.tsx`: 通过，9 / 9
- 覆盖范围：超管后台入口、内容后台正式 API 加载、场景/课程合并管理入口、课程关联句子编排、课程编排候选句子分页 API 查询、场景/课程/句子列表查询刷新、上一页/下一页/跳页控件、句子池 `limit=10` 正式 API 查询、句子筛选、批量分配结果、Word Meta 管理入口、Word Meta 词典式音标/词性/释义/例句/同反义词展示、内嵌发音播放器、学习端词典查询走公开 Word Meta API、词频/单词管理入口、学习端任务分类切换、学习端课程/句子/今日任务接口失败降级。

## 构建

- `npm run build`: 通过
- 备注：Vite 输出 chunk size warning，当前主 bundle 约 697.54 kB。该警告为既有单入口打包策略下的构建提示，不阻断本次交付。
