import type { FastifyInstance } from "fastify";
import { EntityIdCodec } from "../../domain/EntityId.js";
import { Operation, RouteDocs, Tag } from "../docs/RouteDecorators.js";
import { unitIdParamsSchema } from "../schemas/CommonSchemas.js";
import {
  autoSyncResponseSchema,
  createContentUnitRequestSchema,
  createContentUnitResponseSchema,
  importBbcRequestSchema,
  importBbcResponseSchema,
} from "../schemas/ContentSchemas.js";
import type { ContentService } from "../../services/ContentService.js";

@Tag("admin-content")
export class ContentRoutes {
  constructor(private readonly contentService: ContentService) {}

  @Operation("Create a content unit draft")
  createDraft(): void {}

  @Operation("Import a BBC URL as internal review draft")
  importBbc(): void {}

  @Operation("Publish a content unit after validation")
  publish(): void {}

  @Operation("Auto sync transcript segments with audio")
  autoSync(): void {}

  async register(app: FastifyInstance): Promise<void> {
    app.post(
      "/admin/content-units",
      {
        schema: RouteDocs.schema(this, "createDraft", {
          body: createContentUnitRequestSchema,
          response: { 201: createContentUnitResponseSchema },
        }),
      },
      async (request, reply) => {
        const input = createContentUnitRequestSchema.parse(request.body);
        const result = await this.contentService.createDraft({
          ...input,
          transcriptSegments: input.transcriptSegments?.map((segment) => ({
            ...segment,
            segmentId: segment.segmentId ? EntityIdCodec.parse(segment.segmentId) : undefined,
          })),
          targetSentences: input.targetSentences?.map((target) => ({
            ...target,
            targetSentenceId: target.targetSentenceId ? EntityIdCodec.parse(target.targetSentenceId) : undefined,
            segmentId: EntityIdCodec.parse(target.segmentId),
          })),
          speakingPrompts: input.speakingPrompts?.map((prompt) => ({
            ...prompt,
            speakingPromptId: prompt.speakingPromptId ? EntityIdCodec.parse(prompt.speakingPromptId) : undefined,
          })),
        });
        return reply.status(201).send(result);
      },
    );

    app.post(
      "/admin/content-units/import-bbc",
      {
        schema: RouteDocs.schema(this, "importBbc", {
          body: importBbcRequestSchema,
          response: { 202: importBbcResponseSchema },
        }),
      },
      async (request, reply) => {
        const input = importBbcRequestSchema.parse(request.body);
        const result = await this.contentService.importBbcUrl(input.sourceUrl);
        return reply.status(202).send(result);
      },
    );

    app.post(
      "/admin/content-units/:unitId/publish",
      {
        schema: RouteDocs.schema(this, "publish", {
          params: unitIdParamsSchema,
        }),
      },
      async (request, reply) => {
        const { unitId } = unitIdParamsSchema.parse(request.params);
        await this.contentService.publish(EntityIdCodec.parse(unitId));
        return reply.status(204).send();
      },
    );

    app.post(
      "/admin/content-units/:unitId/auto-sync",
      {
        schema: RouteDocs.schema(this, "autoSync", {
          params: unitIdParamsSchema,
          response: { 202: autoSyncResponseSchema },
        }),
      },
      async (request, reply) => {
        const { unitId } = unitIdParamsSchema.parse(request.params);
        const parsedUnitId = EntityIdCodec.parse(unitId);
        await this.contentService.autoSync(parsedUnitId);
        return reply.status(202).send({ unitId: EntityIdCodec.stringify(parsedUnitId) });
      },
    );
  }
}
