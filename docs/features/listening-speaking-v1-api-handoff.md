# Listening Speaking V1 后端接口交接

## 运行信息

- API 服务目录：`services/api`
- 默认开发端口：`3000`
- Swagger UI：`http://127.0.0.1:3000/docs`
- OpenAPI JSON：`http://127.0.0.1:3000/openapi/json`
- DTO / 请求响应 schema：`services/api/src/http/schemas/**`
- Swagger 注解风格：`@Tag` / `@Operation`，定义在 `services/api/src/http/docs/RouteDecorators.ts`
- 数据库：`postgres://postgres:postgres@192.168.12.195:5435/echo-english`
- 会话 Header：`x-session-id: <sessionId>`
- ID 格式：雪花 ID，HTTP/JSON 中用十进制字符串表示
- 时间格式：ISO 字符串；数据库按 UTC 语义写入 `timestamp`

## 启动

```bash
cd services/api
DATABASE_URL=postgres://postgres:postgres@192.168.12.195:5435/echo-english npm run dev
```

## 通用错误

```json
{
  "error": "validation_failed",
  "message": "Invalid request payload",
  "details": {}
}
```

## 健康检查

`GET /health`

响应：

```json
{ "status": "ok" }
```

## 登录

`POST /auth/login`

请求：

```json
{
  "destination": "learner@example.com",
  "otpCode": "123456"
}
```

响应：

```json
{
  "sessionId": "123",
  "userId": "456",
  "isInternalTester": false,
  "expiresAt": "2026-05-09T00:00:00.000Z"
}
```

## 首页

`GET /home`

- 未登录可访问公开单元列表。
- 登录时带 `x-session-id`，返回继续学习和最近评分。

响应：

```json
{
  "continueLearning": null,
  "units": []
}
```

## 学习单元详情

`GET /learning/units/:unitId`

- 普通用户只能访问 `published + approved + synced` 单元。
- 内部测试账号可访问 `published + internal_review + synced` 单元。

响应包含：

- `unit`
- `audio`
- `segments`
- `targets`
- `prompts`
- `synced`
- `progress`

## 保存学习进度

`PUT /learning/units/:unitId/progress`

Header：`x-session-id`

请求：

```json
{
  "currentStep": "speaking_prompt",
  "status": "in_progress"
}
```

枚举：

- `currentStep`: `listen_original` / `intensive_listening` / `target_shadowing` / `speaking_prompt` / `score_result`
- `status`: `not_started` / `in_progress` / `completed`

## 提交口语评分

`POST /speaking-scores`

Header：`x-session-id`

请求：

```json
{
  "unitId": "3001",
  "scoreTargetType": "speaking_prompt",
  "targetId": "5001",
  "targetText": "I am on the same page.",
  "recordingBase64": "base64-audio",
  "recordingMimeType": "audio/webm"
}
```

规则：

- `scoreTargetType=target_sentence` 会保存评分历史，但不会完成单元。
- `scoreTargetType=speaking_prompt` 会保存评分历史，并把单元标记为 `completed`。

## 后台：创建内容草稿

`POST /admin/content-units`

请求示例：

```json
{
  "title": "On the same page",
  "expression": "on the same page",
  "expressionMeaning": "意见一致",
  "difficulty": "intermediate",
  "sceneTags": ["work"],
  "estimatedMinutes": 5,
  "sourceType": "manual_upload",
  "licenseStatus": "approved",
  "audioAsset": {
    "url": "https://example.com/audio.mp3",
    "durationSeconds": 180,
    "format": "mp3",
    "uploadedBy": "operator"
  },
  "transcriptSegments": [
    {
      "segmentId": "10001",
      "englishText": "We are on the same page.",
      "chineseText": "我们意见一致。",
      "segmentOrder": 0
    }
  ],
  "targetSentences": [
    {
      "englishText": "We are on the same page.",
      "chinesePrompt": "说：我们意见一致。",
      "includesExpression": true,
      "segmentId": "10001"
    }
  ],
  "speakingPrompts": [
    {
      "chineseScenario": "你想表达和同事想法一致。",
      "englishPromptGap": "We are ____.",
      "targetExpression": "on the same page",
      "expectedAnswer": "We are on the same page."
    }
  ]
}
```

说明：`transcriptSegments[].segmentId` 是请求内临时引用 ID，用于让 `targetSentences[].segmentId` 绑定同一段；后端会生成真实雪花 ID。

## 后台：BBC URL 导入

`POST /admin/content-units/import-bbc`

请求：

```json
{
  "sourceUrl": "https://www.bbc.co.uk/learningenglish/example"
}
```

返回草稿，授权状态为 `internal_review`。

## 后台：自动同步

`POST /admin/content-units/:unitId/auto-sync`

基于当前文字稿段落和音频时长生成句段级时间轴。

## 后台：发布

`POST /admin/content-units/:unitId/publish`

发布前校验：

- 必须有音频
- 必须有文字稿
- 必须有目标句
- 必须有替换说练习
- `licenseStatus=unknown/rejected` 不允许发布
