import type { FastifyInstance, FastifyRequest } from "fastify";
import { AppError } from "../../domain/AppError.js";
import { EntityIdCodec, type EntityId } from "../../domain/EntityId.js";
import type { AdminService, CurrentAdmin } from "../../services/AdminService.js";
import type { WordLibraryService } from "../../services/WordLibraryService.js";
import { Operation, RouteDocs, Tag } from "../docs/RouteDecorators.js";
import {
  createWordEntryBodySchema,
  createWordsFromSubtlexusBodySchema,
  createWordsFromSubtlexusResponseSchema,
  applyWordMetaBodySchema,
  publicWordListQuerySchema,
  publicWordMetaListResponseSchema,
  importDictionaryApiBodySchema,
  importDictionaryApiResponseSchema,
  subtlexusWordListQuerySchema,
  subtlexusWordListResponseSchema,
  adminWordListResponseSchema,
  adminWordResponseSchema,
  publicWordListResponseSchema,
  wordMetaListQuerySchema,
  wordMetaListResponseSchema,
  wordEntryBodySchema,
  wordFrequencyImportResponseSchema,
  wordFrequencyImportQuerySchema,
  wordListQuerySchema,
  wordParamsSchema,
  wordPublishBodySchema,
} from "../schemas/WordLibrarySchemas.js";

@Tag("word-library")
export class WordLibraryRoutes {
  constructor(
    private readonly wordLibraryService: WordLibraryService,
    private readonly adminService: AdminService,
  ) {}

  @Operation("List published word entries")
  listPublished(): void {}

  @Operation("List public word metadata")
  listWordMeta(): void {}

  @Operation("Admin list word entries")
  adminList(): void {}

  @Operation("Admin list SUBTLEXus source words")
  adminListSubtlexusWords(): void {}

  @Operation("Admin list word metadata")
  adminListWordMeta(): void {}

  @Operation("Admin create word entry")
  adminCreate(): void {}

  @Operation("Admin update word entry")
  adminUpdate(): void {}

  @Operation("Admin update word publish status")
  adminPublish(): void {}

  @Operation("Admin import SUBTLEXus frequency workbook")
  adminImportSubtlex(): void {}

  @Operation("Admin create learning word entries from SUBTLEXus source")
  adminCreateWordsFromSubtlexus(): void {}

  @Operation("Admin import DictionaryAPI word metadata")
  adminImportDictionaryApi(): void {}

  @Operation("Admin apply DictionaryAPI metadata to word entry")
  adminApplyDictionaryApiMeta(): void {}

  async register(app: FastifyInstance): Promise<void> {
    app.get(
      "/word-library/words",
      { schema: RouteDocs.schema(this, "listPublished", { query: publicWordListQuerySchema, response: { 200: publicWordListResponseSchema } }) },
      async (request) => {
        const query = publicWordListQuerySchema.parse(request.query);
        return { items: await this.wordLibraryService.listPublished(query.limit, query.offset, query.difficultyLevel) };
      },
    );

    app.get(
      "/word-library/word-meta",
      { schema: RouteDocs.schema(this, "listWordMeta", { query: wordMetaListQuerySchema, response: { 200: publicWordMetaListResponseSchema } }) },
      async (request) => {
        const query = wordMetaListQuerySchema.parse(request.query);
        return {
          items: await this.wordLibraryService.listWordMeta({
            ...query,
            wordId: query.wordId ? EntityIdCodec.parse(query.wordId) : undefined,
          }),
        };
      },
    );

    app.get(
      "/admin/word-library/words",
      { schema: RouteDocs.schema(this, "adminList", { query: wordListQuerySchema, response: { 200: adminWordListResponseSchema } }) },
      async (request) => {
        const admin = await this.currentAdmin(request);
        const query = wordListQuerySchema.parse(request.query);
        return { items: await this.wordLibraryService.adminList(admin, query) };
      },
    );

    app.get(
      "/admin/word-library/subtlexus-words",
      { schema: RouteDocs.schema(this, "adminListSubtlexusWords", { query: subtlexusWordListQuerySchema, response: { 200: subtlexusWordListResponseSchema } }) },
      async (request) => {
        const admin = await this.currentAdmin(request);
        const query = subtlexusWordListQuerySchema.parse(request.query);
        return { items: await this.wordLibraryService.adminListSubtlexusWords(admin, query) };
      },
    );

    app.get(
      "/admin/word-library/word-meta",
      { schema: RouteDocs.schema(this, "adminListWordMeta", { query: wordMetaListQuerySchema, response: { 200: wordMetaListResponseSchema } }) },
      async (request) => {
        const admin = await this.currentAdmin(request);
        const query = wordMetaListQuerySchema.parse(request.query);
        return {
          items: await this.wordLibraryService.adminListWordMeta(admin, {
            ...query,
            wordId: query.wordId ? EntityIdCodec.parse(query.wordId) : undefined,
          }),
        };
      },
    );

    app.post(
      "/admin/word-library/words",
      { schema: RouteDocs.schema(this, "adminCreate", { body: createWordEntryBodySchema, response: { 201: adminWordResponseSchema } }) },
      async (request, reply) => {
        const admin = await this.currentAdmin(request);
        const body = createWordEntryBodySchema.parse(request.body);
        return reply.status(201).send(await this.wordLibraryService.adminCreate(admin, body));
      },
    );

    app.patch(
      "/admin/word-library/words/:id",
      { schema: RouteDocs.schema(this, "adminUpdate", { params: wordParamsSchema, body: wordEntryBodySchema, response: { 200: adminWordResponseSchema } }) },
      async (request) => {
        const admin = await this.currentAdmin(request);
        const { id } = wordParamsSchema.parse(request.params);
        const body = wordEntryBodySchema.parse(request.body);
        return this.wordLibraryService.adminUpdate(admin, EntityIdCodec.parse(id), body);
      },
    );

    app.post(
      "/admin/word-library/words/:id/publish",
      { schema: RouteDocs.schema(this, "adminPublish", { params: wordParamsSchema, body: wordPublishBodySchema, response: { 200: adminWordResponseSchema } }) },
      async (request) => {
        const admin = await this.currentAdmin(request);
        const { id } = wordParamsSchema.parse(request.params);
        const body = wordPublishBodySchema.parse(request.body);
        return this.wordLibraryService.adminSetPublishStatus(admin, EntityIdCodec.parse(id), body.publishStatus, body.reason);
      },
    );

    app.post(
      "/admin/word-library/imports/subtlexus",
      {
        schema: {
          ...RouteDocs.schema(this, "adminImportSubtlex", { response: { 200: wordFrequencyImportResponseSchema } }),
          consumes: ["multipart/form-data"],
          querystring: {
            type: "object",
            properties: {
              dryRun: { type: "boolean", default: false },
              limit: { type: "integer", minimum: 1, maximum: 100000 },
              reason: { type: "string", minLength: 1 },
            },
          },
          body: {
            type: "object",
            properties: {
              file: {
                type: "object",
                description: "SUBTLEXus .xls or .xlsx workbook. Multipart field name must be `file`.",
                properties: {
                  filename: { type: "string" },
                  mimetype: { type: "string" },
                  encoding: { type: "string" },
                },
                required: ["filename"],
              },
            },
            required: ["file"],
          },
          description: "Upload a SUBTLEXus .xls/.xlsx workbook with multipart/form-data file field named `file`.",
        },
      },
      async (request) => {
        const admin = await this.currentAdmin(request);
        const query = wordFrequencyImportQuerySchema.parse(request.query);
        const file = this.readAttachedMultipartFile(request.body);
        if (!file?.buffer) {
          throw new AppError("validation_failed", "Multipart file field is required");
        }
        return this.wordLibraryService.adminImportSubtlexFrequency(admin, {
          buffer: file.buffer,
          dryRun: query.dryRun,
          fileName: file.filename,
          limit: query.limit,
          reason: query.reason,
        });
      },
    );

    app.post(
      "/admin/word-library/words/from-subtlexus",
      { schema: RouteDocs.schema(this, "adminCreateWordsFromSubtlexus", { body: createWordsFromSubtlexusBodySchema, response: { 200: createWordsFromSubtlexusResponseSchema } }) },
      async (request) => {
        const admin = await this.currentAdmin(request);
        const body = createWordsFromSubtlexusBodySchema.parse(request.body);
        return this.wordLibraryService.adminCreateWordsFromSubtlexus(admin, body);
      },
    );

    app.post(
      "/admin/word-library/imports/dictionaryapi",
      { schema: RouteDocs.schema(this, "adminImportDictionaryApi", { body: importDictionaryApiBodySchema, response: { 200: importDictionaryApiResponseSchema } }) },
      async (request) => {
        const admin = await this.currentAdmin(request);
        const body = importDictionaryApiBodySchema.parse(request.body);
        return this.wordLibraryService.adminImportDictionaryApiMeta(admin, body);
      },
    );

    app.post(
      "/admin/word-library/word-meta/:id/apply",
      { schema: RouteDocs.schema(this, "adminApplyDictionaryApiMeta", { params: wordParamsSchema, body: applyWordMetaBodySchema, response: { 200: adminWordResponseSchema } }) },
      async (request) => {
        const admin = await this.currentAdmin(request);
        const { id } = wordParamsSchema.parse(request.params);
        const body = applyWordMetaBodySchema.parse(request.body);
        return this.wordLibraryService.adminApplyDictionaryMeta(admin, EntityIdCodec.parse(id), body);
      },
    );
  }

  private async currentAdmin(request: FastifyRequest): Promise<CurrentAdmin> {
    return this.adminService.requireSession(this.readSessionId(request));
  }

  private readSessionId(request: FastifyRequest): EntityId {
    const value = request.headers["x-admin-session-id"];
    const sessionId = Array.isArray(value) ? value[0] : value;
    if (!sessionId) {
      throw new AppError("unauthorized", "Admin session is required");
    }
    return EntityIdCodec.parse(sessionId);
  }

  private readAttachedMultipartFile(body: unknown): { buffer: Buffer; filename: string } | undefined {
    const candidate = body && typeof body === "object" && "file" in body ? (body as { file?: unknown }).file : undefined;
    if (!candidate || typeof candidate !== "object") {
      return undefined;
    }
    const file = candidate as { filename?: unknown; _buf?: unknown; value?: unknown };
    const filename = typeof file.filename === "string" ? file.filename : "upload.xls";
    if (Buffer.isBuffer(file._buf)) {
      return { buffer: file._buf, filename };
    }
    if (Buffer.isBuffer(file.value)) {
      return { buffer: file.value, filename };
    }
    return undefined;
  }
}
