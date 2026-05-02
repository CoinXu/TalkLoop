# Dev 测试报告 listening-speaking-v1

## 类型检查
- `npm run typecheck`: 通过

## 单元测试
- `npm run test:unit`: 通过
- 结果：5 个测试文件，10 个测试用例全部通过
- 范围：
  - `src/infrastructure/SnowflakeIdGenerator.test.ts`
  - `src/services/AccountService.test.ts`
  - `src/services/ContentService.test.ts`
  - `src/services/LearningSessionService.test.ts`
  - `src/services/SpeakingScoreService.test.ts`

## 构建
- `npm run build`: 通过

## 集成测试
- `npm run test:integration`: 通过
- 真实 DB：`192.168.12.195:5435/echo-english`
- 覆盖：Fastify app 启动、健康检查、登录写入用户与 session、登录态首页读取。

## 备注
- `npm install` 报告 10 个依赖审计问题（8 moderate / 2 high），未执行 `npm audit fix --force`，避免破坏性升级。

## 前端验证

### 类型检查
- `npm run typecheck`: 通过

### Lint
- `npm run lint`: 通过
- 规则：Airbnb + Airbnb Hooks + Airbnb TypeScript + jsx-a11y + Prettier

### 单元测试
- `npm test`: 通过
- 结果：3 个测试文件，6 个测试用例全部通过
- 范围：
  - `src/features/learning/learningFlow.test.ts`
  - `src/features/learning/AudioTranscript.test.tsx`
  - `src/features/home/HomePage.test.tsx`

### 构建
- `npm run build`: 通过
- 备注：Vite 提示主 chunk 超过 500 kB，当前主要来自 Material UI 与 i18n 依赖合包；不影响构建产物。

### 依赖审计
- `npm install`: 完成，报告 4 个 moderate 级别依赖审计问题。
- 未执行 `npm audit fix --force`，避免引入破坏性升级。
