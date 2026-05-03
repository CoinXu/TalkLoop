import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import Fastify, { type FastifyInstance } from "fastify";
import { AppConfig } from "./config/AppConfig.js";
import { Database } from "./infrastructure/database/Database.js";
import { SnowflakeIdGenerator } from "./infrastructure/SnowflakeIdGenerator.js";
import { AdminRepository } from "./repositories/AdminRepository.js";
import { LearningActivationRepository } from "./repositories/LearningActivationRepository.js";
import { SubtlexusRepository } from "./repositories/SubtlexusRepository.js";
import { WordLibraryRepository } from "./repositories/WordLibraryRepository.js";
import { AdminService } from "./services/AdminService.js";
import { LearningActivationService } from "./services/LearningActivationService.js";
import { WordLibraryService } from "./services/WordLibraryService.js";
import { AdminRoutes } from "./http/routes/AdminRoutes.js";
import { LearningActivationRoutes } from "./http/routes/LearningActivationRoutes.js";
import { WordLibraryRoutes } from "./http/routes/WordLibraryRoutes.js";
import { StaticAssetRoutes } from "./http/routes/StaticAssetRoutes.js";
import { HttpErrorHandler } from "./http/HttpErrorHandler.js";
import { SwaggerDocsPlugin } from "./http/plugins/SwaggerDocsPlugin.js";

export interface AppDependencies {
  config: AppConfig;
  database: Database;
}

export async function buildApp(dependencies: AppDependencies): Promise<FastifyInstance> {
  const app = Fastify({
    ajv: {
      customOptions: {
        allowUnionTypes: true,
      },
    },
    logger: {
      level: dependencies.config.nodeEnv === "test" ? "silent" : "info",
    },
  });

  await app.register(cors);
  await app.register(multipart, { attachFieldsToBody: true, limits: { fileSize: 50 * 1024 * 1024 } });
  await new SwaggerDocsPlugin().register(app);
  new HttpErrorHandler().register(app);

  const idGenerator = new SnowflakeIdGenerator();
  const adminRepository = new AdminRepository(dependencies.database.db, idGenerator);
  const learningActivationRepository = new LearningActivationRepository(dependencies.database.db, idGenerator);
  const subtlexusRepository = new SubtlexusRepository(dependencies.database.db, idGenerator);
  const wordLibraryRepository = new WordLibraryRepository(dependencies.database.db, idGenerator);
  const adminService = new AdminService(adminRepository);
  const learningActivationService = new LearningActivationService(learningActivationRepository, adminService);
  const wordLibraryService = new WordLibraryService(wordLibraryRepository, subtlexusRepository, adminService);

  await new AdminRoutes(adminService).register(app);
  await new WordLibraryRoutes(wordLibraryService, adminService).register(app);
  await new LearningActivationRoutes(learningActivationService, adminService).register(app);
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
