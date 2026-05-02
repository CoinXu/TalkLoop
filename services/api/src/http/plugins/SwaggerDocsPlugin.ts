import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import type { FastifyInstance } from "fastify";

export class SwaggerDocsPlugin {
  async register(app: FastifyInstance): Promise<void> {
    await app.register(swagger, {
      openapi: {
        info: {
          title: "Echo English API",
          description: "Listening Speaking V1 backend API",
          version: "0.1.0",
        },
        servers: [
          {
            url: "http://127.0.0.1:3000",
            description: "Local development",
          },
        ],
        components: {
          securitySchemes: {
            sessionId: {
              type: "apiKey",
              in: "header",
              name: "x-session-id",
            },
          },
        },
      },
    });

    await app.register(swaggerUi, {
      routePrefix: "/docs",
      uiConfig: {
        docExpansion: "list",
        deepLinking: true,
      },
      staticCSP: true,
      transformStaticCSP: (header) => header,
    });
  }
}
