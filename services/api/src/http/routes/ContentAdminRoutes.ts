import type { FastifyInstance, FastifyRequest } from "fastify";
import { AppError } from "../../domain/AppError.js";
import { EntityIdCodec, type EntityId } from "../../domain/EntityId.js";
import type { AdminService, CurrentAdmin } from "../../services/AdminService.js";
import type { ContentAdminService } from "../../services/ContentAdminService.js";
import { Operation, RouteDocs, Tag } from "../docs/RouteDecorators.js";
import {
  contentAnyResponseSchema,
  contentBatchStatusRequestSchema,
  contentCompositionRequestSchema,
  contentIdParamsSchema,
  contentImportParamsSchema,
  contentImportRequestSchema,
  contentListQuerySchema,
  contentListResponseSchema,
  contentCourseRequestSchema,
  contentSceneRequestSchema,
  contentSentenceRequestSchema,
  createContentCourseRequestSchema,
  createContentSceneRequestSchema,
  createContentSentenceRequestSchema,
  defaultAudioRequestSchema,
  publishRequestSchema,
  publishValidationRequestSchema,
} from "../schemas/ContentAdminSchemas.js";

@Tag("content-admin")
export class ContentAdminRoutes {
  constructor(
    private readonly service: ContentAdminService,
    private readonly adminService: AdminService,
  ) {}

  @Operation("Content admin summary")
  summary(): void {}
  @Operation("Content admin resource")
  resource(): void {}
  @Operation("Content admin batch status")
  batchStatus(): void {}
  @Operation("Content admin course composition")
  composition(): void {}
  @Operation("Content admin import validation")
  importValidation(): void {}
  @Operation("Content admin default audio")
  defaultAudio(): void {}
  @Operation("Content admin publishing validation")
  publishingValidation(): void {}

  async register(app: FastifyInstance): Promise<void> {
    app.get("/admin/content/summary", { schema: RouteDocs.schema(this, "summary", { response: { 200: contentAnyResponseSchema } }) }, async (request) => this.service.summary(await this.currentAdmin(request)));

    app.get("/admin/content/scenes", { schema: RouteDocs.schema(this, "resource", { query: contentListQuerySchema, response: { 200: contentListResponseSchema } }) }, async (request) => ({
      items: await this.service.listScenes(await this.currentAdmin(request), this.contentQuery(contentListQuerySchema.parse(request.query))),
    }));
    app.get("/admin/content/scenes/:id", { schema: RouteDocs.schema(this, "resource", { params: contentIdParamsSchema, response: { 200: contentAnyResponseSchema } }) }, async (request) =>
      this.service.getScene(await this.currentAdmin(request), this.paramId(request)),
    );
    app.post("/admin/content/scenes", { schema: RouteDocs.schema(this, "resource", { body: createContentSceneRequestSchema, response: { 201: contentAnyResponseSchema } }) }, async (request, reply) =>
      reply.status(201).send(await this.service.createScene(await this.currentAdmin(request), createContentSceneRequestSchema.parse(request.body))),
    );
    app.patch("/admin/content/scenes/:id", { schema: RouteDocs.schema(this, "resource", { params: contentIdParamsSchema, body: contentSceneRequestSchema, response: { 200: contentAnyResponseSchema } }) }, async (request) =>
      this.service.updateScene(await this.currentAdmin(request), this.paramId(request), contentSceneRequestSchema.parse(request.body)),
    );

    app.get("/admin/content/courses", { schema: RouteDocs.schema(this, "resource", { query: contentListQuerySchema, response: { 200: contentListResponseSchema } }) }, async (request) => {
      const query = contentListQuerySchema.parse(request.query);
      const { level, ...rest } = query;
      return { items: await this.service.listCourses(await this.currentAdmin(request), { ...this.contentQuery(rest), level }) };
    });
    app.get("/admin/content/courses/:id", { schema: RouteDocs.schema(this, "resource", { params: contentIdParamsSchema, response: { 200: contentAnyResponseSchema } }) }, async (request) =>
      this.service.getCourse(await this.currentAdmin(request), this.paramId(request)),
    );
    app.post("/admin/content/courses", { schema: RouteDocs.schema(this, "resource", { body: createContentCourseRequestSchema, response: { 201: contentAnyResponseSchema } }) }, async (request, reply) =>
      reply.status(201).send(await this.service.createCourse(await this.currentAdmin(request), createContentCourseRequestSchema.parse(request.body))),
    );
    app.patch("/admin/content/courses/:id", { schema: RouteDocs.schema(this, "resource", { params: contentIdParamsSchema, body: contentCourseRequestSchema, response: { 200: contentAnyResponseSchema } }) }, async (request) =>
      this.service.updateCourse(await this.currentAdmin(request), this.paramId(request), contentCourseRequestSchema.parse(request.body)),
    );

    app.get("/admin/content/sentences", { schema: RouteDocs.schema(this, "resource", { query: contentListQuerySchema, response: { 200: contentListResponseSchema } }) }, async (request) => ({
      items: await this.service.listSentences(await this.currentAdmin(request), this.contentQuery(contentListQuerySchema.parse(request.query))),
    }));
    app.get("/admin/content/sentences/:id", { schema: RouteDocs.schema(this, "resource", { params: contentIdParamsSchema, response: { 200: contentAnyResponseSchema } }) }, async (request) =>
      this.service.getSentence(await this.currentAdmin(request), this.paramId(request)),
    );
    app.post("/admin/content/sentences", { schema: RouteDocs.schema(this, "resource", { body: createContentSentenceRequestSchema, response: { 201: contentAnyResponseSchema } }) }, async (request, reply) =>
      reply.status(201).send(await this.service.createSentence(await this.currentAdmin(request), createContentSentenceRequestSchema.parse(request.body))),
    );
    app.patch("/admin/content/sentences/:id", { schema: RouteDocs.schema(this, "resource", { params: contentIdParamsSchema, body: contentSentenceRequestSchema, response: { 200: contentAnyResponseSchema } }) }, async (request) =>
      this.service.updateSentence(await this.currentAdmin(request), this.paramId(request), contentSentenceRequestSchema.parse(request.body)),
    );

    app.post("/admin/content/status/batch", { schema: RouteDocs.schema(this, "batchStatus", { body: contentBatchStatusRequestSchema, response: { 200: contentAnyResponseSchema } }) }, async (request) =>
      this.service.batchStatus(await this.currentAdmin(request), contentBatchStatusRequestSchema.parse(request.body)),
    );
    app.post("/admin/content/courses/:id/composition", { schema: RouteDocs.schema(this, "composition", { params: contentIdParamsSchema, body: contentCompositionRequestSchema, response: { 200: contentAnyResponseSchema } }) }, async (request) =>
      this.service.saveComposition(await this.currentAdmin(request), this.paramId(request), contentCompositionRequestSchema.parse(request.body)),
    );
    app.post("/admin/content/imports/validate", { schema: RouteDocs.schema(this, "importValidation", { body: contentImportRequestSchema, response: { 200: contentAnyResponseSchema } }) }, async (request) =>
      this.service.validateImport(await this.currentAdmin(request), contentImportRequestSchema.parse(request.body)),
    );
    app.post("/admin/content/imports/confirm", { schema: RouteDocs.schema(this, "importValidation", { body: contentImportRequestSchema, response: { 200: contentAnyResponseSchema } }) }, async (request) =>
      this.service.confirmImport(await this.currentAdmin(request), contentImportRequestSchema.parse(request.body)),
    );
    app.get("/admin/content/imports/:importBatchId", { schema: RouteDocs.schema(this, "importValidation", { params: contentImportParamsSchema, response: { 200: contentAnyResponseSchema } }) }, async (request) =>
      this.service.importResult(await this.currentAdmin(request), contentImportParamsSchema.parse(request.params).importBatchId),
    );
    app.get("/admin/content/imports/:importBatchId/failures", { schema: RouteDocs.schema(this, "importValidation", { params: contentImportParamsSchema }) }, async (request, reply) => {
      const csv = await this.service.importFailureCsv(await this.currentAdmin(request), contentImportParamsSchema.parse(request.params).importBatchId);
      return reply.header("content-type", "text/csv; charset=utf-8").send(csv);
    });

    app.get("/admin/content/audio/default", { schema: RouteDocs.schema(this, "defaultAudio", { response: { 200: contentAnyResponseSchema } }) }, async (request) => this.service.defaultAudio(await this.currentAdmin(request)));
    app.put("/admin/content/audio/default", { schema: RouteDocs.schema(this, "defaultAudio", { body: defaultAudioRequestSchema, response: { 200: contentAnyResponseSchema } }) }, async (request) =>
      this.service.updateDefaultAudio(await this.currentAdmin(request), defaultAudioRequestSchema.parse(request.body)),
    );
    app.get("/admin/content/publishing/validation", { schema: RouteDocs.schema(this, "publishingValidation", { response: { 200: contentAnyResponseSchema } }) }, async (request) => this.service.validateAll(await this.currentAdmin(request)));
    app.post("/admin/content/publishing/validation", { schema: RouteDocs.schema(this, "publishingValidation", { body: publishValidationRequestSchema, response: { 200: contentAnyResponseSchema } }) }, async (request) =>
      this.service.validateTarget(await this.currentAdmin(request), publishValidationRequestSchema.parse(request.body)),
    );
    app.post("/admin/content/publishing/publish", { schema: RouteDocs.schema(this, "publishingValidation", { body: publishRequestSchema, response: { 200: contentAnyResponseSchema } }) }, async (request) =>
      this.service.publishTarget(await this.currentAdmin(request), publishRequestSchema.parse(request.body)),
    );
  }

  private async currentAdmin(request: FastifyRequest): Promise<CurrentAdmin> {
    return this.adminService.requireSession(this.readAdminSessionId(request));
  }

  private readAdminSessionId(request: FastifyRequest): EntityId {
    const value = request.headers["x-admin-session-id"];
    const sessionId = Array.isArray(value) ? value[0] : value;
    if (!sessionId) throw new AppError("unauthorized", "Admin session is required");
    return EntityIdCodec.parse(sessionId);
  }

  private paramId(request: FastifyRequest): EntityId {
    return EntityIdCodec.parse(contentIdParamsSchema.parse(request.params).id);
  }

  private contentQuery(query: ReturnType<typeof contentListQuerySchema.parse>): Parameters<ContentAdminService["listSentences"]>[1] {
    const { courseId, sceneId, ...rest } = query;
    const output: Parameters<ContentAdminService["listSentences"]>[1] = { ...rest };
    if (courseId) output.courseId = EntityIdCodec.parse(courseId);
    if (sceneId) output.sceneId = EntityIdCodec.parse(sceneId);
    return output;
  }
}
