import type { FastifyInstance, FastifyRequest } from "fastify";
import { AppError } from "../../domain/AppError.js";
import { EntityIdCodec, type EntityId } from "../../domain/EntityId.js";
import type { AdminService, CurrentAdmin } from "../../services/AdminService.js";
import type { LearningActivationService } from "../../services/LearningActivationService.js";
import { Operation, RouteDocs, Tag } from "../docs/RouteDecorators.js";
import {
  activationAttemptRequestSchema,
  activationAttemptResponseSchema,
  annotationListQuerySchema,
  annotationTaskListResponseSchema,
  annotationTaskRequestSchema,
  annotationTaskResponseSchema,
  annotationTaskReviewRequestSchema,
  assessmentConfigListResponseSchema,
  assessmentConfigRequestSchema,
  assessmentConfigResponseSchema,
  assessmentResultResponseSchema,
  courseListResponseSchema,
  courseListQuerySchema,
  courseReportListQuerySchema,
  courseReportListResponseSchema,
  courseReportRequestSchema,
  courseReportResponseSchema,
  continueLearningQuerySchema,
  continueLearningResponseSchema,
  courseRequestSchema,
  courseResponseSchema,
  createCourseRequestSchema,
  createSceneRequestSchema,
  createSentenceRequestSchema,
  dateQuerySchema,
  dailyTaskResetResponseSchema,
  dailyTaskResponseSchema,
  dailyTaskStrategyListResponseSchema,
  dailyTaskStrategyResponseSchema,
  idParamsSchema,
  listenRepeatAttemptListResponseSchema,
  listenRepeatListQuerySchema,
  listenRepeatAttemptRequestSchema,
  listenRepeatAttemptResponseSchema,
  listQuerySchema,
  practiceRuleListResponseSchema,
  practiceRuleResponseSchema,
  sceneListResponseSchema,
  sceneRequestSchema,
  sceneResponseSchema,
  sentenceListQuerySchema,
  sentenceListResponseSchema,
  sentenceRequestSchema,
  sentenceResponseSchema,
  selfDescriptionSubmitRequestSchema,
  userListQuerySchema,
  userVocabularyCorrectionRequestSchema,
  userVocabularyListResponseSchema,
  userVocabularyResponseSchema,
  versionedRulesRequestSchema,
  versionedConfigListQuerySchema,
  vocabularyOverviewResponseSchema,
} from "../schemas/LearningActivationSchemas.js";

@Tag("learning-activation")
export class LearningActivationRoutes {
  constructor(
    private readonly service: LearningActivationService,
    private readonly adminService: AdminService,
  ) {}

  @Operation("List published scenes")
  listScenes(): void {}
  @Operation("List published courses")
  listCourses(): void {}
  @Operation("List published course sentences")
  listSentences(): void {}
  @Operation("Submit self description assessment")
  submitAssessment(): void {}
  @Operation("Get user vocabulary overview")
  vocabularyOverview(): void {}
  @Operation("Get today task")
  todayTask(): void {}
  @Operation("Get continue learning batch")
  continueLearning(): void {}
  @Operation("Reset today task")
  resetDailyTask(): void {}
  @Operation("Create word activation attempt")
  activationAttempt(): void {}
  @Operation("Create listen-repeat attempt")
  listenRepeatAttempt(): void {}
  @Operation("Create course report")
  courseReport(): void {}

  @Operation("Admin manage v1 module resource")
  adminResource(): void {}

  async register(app: FastifyInstance): Promise<void> {
    app.get("/learning/scenes", { schema: RouteDocs.schema(this, "listScenes", { response: { 200: sceneListResponseSchema } }) }, async () => ({
      items: await this.service.listPublicScenes(),
    }));

    app.get("/learning/courses", { schema: RouteDocs.schema(this, "listCourses", { query: courseListQuerySchema, response: { 200: courseListResponseSchema } }) }, async (request) => {
      const query = courseListQuerySchema.parse(request.query);
      const { sceneId, ...rest } = query;
      const serviceQuery: Parameters<LearningActivationService["listPublicCourses"]>[0] = { ...rest };
      if (sceneId) serviceQuery.sceneId = EntityIdCodec.parse(sceneId);
      return { items: await this.service.listPublicCourses(serviceQuery) };
    });

    app.get("/learning/sentences", { schema: RouteDocs.schema(this, "listSentences", { query: sentenceListQuerySchema, response: { 200: sentenceListResponseSchema } }) }, async (request) => {
      const query = sentenceListQuerySchema.parse(request.query);
      const { courseId, sceneId, ...rest } = query;
      const serviceQuery: Parameters<LearningActivationService["listPublicSentences"]>[0] = { ...rest };
      if (courseId) serviceQuery.courseId = EntityIdCodec.parse(courseId);
      if (sceneId) serviceQuery.sceneId = EntityIdCodec.parse(sceneId);
      return { items: await this.service.listPublicSentences(serviceQuery) };
    });

    app.get("/learning/assessment/active", { schema: RouteDocs.schema(this, "submitAssessment", { response: { 200: assessmentConfigResponseSchema } }) }, async () => this.service.activeAssessment());

    app.post("/learning/assessment/self-description", { schema: RouteDocs.schema(this, "submitAssessment", { body: selfDescriptionSubmitRequestSchema, response: { 201: assessmentResultResponseSchema } }) }, async (request, reply) =>
      reply.status(201).send(await this.service.submitSelfDescription(this.currentUserId(request), selfDescriptionSubmitRequestSchema.parse(request.body))),
    );

    app.get("/learning/vocabulary", { schema: RouteDocs.schema(this, "vocabularyOverview", { response: { 200: vocabularyOverviewResponseSchema } }) }, async (request) => this.service.vocabularyOverview(this.currentUserId(request)));

    app.get("/learning/vocabulary/words", { schema: RouteDocs.schema(this, "vocabularyOverview", { query: userListQuerySchema, response: { 200: userVocabularyListResponseSchema } }) }, async (request) => {
      const query = userListQuerySchema.parse(request.query);
      const serviceQuery = this.userVocabularyQuery(query, this.currentUserId(request));
      return { items: await this.service.listUserVocabulary(serviceQuery) };
    });

    app.get("/learning/daily-task", { schema: RouteDocs.schema(this, "todayTask", { query: dateQuerySchema, response: { 200: dailyTaskResponseSchema } }) }, async (request) => {
      const query = dateQuerySchema.parse(request.query);
      return this.service.todayTask(this.currentUserId(request), query.taskDate ?? new Date().toISOString().slice(0, 10));
    });

    app.get("/learning/continue-learning", { schema: RouteDocs.schema(this, "continueLearning", { query: continueLearningQuerySchema, response: { 200: continueLearningResponseSchema } }) }, async (request) => {
      const query = continueLearningQuerySchema.parse(request.query);
      return this.service.continueLearning(this.currentUserId(request), query);
    });

    app.post("/learning/daily-task/reset", { schema: RouteDocs.schema(this, "resetDailyTask", { query: dateQuerySchema, response: { 200: dailyTaskResetResponseSchema } }) }, async (request) => {
      const query = dateQuerySchema.parse(request.query);
      return this.service.resetDailyTask(this.currentUserId(request), query.taskDate ?? new Date().toISOString().slice(0, 10));
    });

    app.post("/learning/practice/activation-attempts", { schema: RouteDocs.schema(this, "activationAttempt", { body: activationAttemptRequestSchema, response: { 201: activationAttemptResponseSchema } }) }, async (request, reply) =>
      reply.status(201).send(await this.service.createActivationAttempt(this.currentUserId(request), activationAttemptRequestSchema.parse(request.body))),
    );

    app.post("/learning/listen-repeat/attempts", { schema: RouteDocs.schema(this, "listenRepeatAttempt", { body: listenRepeatAttemptRequestSchema, response: { 201: listenRepeatAttemptResponseSchema } }) }, async (request, reply) =>
      reply.status(201).send(await this.service.createListenRepeatAttempt(this.currentUserId(request), listenRepeatAttemptRequestSchema.parse(request.body))),
    );

    app.post("/learning/course-reports", { schema: RouteDocs.schema(this, "courseReport", { body: courseReportRequestSchema, response: { 201: courseReportResponseSchema } }) }, async (request, reply) =>
      reply.status(201).send(await this.service.createCourseReport(this.currentUserId(request), courseReportRequestSchema.parse(request.body))),
    );

    await this.registerAdminRoutes(app);
  }

  private async registerAdminRoutes(app: FastifyInstance): Promise<void> {
    app.get("/admin/corpus/scenes", { schema: RouteDocs.schema(this, "adminResource", { query: listQuerySchema, response: { 200: sceneListResponseSchema } }) }, async (request) => {
      const admin = await this.currentAdmin(request);
      return { items: await this.service.adminListScenes(admin, listQuerySchema.parse(request.query)) };
    });
    app.post("/admin/corpus/scenes", { schema: RouteDocs.schema(this, "adminResource", { body: createSceneRequestSchema, response: { 201: sceneResponseSchema } }) }, async (request, reply) =>
      reply.status(201).send(await this.service.adminCreateScene(await this.currentAdmin(request), createSceneRequestSchema.parse(request.body))),
    );
    app.patch("/admin/corpus/scenes/:id", { schema: RouteDocs.schema(this, "adminResource", { params: idParamsSchema, body: sceneRequestSchema, response: { 200: sceneResponseSchema } }) }, async (request) =>
      this.service.adminUpdateScene(await this.currentAdmin(request), this.paramId(request), sceneRequestSchema.parse(request.body)),
    );

    app.get("/admin/corpus/courses", { schema: RouteDocs.schema(this, "adminResource", { query: courseListQuerySchema, response: { 200: courseListResponseSchema } }) }, async (request) => {
      const query = courseListQuerySchema.parse(request.query);
      const { sceneId, ...rest } = query;
      const serviceQuery: Parameters<LearningActivationService["adminListCourses"]>[1] = { ...rest };
      if (sceneId) serviceQuery.sceneId = EntityIdCodec.parse(sceneId);
      return { items: await this.service.adminListCourses(await this.currentAdmin(request), serviceQuery) };
    });
    app.post("/admin/corpus/courses", { schema: RouteDocs.schema(this, "adminResource", { body: createCourseRequestSchema, response: { 201: courseResponseSchema } }) }, async (request, reply) =>
      reply.status(201).send(await this.service.adminCreateCourse(await this.currentAdmin(request), createCourseRequestSchema.parse(request.body))),
    );
    app.patch("/admin/corpus/courses/:id", { schema: RouteDocs.schema(this, "adminResource", { params: idParamsSchema, body: courseRequestSchema, response: { 200: courseResponseSchema } }) }, async (request) =>
      this.service.adminUpdateCourse(await this.currentAdmin(request), this.paramId(request), courseRequestSchema.parse(request.body)),
    );

    app.get("/admin/corpus/sentences", { schema: RouteDocs.schema(this, "adminResource", { query: sentenceListQuerySchema, response: { 200: sentenceListResponseSchema } }) }, async (request) => {
      const query = sentenceListQuerySchema.parse(request.query);
      const { courseId, sceneId, ...rest } = query;
      const serviceQuery: Parameters<LearningActivationService["adminListSentences"]>[1] = { ...rest };
      if (courseId) serviceQuery.courseId = EntityIdCodec.parse(courseId);
      if (sceneId) serviceQuery.sceneId = EntityIdCodec.parse(sceneId);
      return { items: await this.service.adminListSentences(await this.currentAdmin(request), serviceQuery) };
    });
    app.post("/admin/corpus/sentences", { schema: RouteDocs.schema(this, "adminResource", { body: createSentenceRequestSchema, response: { 201: sentenceResponseSchema } }) }, async (request, reply) =>
      reply.status(201).send(await this.service.adminCreateSentence(await this.currentAdmin(request), createSentenceRequestSchema.parse(request.body))),
    );
    app.patch("/admin/corpus/sentences/:id", { schema: RouteDocs.schema(this, "adminResource", { params: idParamsSchema, body: sentenceRequestSchema, response: { 200: sentenceResponseSchema } }) }, async (request) =>
      this.service.adminUpdateSentence(await this.currentAdmin(request), this.paramId(request), sentenceRequestSchema.parse(request.body)),
    );

    app.get("/admin/annotations/tasks", { schema: RouteDocs.schema(this, "adminResource", { query: annotationListQuerySchema, response: { 200: annotationTaskListResponseSchema } }) }, async (request) => ({
      items: await this.service.adminListAnnotationTasks(await this.currentAdmin(request), this.annotationQuery(annotationListQuerySchema.parse(request.query))),
    }));
    app.post("/admin/annotations/tasks", { schema: RouteDocs.schema(this, "adminResource", { body: annotationTaskRequestSchema, response: { 201: annotationTaskResponseSchema } }) }, async (request, reply) =>
      reply.status(201).send(await this.service.adminCreateAnnotationTask(await this.currentAdmin(request), annotationTaskRequestSchema.parse(request.body))),
    );
    app.post("/admin/annotations/tasks/:id/review", { schema: RouteDocs.schema(this, "adminResource", { params: idParamsSchema, body: annotationTaskReviewRequestSchema, response: { 200: annotationTaskResponseSchema } }) }, async (request) =>
      this.service.adminReviewAnnotationTask(await this.currentAdmin(request), this.paramId(request), annotationTaskReviewRequestSchema.parse(request.body)),
    );

    app.get("/admin/assessment/configs", { schema: RouteDocs.schema(this, "adminResource", { query: versionedConfigListQuerySchema, response: { 200: assessmentConfigListResponseSchema } }) }, async (request) => ({
      items: await this.service.adminListAssessmentConfigs(await this.currentAdmin(request), versionedConfigListQuerySchema.parse(request.query)),
    }));
    app.post("/admin/assessment/configs", { schema: RouteDocs.schema(this, "adminResource", { body: assessmentConfigRequestSchema, response: { 201: assessmentConfigResponseSchema } }) }, async (request, reply) =>
      reply.status(201).send(await this.service.adminCreateAssessmentConfig(await this.currentAdmin(request), assessmentConfigRequestSchema.parse(request.body))),
    );

    app.get("/admin/user-vocabulary/words", { schema: RouteDocs.schema(this, "adminResource", { query: userListQuerySchema, response: { 200: userVocabularyListResponseSchema } }) }, async (request) => {
      await this.currentAdmin(request);
      const query = userListQuerySchema.parse(request.query);
      return { items: await this.service.listUserVocabulary(this.userVocabularyQuery(query, query.userId ?? this.currentUserId(request))) };
    });
    app.post("/admin/user-vocabulary/corrections", { schema: RouteDocs.schema(this, "adminResource", { body: userVocabularyCorrectionRequestSchema, response: { 200: userVocabularyResponseSchema } }) }, async (request) =>
      this.service.adminCorrectUserVocabulary(await this.currentAdmin(request), userVocabularyCorrectionRequestSchema.parse(request.body)),
    );

    app.get("/admin/practice/rules", { schema: RouteDocs.schema(this, "adminResource", { query: versionedConfigListQuerySchema, response: { 200: practiceRuleListResponseSchema } }) }, async (request) => ({
      items: await this.service.adminListPracticeRules(await this.currentAdmin(request), versionedConfigListQuerySchema.parse(request.query)),
    }));
    app.post("/admin/practice/rules", { schema: RouteDocs.schema(this, "adminResource", { body: versionedRulesRequestSchema, response: { 201: practiceRuleResponseSchema } }) }, async (request, reply) =>
      reply.status(201).send(await this.service.adminCreatePracticeRule(await this.currentAdmin(request), versionedRulesRequestSchema.parse(request.body))),
    );

    app.get("/admin/daily-tasks/strategies", { schema: RouteDocs.schema(this, "adminResource", { query: versionedConfigListQuerySchema, response: { 200: dailyTaskStrategyListResponseSchema } }) }, async (request) => ({
      items: await this.service.adminListDailyTaskStrategies(await this.currentAdmin(request), versionedConfigListQuerySchema.parse(request.query)),
    }));
    app.post("/admin/daily-tasks/strategies", { schema: RouteDocs.schema(this, "adminResource", { body: versionedRulesRequestSchema, response: { 201: dailyTaskStrategyResponseSchema } }) }, async (request, reply) =>
      reply.status(201).send(await this.service.adminCreateDailyTaskStrategy(await this.currentAdmin(request), versionedRulesRequestSchema.parse(request.body))),
    );

    app.get("/admin/listen-repeat/attempts", { schema: RouteDocs.schema(this, "adminResource", { query: listenRepeatListQuerySchema, response: { 200: listenRepeatAttemptListResponseSchema } }) }, async (request) => {
      const query = listenRepeatListQuerySchema.parse(request.query);
      return { items: await this.service.adminListListenRepeat(await this.currentAdmin(request), this.listenRepeatQuery(query)) };
    });

    app.get("/admin/course-reports", { schema: RouteDocs.schema(this, "adminResource", { query: courseReportListQuerySchema, response: { 200: courseReportListResponseSchema } }) }, async (request) => {
      const query = courseReportListQuerySchema.parse(request.query);
      return { items: await this.service.adminListCourseReports(await this.currentAdmin(request), this.courseReportQuery(query)) };
    });
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

  private currentUserId(request: FastifyRequest): string {
    const value = request.headers["x-session-id"];
    const sessionId = Array.isArray(value) ? value[0] : value;
    if (!sessionId) throw new AppError("unauthorized", "User session is required");
    return sessionId;
  }

  private paramId(request: FastifyRequest): EntityId {
    return EntityIdCodec.parse(idParamsSchema.parse(request.params).id);
  }

  private userVocabularyQuery(query: ReturnType<typeof userListQuerySchema.parse>, userId: string): Parameters<LearningActivationService["listUserVocabulary"]>[0] {
    const output: Parameters<LearningActivationService["listUserVocabulary"]>[0] = {
      dueOnly: query.dueOnly,
      limit: query.limit,
      offset: query.offset,
      skipCountMin: query.skipCountMin,
      source: query.source,
      status: query.status,
      userId,
    };
    if (query.wordId) output.wordId = EntityIdCodec.parse(query.wordId);
    return output;
  }

  private annotationQuery(query: ReturnType<typeof annotationListQuerySchema.parse>): Parameters<LearningActivationService["adminListAnnotationTasks"]>[1] {
    const { targetId, ...rest } = query;
    const output: Parameters<LearningActivationService["adminListAnnotationTasks"]>[1] = { ...rest };
    if (targetId) output.targetId = EntityIdCodec.parse(targetId);
    return output;
  }

  private listenRepeatQuery(query: ReturnType<typeof listenRepeatListQuerySchema.parse>): Parameters<LearningActivationService["adminListListenRepeat"]>[1] {
    const { sentenceId, ...rest } = query;
    const output: Parameters<LearningActivationService["adminListListenRepeat"]>[1] = { ...rest };
    if (sentenceId) output.sentenceId = EntityIdCodec.parse(sentenceId);
    return output;
  }

  private courseReportQuery(query: ReturnType<typeof courseReportListQuerySchema.parse>): Parameters<LearningActivationService["adminListCourseReports"]>[1] {
    const { courseId, ...rest } = query;
    const output: Parameters<LearningActivationService["adminListCourseReports"]>[1] = { ...rest };
    if (courseId) output.courseId = EntityIdCodec.parse(courseId);
    return output;
  }
}
