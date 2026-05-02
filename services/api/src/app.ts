import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import Fastify, { type FastifyInstance } from "fastify";
import { AppConfig } from "./config/AppConfig.js";
import { Database } from "./infrastructure/database/Database.js";
import { SnowflakeIdGenerator } from "./infrastructure/SnowflakeIdGenerator.js";
import { ContentRepository } from "./repositories/ContentRepository.js";
import { ScoreRepository } from "./repositories/ScoreRepository.js";
import { UserRepository } from "./repositories/UserRepository.js";
import { MockContentImportProvider } from "./providers/MockContentImportProvider.js";
import { MockObjectStorageProvider } from "./providers/MockObjectStorageProvider.js";
import { MockSpeakingScoreProvider } from "./providers/MockSpeakingScoreProvider.js";
import { FasterWhisperSpeakingScoreProvider } from "./providers/FasterWhisperSpeakingScoreProvider.js";
import { BasicTranscriptSyncProvider } from "./providers/BasicTranscriptSyncProvider.js";
import { AsrTranscriptSyncProvider } from "./providers/AsrTranscriptSyncProvider.js";
import { FasterWhisperSpeechRecognitionProvider } from "./providers/speech/FasterWhisperSpeechRecognitionProvider.js";
import { AccountService } from "./services/AccountService.js";
import { AssetUrlResolver } from "./services/AssetUrlResolver.js";
import { ContentService } from "./services/ContentService.js";
import { HomeService } from "./services/HomeService.js";
import { LearningSessionService } from "./services/LearningSessionService.js";
import { SpeakingScoreService } from "./services/SpeakingScoreService.js";
import { ContentRoutes } from "./http/routes/ContentRoutes.js";
import { AccountRoutes } from "./http/routes/AccountRoutes.js";
import { LearningRoutes } from "./http/routes/LearningRoutes.js";
import { SpeakingScoreRoutes } from "./http/routes/SpeakingScoreRoutes.js";
import { HomeRoutes } from "./http/routes/HomeRoutes.js";
import { StaticAssetRoutes } from "./http/routes/StaticAssetRoutes.js";
import { HttpErrorHandler } from "./http/HttpErrorHandler.js";
import { SwaggerDocsPlugin } from "./http/plugins/SwaggerDocsPlugin.js";

export interface AppDependencies {
  config: AppConfig;
  database: Database;
}

export async function buildApp(dependencies: AppDependencies): Promise<FastifyInstance> {
  const app = Fastify({
    logger: {
      level: dependencies.config.nodeEnv === "test" ? "silent" : "info",
    },
  });

  await app.register(cors);
  await app.register(multipart);
  await new SwaggerDocsPlugin().register(app);
  new HttpErrorHandler().register(app);

  const idGenerator = new SnowflakeIdGenerator();
  const contentRepository = new ContentRepository(dependencies.database.db, idGenerator);
  const userRepository = new UserRepository(dependencies.database.db, idGenerator);
  const scoreRepository = new ScoreRepository(dependencies.database.db, idGenerator);

  const objectStorageProvider = new MockObjectStorageProvider(dependencies.config.objectStoragePublicBaseUrl);
  const contentImportProvider = new MockContentImportProvider();
  const transcriptSyncProvider =
    dependencies.config.transcriptSyncProvider === "faster_whisper"
      ? new AsrTranscriptSyncProvider(new FasterWhisperSpeechRecognitionProvider(dependencies.config.whisperBaseUrl))
      : new BasicTranscriptSyncProvider();
  const speakingScoreProvider =
    dependencies.config.speakingScoreProvider === "faster_whisper"
      ? new FasterWhisperSpeakingScoreProvider(dependencies.config.whisperBaseUrl)
      : new MockSpeakingScoreProvider();
  const assetUrlResolver = new AssetUrlResolver(dependencies.config.staticAssetPublicBaseUrl);

  const contentService = new ContentService(
    contentRepository,
    contentImportProvider,
    transcriptSyncProvider,
    assetUrlResolver,
    dependencies.config.databaseUrl,
  );
  const accountService = new AccountService(userRepository, dependencies.config.loginMethod);
  const learningSessionService = new LearningSessionService(contentRepository, userRepository, assetUrlResolver);
  const speakingScoreService = new SpeakingScoreService(
    contentRepository,
    userRepository,
    scoreRepository,
    objectStorageProvider,
    speakingScoreProvider,
  );
  const homeService = new HomeService(contentRepository, userRepository, scoreRepository);

  await new ContentRoutes(contentService).register(app);
  await new AccountRoutes(accountService).register(app);
  await new LearningRoutes(learningSessionService, accountService).register(app);
  await new SpeakingScoreRoutes(speakingScoreService, accountService).register(app);
  await new HomeRoutes(homeService, accountService).register(app);
  await new StaticAssetRoutes().register(app);

  app.get(
    "/health",
    {
      schema: {
        tags: ["system"],
        summary: "Health check",
        response: {
          200: {
            type: "object",
            properties: {
              status: { type: "string" },
            },
            required: ["status"],
          },
        },
      },
    },
    async () => ({ status: "ok" }),
  );

  app.get(
    "/openapi/json",
    {
      schema: {
        tags: ["system"],
        summary: "OpenAPI JSON document",
        hide: true,
      },
    },
    async () => app.swagger(),
  );

  return app;
}
