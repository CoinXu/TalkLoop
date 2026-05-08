import { AppError } from "../domain/AppError.js";
import { EntityIdCodec, type EntityId } from "../domain/EntityId.js";
import type {
  AnnotationResultRow,
  AnnotationTaskRow,
  AssessmentItemRow,
  AssessmentSessionRow,
  AssessmentWordRow,
  CourseReportRow,
  CourseRow,
  DailyTaskRow,
  LearningActivationRepository,
  ListenRepeatAttemptRow,
  SceneRow,
  SentenceRow,
  UserVocabularyEntryRow,
  UserVocabularyWithWordRow,
  WordRow,
} from "../repositories/LearningActivationRepository.js";
import type { AdminService, CurrentAdmin } from "./AdminService.js";

export type JsonRecord = Record<string, unknown>;

type ContinueLearningPrioritySource = "due_review" | "yellow_consolidation" | "red_activation" | "next_unlocked_batch";

interface ContinueLearningCandidate {
  practiceType: "audio_meaning" | "review";
  prioritySource: ContinueLearningPrioritySource;
  row: UserVocabularyWithWordRow;
}

interface AssessmentBand {
  key: string;
  difficultyLevel: number;
  estimate: number;
  maxLg10wf: number;
  minLg10wf: number;
}

interface AssessmentRoundSummary extends JsonRecord {
  bandKey: string;
  correctCount: number;
  questionCount: number;
  recognitionRate: number;
  roundIndex: number;
}

export class LearningActivationService {
  constructor(
    private readonly repository: LearningActivationRepository,
    private readonly adminService: AdminService,
  ) {}

  async listPublicScenes(): Promise<JsonRecord[]> {
    return (await this.repository.listPublicScenes()).map((row) => this.scene(row));
  }

  async listPublicCourses(query: { sceneId?: EntityId | undefined; level?: number | undefined; limit: number; offset: number }): Promise<JsonRecord[]> {
    const courses = await this.repository.listCourses({ ...query, publishStatus: "published" });
    return Promise.all(courses.map((row, index) => this.courseWithUnlock(row, query.offset + index)));
  }

  async listPublicSentences(query: Omit<Parameters<LearningActivationRepository["listSentences"]>[0], "publishStatus" | "reviewStatus">): Promise<JsonRecord[]> {
    const rows = await this.repository.listSentences({ ...query, publishStatus: "published", reviewStatus: "approved" });
    return rows.filter((row) => this.isSentenceConsumable(row)).map((row) => this.sentence(row));
  }

  async adminListScenes(admin: CurrentAdmin, query: Parameters<LearningActivationRepository["listScenes"]>[0]): Promise<JsonRecord[]> {
    this.adminService.assertPermission(admin, "admin.corpus.write");
    return (await this.repository.listScenes(query)).map((row) => this.scene(row));
  }

  async adminCreateScene(admin: CurrentAdmin, input: JsonRecord): Promise<JsonRecord> {
    this.adminService.assertPermission(admin, "admin.corpus.write");
    const row = await this.repository.createScene({
      description: stringOrNull(input.description),
      name: requiredString(input.name, "name"),
      publishStatus: enumValue(input.publishStatus, ["draft", "published", "unpublished", "archived"], "draft"),
      slug: slugValue(input.slug, requiredString(input.name, "name")),
      sortOrder: numberValue(input.sortOrder, 0),
      updatedByAdminId: admin.adminUserId,
    });
    await this.audit(admin, "admin.corpus.write", "scene_create", "scene", row.id, undefined, this.scene(row), stringOrUndefined(input.reason));
    return this.scene(row);
  }

  async adminUpdateScene(admin: CurrentAdmin, id: EntityId, input: JsonRecord): Promise<JsonRecord> {
    this.adminService.assertPermission(admin, "admin.corpus.write");
    const patch = pickDefined({
      description: nullableString(input.description),
      name: optionalString(input.name),
      publishStatus: optionalEnum(input.publishStatus, ["draft", "published", "unpublished", "archived"]),
      slug: input.slug === undefined ? undefined : slugValue(input.slug, String(input.name ?? "scene")),
      sortOrder: optionalNumber(input.sortOrder),
      updatedByAdminId: admin.adminUserId,
    });
    const result = await this.repository.updateScene(id, patch as Parameters<LearningActivationRepository["updateScene"]>[1]);
    if (!result?.after) throw new AppError("not_found", "Scene not found");
    await this.audit(admin, "admin.corpus.write", "scene_update", "scene", id, this.scene(result.before), this.scene(result.after), stringOrUndefined(input.reason));
    return this.scene(result.after);
  }

  async adminListCourses(admin: CurrentAdmin, query: Parameters<LearningActivationRepository["listCourses"]>[0]): Promise<JsonRecord[]> {
    this.adminService.assertPermission(admin, "admin.corpus.write");
    return Promise.all((await this.repository.listCourses(query)).map((row) => this.courseWithValidation(row)));
  }

  async adminCreateCourse(admin: CurrentAdmin, input: JsonRecord): Promise<JsonRecord> {
    this.adminService.assertPermission(admin, "admin.corpus.write");
    const row = await this.repository.createCourse({
      description: stringOrNull(input.description),
      level: numberValue(input.level, 1),
      maxSentenceCount: numberValue(input.maxSentenceCount, 12),
      minSentenceCount: numberValue(input.minSentenceCount, 8),
      needsRevalidation: false,
      publishStatus: enumValue(input.publishStatus, ["draft", "published", "unpublished", "archived"], "draft"),
      sceneId: EntityIdCodec.parse(requiredString(input.sceneId, "sceneId")),
      slug: slugValue(input.slug, requiredString(input.title, "title")),
      sortOrder: numberValue(input.sortOrder, 0),
      title: requiredString(input.title, "title"),
      unlockPolicy: recordValue(input.unlockPolicy, { type: "previous_course_completed" }),
      updatedByAdminId: admin.adminUserId,
    });
    await this.audit(admin, "admin.corpus.write", "course_create", "course", row.id, undefined, await this.courseWithValidation(row), stringOrUndefined(input.reason));
    return this.courseWithValidation(row);
  }

  async adminUpdateCourse(admin: CurrentAdmin, id: EntityId, input: JsonRecord): Promise<JsonRecord> {
    this.adminService.assertPermission(admin, "admin.corpus.write");
    if (input.publishStatus === "published") await this.assertCoursePublishable(id);
    const patch = pickDefined({
      description: nullableString(input.description),
      level: optionalNumber(input.level),
      maxSentenceCount: optionalNumber(input.maxSentenceCount),
      minSentenceCount: optionalNumber(input.minSentenceCount),
      needsRevalidation: true,
      publishStatus: optionalEnum(input.publishStatus, ["draft", "published", "unpublished", "archived"]),
      sceneId: input.sceneId === undefined ? undefined : EntityIdCodec.parse(requiredString(input.sceneId, "sceneId")),
      slug: input.slug === undefined ? undefined : slugValue(input.slug, String(input.title ?? "course")),
      sortOrder: optionalNumber(input.sortOrder),
      title: optionalString(input.title),
      unlockPolicy: optionalRecord(input.unlockPolicy),
      updatedByAdminId: admin.adminUserId,
    });
    const result = await this.repository.updateCourse(id, patch as Parameters<LearningActivationRepository["updateCourse"]>[1]);
    if (!result?.after) throw new AppError("not_found", "Course not found");
    await this.audit(admin, "admin.corpus.write", "course_update", "course", id, await this.courseWithValidation(result.before), await this.courseWithValidation(result.after), stringOrUndefined(input.reason));
    return this.courseWithValidation(result.after);
  }

  async adminListSentences(admin: CurrentAdmin, query: Parameters<LearningActivationRepository["listSentences"]>[0]): Promise<JsonRecord[]> {
    this.adminService.assertPermission(admin, "admin.corpus.write");
    return (await this.repository.listSentences(query)).map((row) => this.sentence(row));
  }

  async adminCreateSentence(admin: CurrentAdmin, input: JsonRecord): Promise<JsonRecord> {
    this.adminService.assertPermission(admin, "admin.corpus.write");
    const row = await this.repository.createSentence({
      audioStatus: enumValue(input.audioStatus, ["missing", "ready", "failed", "default", "unreachable"], "missing"),
      bonusWords: stringArray(input.bonusWords),
      courseId: input.courseId ? EntityIdCodec.parse(requiredString(input.courseId, "courseId")) : null,
      difficultyLevel: numberValue(input.difficultyLevel, 1),
      normalAudioUrl: stringOrNull(input.normalAudioUrl),
      phraseChunks: stringArray(input.phraseChunks),
      importBatchId: stringOrNull(input.importBatchId),
      publishStatus: enumValue(input.publishStatus, ["draft", "published", "unpublished", "archived"], "draft"),
      reviewStatus: enumValue(input.reviewStatus, ["pending_review", "approved", "rejected"], "pending_review"),
      sceneId: input.sceneId ? EntityIdCodec.parse(requiredString(input.sceneId, "sceneId")) : null,
      sceneTags: stringArray(input.sceneTags),
      sentenceText: requiredString(input.sentenceText, "sentenceText"),
      slowAudioUrl: stringOrNull(input.slowAudioUrl),
      sortOrder: numberValue(input.sortOrder, 0),
      targetWords: stringArray(input.targetWords),
      translationCn: stringOrNull(input.translationCn),
      updatedByAdminId: admin.adminUserId,
    });
    await this.audit(admin, "admin.corpus.write", "sentence_create", "sentence", row.id, undefined, this.sentence(row), stringOrUndefined(input.reason));
    return this.sentence(row);
  }

  async adminUpdateSentence(admin: CurrentAdmin, id: EntityId, input: JsonRecord): Promise<JsonRecord> {
    this.adminService.assertPermission(admin, "admin.corpus.write");
    const patch = pickDefined({
      audioStatus: optionalEnum(input.audioStatus, ["missing", "ready", "failed", "default", "unreachable"]),
      bonusWords: optionalStringArray(input.bonusWords),
      courseId: input.courseId === undefined ? undefined : EntityIdCodec.parse(requiredString(input.courseId, "courseId")),
      difficultyLevel: optionalNumber(input.difficultyLevel),
      importBatchId: nullableString(input.importBatchId),
      normalAudioUrl: nullableString(input.normalAudioUrl),
      phraseChunks: optionalStringArray(input.phraseChunks),
      publishStatus: optionalEnum(input.publishStatus, ["draft", "published", "unpublished", "archived"]),
      reviewStatus: optionalEnum(input.reviewStatus, ["pending_review", "approved", "rejected"]),
      sceneId: input.sceneId === undefined ? undefined : EntityIdCodec.parse(requiredString(input.sceneId, "sceneId")),
      sceneTags: optionalStringArray(input.sceneTags),
      sentenceText: optionalString(input.sentenceText),
      slowAudioUrl: nullableString(input.slowAudioUrl),
      sortOrder: optionalNumber(input.sortOrder),
      targetWords: optionalStringArray(input.targetWords),
      translationCn: nullableString(input.translationCn),
      updatedByAdminId: admin.adminUserId,
    });
    const result = await this.repository.updateSentence(id, patch as Parameters<LearningActivationRepository["updateSentence"]>[1]);
    if (!result?.after) throw new AppError("not_found", "Sentence not found");
    await this.audit(admin, "admin.corpus.write", "sentence_update", "sentence", id, this.sentence(result.before), this.sentence(result.after), stringOrUndefined(input.reason));
    return this.sentence(result.after);
  }

  async adminListAnnotationTasks(admin: CurrentAdmin, query: Parameters<LearningActivationRepository["listAnnotationTasks"]>[0]): Promise<JsonRecord[]> {
    this.adminService.assertPermission(admin, "admin.annotation.write");
    return (await this.repository.listAnnotationTasks(query)).map((row) => this.annotationTask(row));
  }

  async adminCreateAnnotationTask(admin: CurrentAdmin, input: JsonRecord): Promise<JsonRecord> {
    this.adminService.assertPermission(admin, "admin.annotation.write");
    const row = await this.repository.createAnnotationTask({
      algorithmVersion: stringValue(input.algorithmVersion, "v1.0"),
      confidence: input.confidence === undefined ? null : String(input.confidence),
      rejectionReason: null,
      result: recordValue(input.result, {}),
      reviewedAt: null,
      reviewerAdminId: null,
      reviewStatus: "pending_review",
      targetId: EntityIdCodec.parse(requiredString(input.targetId, "targetId")),
      targetType: enumValue(input.targetType, ["word", "sentence"], "word"),
      taskType: enumValue(input.taskType, ["hearing_trap", "distractors", "target_words", "phrase_chunks", "audio"], "hearing_trap"),
    });
    await this.audit(admin, "admin.annotation.write", "annotation_task_create", "annotation_task", row.id, undefined, this.annotationTask(row), stringOrUndefined(input.reason));
    return this.annotationTask(row);
  }

  async adminReviewAnnotationTask(admin: CurrentAdmin, id: EntityId, input: JsonRecord): Promise<JsonRecord> {
    this.adminService.assertPermission(admin, "admin.annotation.write");
    const annotationPatch = pickDefined({
      rejectionReason: nullableString(input.rejectionReason),
      result: optionalRecord(input.result),
      reviewedAt: this.repository.now(),
      reviewerAdminId: admin.adminUserId,
      reviewStatus: enumValue(input.reviewStatus, ["approved", "rejected", "pending_review"], "pending_review"),
    });
    const result = await this.repository.updateAnnotationTask(id, annotationPatch as Parameters<LearningActivationRepository["updateAnnotationTask"]>[1]);
    if (!result?.after) throw new AppError("not_found", "Annotation task not found");
    await this.audit(admin, "admin.annotation.write", "annotation_task_review", "annotation_task", id, this.annotationTask(result.before), this.annotationTask(result.after), stringOrUndefined(input.reason));
    return this.annotationTask(result.after);
  }

  async adminRunAnnotationTask(admin: CurrentAdmin, input: JsonRecord): Promise<JsonRecord> {
    this.adminService.assertPermission(admin, "admin.annotation.write");
    const targetType = enumValue(input.targetType, ["word", "sentence"], "word");
    const taskType = enumValue(input.taskType, ["hearing_trap", "distractors", "target_words", "phrase_chunks"], "hearing_trap");
    const targetId = input.targetId ? EntityIdCodec.parse(requiredString(input.targetId, "targetId")) : 0n;
    const limit = Math.min(numberValue(input.limit, input.targetId ? 1 : 200), 1000);
    const offset = numberValue(input.offset, 0);
    const algorithmVersion = stringValue(input.algorithmVersion, "auto-annotation-v1");
    const ruleVersion = stringValue(input.ruleVersion, "auto-annotation-rules-v1");
    const task = await this.repository.createAnnotationTask({
      algorithmVersion,
      confidence: null,
      inputScope: { limit, offset, targetId: input.targetId ?? null, targetType },
      rejectionReason: null,
      result: {},
      reviewedAt: null,
      reviewerAdminId: null,
      reviewStatus: "pending_review",
      ruleVersion,
      startedAt: this.repository.now(),
      targetId,
      targetType,
      taskStatus: "running",
      taskType,
    } as Parameters<LearningActivationRepository["createAnnotationTask"]>[0]);
    try {
      const rows = targetType === "word"
        ? await this.generateWordAnnotationResults(task.id, taskType, { algorithmVersion, limit, offset, ruleVersion, targetId: input.targetId ? targetId : undefined })
        : await this.generateSentenceAnnotationResults(task.id, taskType, { algorithmVersion, limit, offset, ruleVersion, targetId: input.targetId ? targetId : undefined });
      await this.repository.createAnnotationResults(rows);
      const lowConfidenceCount = rows.filter((row) => Number(row.confidence) < 0.8).length;
      const result = await this.repository.updateAnnotationTask(task.id, {
        completedAt: this.repository.now(),
        failedCount: 0,
        failureReason: null,
        lowConfidenceCount,
        result: { generatedResults: rows.length, lowConfidenceCount },
        succeededCount: rows.length,
        taskStatus: "completed",
      } as Parameters<LearningActivationRepository["updateAnnotationTask"]>[1]);
      await this.audit(admin, "admin.annotation.write", "annotation_task_run", "annotation_task", task.id, undefined, this.annotationTask(result?.after ?? task), stringOrUndefined(input.reason));
      return this.annotationTask(result?.after ?? task);
    } catch (error) {
      const message = error instanceof Error ? error.message : "annotation_failed";
      const result = await this.repository.updateAnnotationTask(task.id, {
        completedAt: this.repository.now(),
        failedCount: 1,
        failureReason: message,
        taskStatus: "failed",
      } as Parameters<LearningActivationRepository["updateAnnotationTask"]>[1]);
      await this.audit(admin, "admin.annotation.write", "annotation_task_run_failed", "annotation_task", task.id, undefined, { failureReason: message }, stringOrUndefined(input.reason));
      return this.annotationTask(result?.after ?? task);
    }
  }

  async adminRerunAnnotationTask(admin: CurrentAdmin, id: EntityId, input: JsonRecord): Promise<JsonRecord> {
    this.adminService.assertPermission(admin, "admin.annotation.write");
    const existing = await this.repository.findAnnotationTask(id);
    if (!existing) throw new AppError("not_found", "Annotation task not found");
    return this.adminRunAnnotationTask(admin, {
      algorithmVersion: input.algorithmVersion ?? existing.algorithmVersion,
      limit: numberValue(existing.inputScope.limit, 200),
      offset: numberValue(existing.inputScope.offset, 0),
      reason: input.reason,
      ruleVersion: input.ruleVersion ?? existing.ruleVersion,
      targetId: existing.targetId === 0n ? undefined : EntityIdCodec.stringify(existing.targetId),
      targetType: existing.targetType,
      taskType: existing.taskType,
    });
  }

  async adminListAnnotationResults(admin: CurrentAdmin, query: Parameters<LearningActivationRepository["listAnnotationResults"]>[0]): Promise<JsonRecord[]> {
    this.adminService.assertPermission(admin, "admin.annotation.write");
    return (await this.repository.listAnnotationResults(query)).map((row) => this.annotationResult(row));
  }

  async adminReviewAnnotationResult(admin: CurrentAdmin, id: EntityId, input: JsonRecord): Promise<JsonRecord> {
    this.adminService.assertPermission(admin, "admin.annotation.write");
    const status = enumValue(input.resultStatus, ["auto_approved", "pending_review", "approved", "rejected", "edited"], "pending_review");
    const patch = {
      manualPatch: optionalRecord(input.manualPatch) ?? {},
      rejectionReason: nullableString(input.rejectionReason),
      resultStatus: status,
      reviewedAt: this.repository.now(),
      reviewerAdminId: admin.adminUserId,
    } as Parameters<LearningActivationRepository["updateAnnotationResult"]>[1];
    const result = await this.repository.updateAnnotationResult(id, patch);
    if (!result?.after) throw new AppError("not_found", "Annotation result not found");
    if (status === "approved" || status === "edited" || status === "auto_approved") {
      await this.applyAnnotationResult(result.after);
    }
    await this.audit(admin, "admin.annotation.write", "annotation_result_review", "annotation_result", id, this.annotationResult(result.before), this.annotationResult(result.after), stringOrUndefined(input.reason));
    return this.annotationResult(result.after);
  }

  async adminBulkReviewAnnotationResults(admin: CurrentAdmin, input: JsonRecord): Promise<JsonRecord> {
    this.adminService.assertPermission(admin, "admin.annotation.write");
    const ids = stringArray(input.annotationResultIds).map((id) => EntityIdCodec.parse(id));
    const status = enumValue(input.resultStatus, ["auto_approved", "pending_review", "approved", "rejected", "edited"], "pending_review");
    const updated = await this.repository.bulkUpdateAnnotationResults(ids, {
      rejectionReason: nullableString(input.rejectionReason),
      resultStatus: status,
      reviewedAt: this.repository.now(),
      reviewerAdminId: admin.adminUserId,
    } as Parameters<LearningActivationRepository["bulkUpdateAnnotationResults"]>[1]);
    let applied = 0;
    if (status === "approved" || status === "edited" || status === "auto_approved") {
      const rows = await this.repository.findAnnotationResultsByIds(ids);
      for (const row of rows) {
        await this.applyAnnotationResult({ ...row, resultStatus: status });
        applied += 1;
      }
    }
    await this.audit(admin, "admin.annotation.write", "annotation_result_bulk_review", "annotation_result", null, undefined, { applied, resultStatus: status, updated }, stringOrUndefined(input.reason));
    return { applied, resultStatus: status, updated };
  }

  async activeAssessment(): Promise<JsonRecord> {
    const row = await this.repository.activeAssessmentConfig();
    return row ? serialize(row, "assessmentConfigId") : { assessmentConfigId: null, estimateMatrix: {}, selfDescriptionQuestions: [], samplingStrategy: {} };
  }

  async submitSelfDescription(userId: string, input: JsonRecord): Promise<JsonRecord> {
    const config = await this.repository.activeAssessmentConfig();
    const estimate = numberValue(input.vocabularyEstimate, this.estimateVocabulary(input.answers));
    const row = await this.repository.createAssessmentResult({
      configId: config?.id ?? null,
      frequencyBoundary: recordValue(input.frequencyBoundary, {}),
      painPoints: stringArray(input.painPoints),
      source: "self_description",
      status: "completed",
      userId,
      verificationRounds: [],
      vocabularyEstimate: estimate,
    });
    const generatedVocabularyCount = await this.generateInitialVocabulary(userId, estimate, "self_description");
    return { ...serialize(row, "assessmentResultId"), generatedVocabularyCount };
  }

  async startAssessmentSession(userId: string, input: JsonRecord): Promise<JsonRecord> {
    const active = await this.repository.findActiveAssessmentSession(userId);
    if (active) return this.assessmentSession(active, await this.repository.listAssessmentRoundItems(active.id, active.currentRound));
    const config = await this.repository.activeAssessmentConfig();
    const sampling = recordValue(config?.samplingStrategy, {});
    const now = this.repository.now();
    const assessmentVersion = config?.version ?? stringValue(sampling.assessmentVersion, "adaptive-word-sampling-v1");
    const questionsPerRound = Math.min(Math.max(numberValue(sampling.questionsPerRound, 6), 4), 10);
    const minRounds = Math.min(Math.max(numberValue(sampling.minRounds, 5), 5), 9);
    const maxRounds = Math.min(Math.max(numberValue(sampling.maxRounds, 9), minRounds), 9);
    const startBand = this.startAssessmentBand(input);
    const session = await this.repository.createAssessmentSession({
      assessmentVersion,
      completedAt: null,
      configId: config?.id ?? null,
      currentBand: startBand.key,
      currentRound: 1,
      expiresAt: new Date(now.getTime() + 24 * 60 * 60 * 1000),
      maxRounds,
      minRounds,
      painPoints: stringArray(input.painPoints),
      questionsPerRound,
      resultId: null,
      resultPayload: {},
      selfDescription: recordValue(input.selfDescription, {}),
      startedAt: now,
      status: "in_progress",
      userId,
    });
    const generated = await this.generateAssessmentRound(session, startBand, 1, []);
    if (generated < questionsPerRound) {
      await this.repository.updateAssessmentSession(session.id, { status: "expired", resultPayload: { failureReason: "insufficient_assessment_questions" } });
      throw new AppError("validation_failed", "Insufficient published word entries for assessment");
    }
    const created = await this.repository.findAssessmentSession(session.id) ?? session;
    return this.assessmentSession(created, await this.repository.listAssessmentRoundItems(created.id, created.currentRound));
  }

  async getAssessmentSession(userId: string, id: EntityId): Promise<JsonRecord> {
    const session = await this.repository.findAssessmentSession(id);
    if (!session || session.userId !== userId) throw new AppError("not_found", "Assessment session not found");
    return this.assessmentSession(session, await this.repository.listAssessmentRoundItems(session.id, session.currentRound));
  }

  async submitAssessmentAnswers(userId: string, id: EntityId, input: JsonRecord): Promise<JsonRecord> {
    const session = await this.repository.findAssessmentSession(id);
    if (!session || session.userId !== userId) throw new AppError("not_found", "Assessment session not found");
    if (session.status !== "in_progress") return this.assessmentSession(session, await this.repository.listAssessmentRoundItems(session.id, session.currentRound));
    if (session.expiresAt.getTime() <= this.repository.now().getTime()) {
      const result = await this.repository.updateAssessmentSession(session.id, { status: "expired" });
      return this.assessmentSession(result?.after ?? session, await this.repository.listAssessmentRoundItems(session.id, session.currentRound));
    }

    const roundItems = await this.repository.listAssessmentRoundItems(session.id, session.currentRound);
    const byId = new Map(roundItems.map((item) => [EntityIdCodec.stringify(item.id), item]));
    for (const answer of arrayRecord(input.answers)) {
      const itemId = requiredString(answer.assessmentItemId, "assessmentItemId");
      const item = byId.get(itemId);
      if (!item || item.answeredAt) continue;
      const selectedOption = stringValue(answer.selectedOption, "__unknown__");
      await this.repository.updateAssessmentItem(item.id, {
        answeredAt: this.repository.now(),
        isCorrect: selectedOption === item.correctMeaning,
        selectedOption,
      });
    }

    const refreshedRoundItems = await this.repository.listAssessmentRoundItems(session.id, session.currentRound);
    if (refreshedRoundItems.some((item) => !item.answeredAt)) {
      const current = await this.repository.findAssessmentSession(session.id) ?? session;
      return this.assessmentSession(current, refreshedRoundItems);
    }

    const allItems = await this.repository.listAssessmentItems(session.id);
    const shouldComplete = this.shouldCompleteAssessment(session, allItems);
    if (shouldComplete) return this.completeAssessmentSession(session, allItems);

    const nextBand = this.nextAssessmentBand(session.currentBand, this.roundRecognitionRate(refreshedRoundItems));
    const nextRound = session.currentRound + 1;
    await this.repository.updateAssessmentSession(session.id, { currentBand: nextBand.key, currentRound: nextRound });
    await this.generateAssessmentRound(session, nextBand, nextRound, allItems.map((item) => item.wordId));
    const updated = await this.repository.findAssessmentSession(session.id) ?? { ...session, currentBand: nextBand.key, currentRound: nextRound };
    return this.assessmentSession(updated, await this.repository.listAssessmentRoundItems(session.id, nextRound));
  }

  async adminListAssessmentConfigs(admin: CurrentAdmin, query: Parameters<LearningActivationRepository["listAssessmentConfigs"]>[0]): Promise<JsonRecord[]> {
    this.adminService.assertPermission(admin, "admin.assessment.write");
    return (await this.repository.listAssessmentConfigs(query)).map((row) => serialize(row, "assessmentConfigId"));
  }

  async adminCreateAssessmentConfig(admin: CurrentAdmin, input: JsonRecord): Promise<JsonRecord> {
    this.adminService.assertPermission(admin, "admin.assessment.write");
    const row = await this.repository.createAssessmentConfig({
      estimateMatrix: recordValue(input.estimateMatrix, {}),
      samplingStrategy: recordValue(input.samplingStrategy, {}),
      selfDescriptionQuestions: arrayRecord(input.selfDescriptionQuestions),
      status: enumValue(input.status, ["draft", "active", "archived"], "draft"),
      version: requiredString(input.version, "version"),
    });
    await this.audit(admin, "admin.assessment.write", "assessment_config_create", "assessment_config", row.id, undefined, serialize(row, "assessmentConfigId"), stringOrUndefined(input.reason));
    return serialize(row, "assessmentConfigId");
  }

  async listUserVocabulary(query: Parameters<LearningActivationRepository["listUserVocabulary"]>[0]): Promise<JsonRecord[]> {
    return (await this.repository.listUserVocabulary(query)).map((row) => this.userVocabulary(row));
  }

  async continueLearning(userId: string, query: { limit: number }): Promise<JsonRecord> {
    const limit = Math.min(Math.max(query.limit, 1), 10);
    const candidates: ContinueLearningCandidate[] = [];
    const emptyReasons = new Set<string>();
    const seenWordIds = new Set<string>();

    await this.collectContinueLearningCandidates(candidates, seenWordIds, emptyReasons, {
      limit,
      practiceType: "review",
      prioritySource: "due_review",
      query: { dueOnly: true, status: "green", userId },
    });
    await this.collectContinueLearningCandidates(candidates, seenWordIds, emptyReasons, {
      limit,
      practiceType: "audio_meaning",
      prioritySource: "yellow_consolidation",
      query: { status: "yellow", userId },
    });
    await this.collectContinueLearningCandidates(candidates, seenWordIds, emptyReasons, {
      limit,
      practiceType: "audio_meaning",
      prioritySource: "red_activation",
      query: { status: "red", userId },
    });

    if (candidates.length === 0) {
      const summary = await this.repository.vocabularySummary(userId);
      if (Object.values(summary).reduce((sum, count) => sum + count, 0) === 0) emptyReasons.add("no_user_vocabulary");
      if (emptyReasons.size === 0) emptyReasons.add("no_available_content");
    }

    return {
      emptyReasons: candidates.length === 0 ? [...emptyReasons] : [],
      hasMore: candidates.length > limit,
      items: candidates.slice(0, limit).map((candidate) => ({
        ...this.userVocabulary(candidate.row),
        practiceType: candidate.practiceType,
        prioritySource: candidate.prioritySource,
      })),
      limit,
    };
  }

  async vocabularyOverview(userId: string): Promise<JsonRecord> {
    const summary = await this.repository.vocabularySummary(userId);
    const total = Object.values(summary).reduce((sum, count) => sum + count, 0);
    const active = (summary.yellow ?? 0) + (summary.green ?? 0);
    return { activationRate: total === 0 ? 0 : active / total, green: summary.green ?? 0, red: summary.red ?? 0, total, yellow: summary.yellow ?? 0 };
  }

  async adminCorrectUserVocabulary(admin: CurrentAdmin, input: JsonRecord): Promise<JsonRecord> {
    this.adminService.assertPermission(admin, "admin.user_vocabulary.write");
    const reason = requiredString(input.reason, "reason");
    const userId = requiredString(input.userId, "userId");
    const wordId = EntityIdCodec.parse(requiredString(input.wordId, "wordId"));
    const existing = await this.repository.findUserVocabulary(userId, wordId);
    if (!existing) throw new AppError("not_found", "User vocabulary entry not found");
    const nextStatus = enumValue(input.activationStatus, ["red", "yellow", "green"], existing.activationStatus);
    const result = await this.repository.updateUserVocabulary(existing.id, { activationStatus: nextStatus });
    if (!result?.after) throw new AppError("not_found", "User vocabulary entry not found");
    await this.repository.createUserVocabularyEvent({
      adminUserId: admin.adminUserId,
      eventType: "admin_correction",
      metadata: recordValue(input.metadata, {}),
      newStatus: nextStatus,
      oldStatus: existing.activationStatus,
      reason,
      userId,
      userVocabularyEntryId: existing.id,
    });
    await this.audit(admin, "admin.user_vocabulary.write", "user_vocabulary_correct", "user_vocabulary", existing.id, this.userVocabulary(result.before), this.userVocabulary(result.after), reason);
    return this.userVocabulary(result.after);
  }

  async createActivationAttempt(userId: string, input: JsonRecord): Promise<JsonRecord> {
    const wordId = input.wordId ? EntityIdCodec.parse(requiredString(input.wordId, "wordId")) : null;
    const practiceType = enumValue(input.practiceType, ["audio_meaning", "sentence_word", "repeat_activation", "review"], "audio_meaning");
    const row = await this.repository.createWordActivationAttempt({
      correctAnswer: stringOrNull(input.correctAnswer),
      isCorrect: Boolean(input.isCorrect),
      practiceType,
      replayCount: numberValue(input.replayCount, 0),
      result: recordValue(input.result, {}),
      ruleVersion: stringValue(input.ruleVersion, "v1.0"),
      selectedAnswer: stringOrNull(input.selectedAnswer),
      sentenceId: input.sentenceId ? EntityIdCodec.parse(requiredString(input.sentenceId, "sentenceId")) : null,
      userId,
      wordId,
    });
    const vocabularyUpdate = wordId ? await this.applyActivationState(userId, wordId, practiceType, row.isCorrect) : null;
    if (wordId) {
      await this.completeDailyTaskForActivationAttempt(userId, wordId, practiceType);
    }
    return { ...serialize(row, "activationAttemptId"), vocabularyUpdate };
  }

  async adminCreatePracticeRule(admin: CurrentAdmin, input: JsonRecord): Promise<JsonRecord> {
    this.adminService.assertPermission(admin, "admin.practice.write");
    const row = await this.repository.createPracticeRule({
      rules: recordValue(input.rules, {}),
      status: enumValue(input.status, ["draft", "active", "archived"], "draft"),
      version: requiredString(input.version, "version"),
    });
    await this.audit(admin, "admin.practice.write", "practice_rule_create", "practice_rule", row.id, undefined, serialize(row, "practiceRuleId"), stringOrUndefined(input.reason));
    return serialize(row, "practiceRuleId");
  }

  async adminListPracticeRules(admin: CurrentAdmin, query: Parameters<LearningActivationRepository["listPracticeRules"]>[0]): Promise<JsonRecord[]> {
    this.adminService.assertPermission(admin, "admin.practice.write");
    return (await this.repository.listPracticeRules(query)).map((row) => serialize(row, "practiceRuleId"));
  }

  async todayTask(userId: string, taskDate: string): Promise<JsonRecord> {
    const existing = await this.repository.findDailyTask(userId, taskDate);
    if (existing) return this.dailyTask(existing, await this.repository.listDailyTaskItems(existing.id));
    const strategy = await this.repository.activeDailyTaskStrategy();
    const task = await this.repository.createDailyTask({
      generationLog: { message: "Generated on demand; item generation uses available user vocabulary and corpus content." },
      status: "generated",
      strategyVersion: strategy?.version ?? "default-v1.0",
      summary: { estimatedMinutes: 15, sections: ["audio_meaning", "repeat_sentence", "review_word"] },
      taskDate,
      userId,
    });
    const audioMeaning = await this.repository.dailyAudioMeaningCandidates(userId, 10);
    const reviews = await this.repository.dailyReviewCandidates(userId, 6);
    const sentences = await this.repository.repeatSentenceCandidates(8);
    let score = 100;
    for (const item of audioMeaning) {
      await this.repository.createDailyTaskItem({ dailyTaskId: task.id, itemType: "audio_meaning", priorityScore: String(score--), sentenceId: null, status: "pending", wordId: item.wordId });
    }
    for (const item of reviews) {
      await this.repository.createDailyTaskItem({ dailyTaskId: task.id, itemType: "review_word", priorityScore: String(score--), sentenceId: null, status: "pending", wordId: item.wordId });
    }
    for (const sentence of sentences) {
      await this.repository.createDailyTaskItem({ dailyTaskId: task.id, itemType: "repeat_sentence", priorityScore: String(score--), sentenceId: sentence.id, status: "pending", wordId: null });
    }
    return this.dailyTask(task, await this.repository.listDailyTaskItems(task.id));
  }

  async resetDailyTask(userId: string, taskDate: string): Promise<JsonRecord> {
    const result = await this.repository.resetDailyTask(userId, taskDate);
    return { reset: result.deletedTasks > 0, taskDate, ...result };
  }

  async adminCreateDailyTaskStrategy(admin: CurrentAdmin, input: JsonRecord): Promise<JsonRecord> {
    this.adminService.assertPermission(admin, "admin.task_strategy.write");
    const row = await this.repository.createDailyTaskStrategy({
      rules: recordValue(input.rules, {}),
      status: enumValue(input.status, ["draft", "active", "archived"], "draft"),
      version: requiredString(input.version, "version"),
    });
    await this.audit(admin, "admin.task_strategy.write", "daily_task_strategy_create", "daily_task_strategy", row.id, undefined, serialize(row, "dailyTaskStrategyId"), stringOrUndefined(input.reason));
    return serialize(row, "dailyTaskStrategyId");
  }

  async adminListDailyTaskStrategies(admin: CurrentAdmin, query: Parameters<LearningActivationRepository["listDailyTaskStrategies"]>[0]): Promise<JsonRecord[]> {
    this.adminService.assertPermission(admin, "admin.task_strategy.write");
    return (await this.repository.listDailyTaskStrategies(query)).map((row) => serialize(row, "dailyTaskStrategyId"));
  }

  async createListenRepeatAttempt(userId: string, input: JsonRecord): Promise<JsonRecord> {
    const sentenceId = EntityIdCodec.parse(requiredString(input.sentenceId, "sentenceId"));
    const sentence = await this.repository.findSentence(sentenceId);
    if (!sentence) throw new AppError("not_found", "Sentence not found");
    const matchRate = input.textMatchRate === undefined ? null : String(input.textMatchRate);
    const speedRatio = ratio(input.recordingDurationMs, input.originalAudioDurationMs);
    const row = await this.repository.createListenRepeatAttempt({
      asrStatus: enumValue(input.asrStatus, ["pending", "succeeded", "failed"], matchRate ? "succeeded" : "pending"),
      failureReason: stringOrNull(input.failureReason),
      mode: enumValue(input.mode, ["A", "B", "C"], "A"),
      originalAudioDurationMs: nullableNumber(input.originalAudioDurationMs),
      phraseChunkIndex: nullableNumber(input.phraseChunkIndex),
      recordingDurationMs: nullableNumber(input.recordingDurationMs),
      recordingUrl: stringOrNull(input.recordingUrl),
      sentenceId,
      speedRatio: speedRatio === null ? null : String(speedRatio),
      targetWordHits: stringArray(input.targetWordHits),
      textMatchLevel: matchRate === null ? null : textMatchLevel(Number(matchRate)),
      textMatchRate: matchRate,
      transcript: stringOrNull(input.transcript),
      userId,
      waveformSummary: recordValue(input.waveformSummary, {}),
    });
    await this.repository.upsertSentenceStat({
      attempts: 1,
      bestAccuracy: row.textMatchRate,
      firstPracticedAt: row.createdAt,
      lastPracticedAt: row.createdAt,
      latestAccuracy: row.textMatchRate,
      latestMode: row.mode,
      latestSpeedRatio: row.speedRatio,
      sentenceId,
      userId,
    });
    const vocabularyUpdates = await this.applyRepeatActivation(userId, sentence.targetWords, Number(row.textMatchRate ?? 0), row.targetWordHits);
    await this.completeDailyTaskForListenRepeat(userId, sentenceId);
    return { ...this.listenRepeat(row), vocabularyUpdates };
  }

  async adminListListenRepeat(admin: CurrentAdmin, query: Parameters<LearningActivationRepository["listListenRepeatAttempts"]>[0]): Promise<JsonRecord[]> {
    this.adminService.assertPermission(admin, "admin.listen_repeat.read");
    return (await this.repository.listListenRepeatAttempts(query)).map((row) => this.listenRepeat(row));
  }

  async createCourseReport(userId: string, input: JsonRecord): Promise<JsonRecord> {
    const courseId = EntityIdCodec.parse(requiredString(input.courseId, "courseId"));
    const row = await this.repository.createCourseReport({
      activatedWordIds: stringArray(input.activatedWordIds),
      averageAccuracy: input.averageAccuracy === undefined ? null : String(input.averageAccuracy),
      averageSpeedRatio: input.averageSpeedRatio === undefined ? null : String(input.averageSpeedRatio),
      bestSentenceId: input.bestSentenceId ? EntityIdCodec.parse(requiredString(input.bestSentenceId, "bestSentenceId")) : null,
      courseId,
      practicedSentenceCount: numberValue(input.practicedSentenceCount, 0),
      reportPayload: recordValue(input.reportPayload, {}),
      userId,
      weakSentenceIds: stringArray(input.weakSentenceIds),
    });
    await this.repository.upsertCourseProgress({
      averageAccuracy: row.averageAccuracy,
      completedAt: this.repository.now(),
      completionRate: "1",
      courseId,
      practiceRounds: 1,
      status: "completed",
      userId,
      weakSentenceIds: row.weakSentenceIds,
    });
    return this.courseReport(row);
  }

  async adminListCourseReports(admin: CurrentAdmin, query: Parameters<LearningActivationRepository["listCourseReports"]>[0]): Promise<JsonRecord[]> {
    this.adminService.assertPermission(admin, "admin.course_report.read");
    return (await this.repository.listCourseReports(query)).map((row) => this.courseReport(row));
  }

  private async generateWordAnnotationResults(
    taskId: EntityId,
    taskType: string,
    input: { algorithmVersion: string; limit: number; offset: number; ruleVersion: string; targetId?: EntityId | undefined },
  ): Promise<Parameters<LearningActivationRepository["createAnnotationResults"]>[0]> {
    const rows = await this.repository.annotationWordCandidates({ limit: input.limit, offset: input.offset, targetId: input.targetId });
    return rows.flatMap((word) => {
      if (taskType === "hearing_trap") return this.wordHearingTrapResult(taskId, word, input);
      if (taskType === "distractors") return this.wordDistractorResult(taskId, word, input);
      return [];
    });
  }

  private async generateSentenceAnnotationResults(
    taskId: EntityId,
    taskType: string,
    input: { algorithmVersion: string; limit: number; offset: number; ruleVersion: string; targetId?: EntityId | undefined },
  ): Promise<Parameters<LearningActivationRepository["createAnnotationResults"]>[0]> {
    const rows = await this.repository.annotationSentenceCandidates({ limit: input.limit, offset: input.offset, targetId: input.targetId });
    return rows.flatMap((sentence) => {
      if (taskType === "target_words") return this.sentenceTargetWordsResult(taskId, sentence, input);
      if (taskType === "phrase_chunks") return this.sentencePhraseChunksResult(taskId, sentence, input);
      if (taskType === "hearing_trap") return this.sentenceHearingTrapResults(taskId, sentence, input);
      return [];
    });
  }

  private wordHearingTrapResult(
    taskId: EntityId,
    word: WordRow & { hearingTraps: Record<string, unknown>[] },
    input: { algorithmVersion: string; ruleVersion: string },
  ): Parameters<LearningActivationRepository["createAnnotationResults"]>[0] {
    if (word.hearingTraps.length === 0) return [];
    const confidence = word.hearingTraps.length >= 3 ? 0.86 : 0.72;
    const severity = Math.min(0.95, 0.45 + word.hearingTraps.length * 0.08 + (word.difficultyLevel ?? 1) * 0.04);
    return [{
      algorithmVersion: input.algorithmVersion,
      confidence: fixed(confidence),
      payload: {
        explanation: `${word.word} has near-sound confusable words based on phoneme similarity.`,
        phonetic: word.phonetic,
        trapType: "near_sound_confusion",
        traps: word.hearingTraps,
        word: word.word,
      },
      proposedPatch: {},
      resultStatus: confidence >= 0.8 ? "auto_approved" : "pending_review",
      resultType: "hearing_trap",
      ruleVersion: input.ruleVersion,
      severity: fixed(severity),
      targetId: word.id,
      targetType: "word",
      taskId,
      trapType: "near_sound_confusion",
    }];
  }

  private wordDistractorResult(
    taskId: EntityId,
    word: WordRow & { hearingTraps: Record<string, unknown>[] },
    input: { algorithmVersion: string; ruleVersion: string },
  ): Parameters<LearningActivationRepository["createAnnotationResults"]>[0] {
    const phonetic = word.hearingTraps.map((trap: Record<string, unknown>) => String(trap.trapWord ?? "")).filter(Boolean).slice(0, 8);
    const distractors = {
      difficulty: [],
      meaning: [],
      pronunciation: phonetic,
    };
    const confidence = phonetic.length >= 3 ? 0.82 : 0.58;
    return [{
      algorithmVersion: input.algorithmVersion,
      confidence: fixed(confidence),
      payload: { distractors, word: word.word },
      proposedPatch: { distractors },
      resultStatus: confidence >= 0.8 ? "auto_approved" : "pending_review",
      resultType: "distractors",
      ruleVersion: input.ruleVersion,
      severity: fixed(0.5),
      targetId: word.id,
      targetType: "word",
      taskId,
      trapType: null,
    }];
  }

  private sentenceTargetWordsResult(
    taskId: EntityId,
    sentence: SentenceRow,
    input: { algorithmVersion: string; ruleVersion: string },
  ): Parameters<LearningActivationRepository["createAnnotationResults"]>[0] {
    const tokens = sentenceTokens(sentence.sentenceText);
    const candidates = uniqueStrings([...sentence.targetWords, ...tokens.filter((token) => token.length > 3)]).slice(0, 8);
    if (candidates.length === 0) return [];
    const targetWords = candidates.slice(0, 3);
    const bonusWords = candidates.slice(3);
    return [{
      algorithmVersion: input.algorithmVersion,
      confidence: fixed(sentence.targetWords.length > 0 ? 0.84 : 0.62),
      payload: { bonusWords, sentenceText: sentence.sentenceText, targetWords },
      proposedPatch: { bonusWords, targetWords },
      resultStatus: sentence.targetWords.length > 0 ? "auto_approved" : "pending_review",
      resultType: "target_words",
      ruleVersion: input.ruleVersion,
      severity: fixed(0.6),
      targetId: sentence.id,
      targetType: "sentence",
      taskId,
      trapType: null,
    }];
  }

  private sentencePhraseChunksResult(
    taskId: EntityId,
    sentence: SentenceRow,
    input: { algorithmVersion: string; ruleVersion: string },
  ): Parameters<LearningActivationRepository["createAnnotationResults"]>[0] {
    const chunks = phraseChunks(sentence.sentenceText);
    if (chunks.length <= 1) return [];
    return [{
      algorithmVersion: input.algorithmVersion,
      confidence: fixed(0.66),
      payload: { chunks, sentenceText: sentence.sentenceText },
      proposedPatch: { phraseChunks: chunks },
      resultStatus: "pending_review",
      resultType: "phrase_chunks",
      ruleVersion: input.ruleVersion,
      severity: fixed(0.42),
      targetId: sentence.id,
      targetType: "sentence",
      taskId,
      trapType: null,
    }];
  }

  private sentenceHearingTrapResults(
    taskId: EntityId,
    sentence: SentenceRow,
    input: { algorithmVersion: string; ruleVersion: string },
  ): Parameters<LearningActivationRepository["createAnnotationResults"]>[0] {
    const text = sentence.sentenceText;
    const tokens = sentenceTokens(text);
    const results: Parameters<LearningActivationRepository["createAnnotationResults"]>[0] = [];
    const weakForms = tokens.filter((token) => weakFormWords.has(token.toLowerCase()));
    if (weakForms.length > 0) {
      results.push(this.sentenceTrapResult(taskId, sentence, input, "weak_form", { words: uniqueStrings(weakForms), explanation: "Common function words may reduce in unstressed sentence positions." }, 0.62, 0.58));
    }
    const contractions = tokens.filter((token) => token.includes("'") || contractionWords.has(token.toLowerCase()));
    if (contractions.length > 0) {
      results.push(this.sentenceTrapResult(taskId, sentence, input, "contraction", { forms: uniqueStrings(contractions), explanation: "Contractions or colloquial reductions may hide the full word group." }, 0.78, 0.66));
    }
    if (hasLinkingBoundary(tokens)) {
      results.push(this.sentenceTrapResult(taskId, sentence, input, "linking", { explanation: "Adjacent word boundary may link in connected speech.", tokens }, 0.56, 0.52));
    }
    return results;
  }

  private sentenceTrapResult(
    taskId: EntityId,
    sentence: SentenceRow,
    input: { algorithmVersion: string; ruleVersion: string },
    trapType: string,
    payload: JsonRecord,
    confidence: number,
    severity: number,
  ): Parameters<LearningActivationRepository["createAnnotationResults"]>[0][number] {
    return {
      algorithmVersion: input.algorithmVersion,
      confidence: fixed(confidence),
      payload: { ...payload, sentenceId: EntityIdCodec.stringify(sentence.id), sentenceText: sentence.sentenceText, trapType },
      proposedPatch: {},
      resultStatus: confidence >= 0.8 ? "auto_approved" : "pending_review",
      resultType: "hearing_trap",
      ruleVersion: input.ruleVersion,
      severity: fixed(severity),
      targetId: sentence.id,
      targetType: "sentence",
      taskId,
      trapType,
    };
  }

  private async applyAnnotationResult(row: AnnotationResultRow): Promise<void> {
    const patch = { ...row.proposedPatch, ...row.manualPatch };
    if (row.targetType === "sentence" && (row.resultType === "target_words" || row.resultType === "phrase_chunks")) {
      const sentencePatch: Parameters<LearningActivationRepository["updateSentence"]>[1] = {};
      if (Array.isArray(patch.targetWords)) sentencePatch.targetWords = patch.targetWords.filter((item): item is string => typeof item === "string");
      if (Array.isArray(patch.bonusWords)) sentencePatch.bonusWords = patch.bonusWords.filter((item): item is string => typeof item === "string");
      if (Array.isArray(patch.phraseChunks)) sentencePatch.phraseChunks = patch.phraseChunks.filter((item): item is string => typeof item === "string");
      if (Object.keys(sentencePatch).length > 0) await this.repository.updateSentence(row.targetId, sentencePatch);
    }
    if (row.targetType === "word" && row.resultType === "distractors" && isRecord(patch.distractors)) {
      await this.repository.updateAnnotationWord(row.targetId, { distractors: {
        difficulty: stringArray(patch.distractors.difficulty),
        meaning: stringArray(patch.distractors.meaning),
        pronunciation: stringArray(patch.distractors.pronunciation),
      } });
    }
  }

  private startAssessmentBand(input: JsonRecord): AssessmentBand {
    const estimate = numberValue(input.vocabularyEstimate, 2500);
    if (estimate >= 5500) return assessmentBands[5] ?? assessmentBands[3]!;
    if (estimate >= 3500) return assessmentBands[4] ?? assessmentBands[3]!;
    if (estimate <= 1200) return assessmentBands[1] ?? assessmentBands[3]!;
    return this.assessmentBand("L2_MID");
  }

  private assessmentBand(key: string): AssessmentBand {
    return assessmentBands.find((band) => band.key === key) ?? assessmentBands[3]!;
  }

  private nextAssessmentBand(currentKey: string, recognitionRate: number): AssessmentBand {
    const currentIndex = Math.max(0, assessmentBands.findIndex((band) => band.key === currentKey));
    if (recognitionRate >= 0.8) return assessmentBands[Math.min(currentIndex + 1, assessmentBands.length - 1)]!;
    if (recognitionRate <= 0.4) return assessmentBands[Math.max(currentIndex - 1, 0)]!;
    return assessmentBands[currentIndex]!;
  }

  private async generateAssessmentRound(session: AssessmentSessionRow, band: AssessmentBand, roundIndex: number, excludeWordIds: EntityId[]): Promise<number> {
    const candidates = await this.assessmentCandidatesWithFallback(band, session.questionsPerRound, excludeWordIds);
    const rows: Parameters<LearningActivationRepository["createAssessmentItems"]>[0] = [];
    const usedWordIds = [...excludeWordIds];
    for (const word of candidates.slice(0, session.questionsPerRound)) {
      const correctMeaning = word.assessmentMeaning?.trim();
      if (!correctMeaning) continue;
      const distractors = await this.repository.assessmentDistractors({ difficultyLevel: word.difficultyLevel ?? band.difficultyLevel, excludeWordIds: [...usedWordIds, word.id], limit: 12 });
      const options = this.assessmentOptions(correctMeaning, distractors);
      if (options.length < 4) continue;
      rows.push({
        bandKey: band.key,
        correctMeaning,
        difficultyLevel: word.difficultyLevel ?? band.difficultyLevel,
        isCorrect: null,
        itemIndex: rows.length + 1,
        lg10wf: word.lg10wf,
        options,
        roundIndex,
        selectedOption: null,
        sessionId: session.id,
        word: word.word,
        wordId: word.id,
      });
      usedWordIds.push(word.id);
    }
    await this.repository.createAssessmentItems(rows);
    return rows.length;
  }

  private async assessmentCandidatesWithFallback(band: AssessmentBand, limit: number, excludeWordIds: EntityId[]): Promise<AssessmentWordRow[]> {
    const candidates: AssessmentWordRow[] = [];
    const seen = new Set(excludeWordIds.map((id) => EntityIdCodec.stringify(id)));
    const bandIndex = assessmentBands.findIndex((item) => item.key === band.key);
    const bandOrder = uniqueNumbers([bandIndex, bandIndex - 1, bandIndex + 1, bandIndex - 2, bandIndex + 2]).filter((index) => index >= 0 && index < assessmentBands.length);
    for (const index of bandOrder) {
      const current = assessmentBands[index]!;
      const rows = await this.repository.assessmentQuestionCandidates({ ...current, excludeWordIds: [...excludeWordIds, ...candidates.map((item) => item.id)], limit: limit - candidates.length });
      for (const row of rows) {
        const key = EntityIdCodec.stringify(row.id);
        if (seen.has(key)) continue;
        candidates.push(row);
        seen.add(key);
        if (candidates.length >= limit) return candidates;
      }
    }
    return candidates;
  }

  private assessmentOptions(correctMeaning: string, distractors: AssessmentWordRow[]): string[] {
    const options = uniqueNonEmptyStrings([correctMeaning, ...distractors.map((word) => word.assessmentMeaning ?? "")]).slice(0, 4);
    if (options.length < 4) return options;
    return rotate(options, correctMeaning.length % options.length);
  }

  private shouldCompleteAssessment(session: AssessmentSessionRow, items: AssessmentItemRow[]): boolean {
    if (session.currentRound >= session.maxRounds) return true;
    if (session.currentRound < session.minRounds) return false;
    const rounds = this.assessmentRoundSummaries(items);
    const lastTwo = rounds.slice(-2);
    return lastTwo.length === 2 && lastTwo.every((round) => round.bandKey === lastTwo[0]?.bandKey) && Math.abs(lastTwo[0]!.recognitionRate - lastTwo[1]!.recognitionRate) <= 0.2;
  }

  private async completeAssessmentSession(session: AssessmentSessionRow, items: AssessmentItemRow[]): Promise<JsonRecord> {
    const summaries = this.assessmentRoundSummaries(items);
    const frontier = this.frontierBand(summaries);
    const confidenceLevel = this.assessmentConfidence(session, items, summaries);
    const conservative = confidenceLevel === "low" ? assessmentBands[Math.max(0, assessmentBands.findIndex((band) => band.key === frontier.key) - 1)]! : frontier;
    const vocabularyEstimate = conservative.estimate;
    const recognizedBands = summaries.filter((round) => round.recognitionRate >= 0.6).map((round) => round.bandKey);
    const frequencyBoundary = { frontierBand: conservative.key, maxLg10wf: conservative.maxLg10wf, minLg10wf: conservative.minLg10wf };
    const resultPayload = {
      assessmentVersion: session.assessmentVersion,
      confidenceLevel,
      frontierBand: conservative.key,
      initialUnlockedLevels: uniqueNumbers(assessmentBands.filter((band) => band.difficultyLevel <= conservative.difficultyLevel).map((band) => band.difficultyLevel)),
      recognizedBands: uniqueNonEmptyStrings(recognizedBands),
      rounds: summaries,
    };
    const result = await this.repository.createAssessmentResult({
      configId: session.configId,
      frequencyBoundary,
      painPoints: session.painPoints,
      source: "adaptive_word_sampling",
      status: "completed",
      userId: session.userId,
      verificationRounds: summaries,
      vocabularyEstimate,
    });
    const generatedVocabularyCount = await this.generateInitialVocabularyByBoundary(session.userId, vocabularyEstimate, conservative, "adaptive_word_sampling");
    const updated = await this.repository.updateAssessmentSession(session.id, {
      completedAt: this.repository.now(),
      resultId: result.id,
      resultPayload: { ...resultPayload, assessmentResultId: EntityIdCodec.stringify(result.id), generatedVocabularyCount },
      status: "completed",
    });
    return {
      ...this.assessmentSession(updated?.after ?? { ...session, resultId: result.id, resultPayload, status: "completed" }, []),
      assessmentResult: { ...serialize(result, "assessmentResultId"), generatedVocabularyCount, ...resultPayload },
    };
  }

  private assessmentRoundSummaries(items: AssessmentItemRow[]): AssessmentRoundSummary[] {
    const byRound = new Map<number, AssessmentItemRow[]>();
    for (const item of items) byRound.set(item.roundIndex, [...(byRound.get(item.roundIndex) ?? []), item]);
    return [...byRound.entries()].sort(([left], [right]) => left - right).map(([roundIndex, roundItems]) => {
      const correctCount = roundItems.filter((item) => item.isCorrect).length;
      const recognitionRate = roundItems.length === 0 ? 0 : correctCount / roundItems.length;
      return {
        bandKey: roundItems[0]?.bandKey ?? "UNKNOWN",
        correctCount,
        questionCount: roundItems.length,
        recognitionRate,
        roundIndex,
      };
    });
  }

  private roundRecognitionRate(items: AssessmentItemRow[]): number {
    if (items.length === 0) return 0;
    return items.filter((item) => item.isCorrect).length / items.length;
  }

  private frontierBand(rounds: AssessmentRoundSummary[]): AssessmentBand {
    const recognized = rounds.filter((round) => numberValue(round.recognitionRate, 0) >= 0.6);
    const key = stringValue(recognized.at(-1)?.bandKey, rounds.at(-1)?.bandKey ? String(rounds.at(-1)?.bandKey) : "L1_MID");
    return this.assessmentBand(key);
  }

  private assessmentConfidence(session: AssessmentSessionRow, items: AssessmentItemRow[], rounds: AssessmentRoundSummary[]): string {
    if (items.length < session.minRounds * session.questionsPerRound) return "low";
    if (rounds.length >= session.minRounds && rounds.some((round) => numberValue(round.questionCount, 0) < session.questionsPerRound)) return "low";
    const rates = rounds.map((round) => numberValue(round.recognitionRate, 0));
    const impossiblePattern = rates.some((rate, index) => index > 0 && rate - (rates[index - 1] ?? 0) > 0.5);
    if (impossiblePattern) return "low";
    if (session.currentRound >= session.maxRounds) return "medium";
    return "high";
  }

  private async courseWithUnlock(row: CourseRow, rank: number): Promise<JsonRecord> {
    const sentenceCount = await this.repository.courseSentenceCount(row.id);
    const unlocked = rank < 3;
    return { ...this.course(row), sentenceCount, unlocked, lockReason: unlocked ? null : "previous_course_required" };
  }

  private async courseWithValidation(row: CourseRow): Promise<JsonRecord> {
    const validation = await this.coursePublishValidation(row.id);
    return { ...this.course(row), publishValidation: validation };
  }

  private async coursePublishValidation(courseId: EntityId): Promise<JsonRecord> {
    const sentences = await this.repository.courseSentencesForValidation(courseId);
    const errors = [];
    if (sentences.length < 8 || sentences.length > 12) errors.push("course_sentence_count_must_be_8_to_12");
    if (sentences.some((sentence) => !this.isSentenceConsumable(sentence))) errors.push("all_sentences_need_audio_target_words_and_approval");
    const levels = new Set(sentences.map((sentence) => sentence.difficultyLevel));
    if (levels.size > 1) errors.push("course_sentence_difficulty_must_be_consistent");
    return { errors, sentenceCount: sentences.length, valid: errors.length === 0, warnings: [] };
  }

  private async assertCoursePublishable(courseId: EntityId): Promise<void> {
    const validation = await this.coursePublishValidation(courseId);
    if (!validation.valid) throw new AppError("validation_failed", "Course is not publishable", validation);
  }

  private isSentenceConsumable(row: SentenceRow): boolean {
    return Boolean(row.normalAudioUrl && row.slowAudioUrl && row.audioStatus === "ready" && row.targetWords.length > 0 && row.reviewStatus === "approved");
  }

  private scene(row: SceneRow): JsonRecord {
    return serialize(row, "sceneId");
  }

  private course(row: CourseRow): JsonRecord {
    return serialize(row, "courseId");
  }

  private sentence(row: SentenceRow): JsonRecord {
    return serialize(row, "sentenceId");
  }

  private annotationTask(row: AnnotationTaskRow): JsonRecord {
    return serialize(row, "annotationTaskId");
  }

  private annotationResult(row: AnnotationResultRow): JsonRecord {
    return serialize(row, "annotationResultId");
  }

  private userVocabulary(row: UserVocabularyEntryRow | UserVocabularyWithWordRow): JsonRecord {
    const output = serialize(row, "userVocabularyEntryId");
    if ("wordEntry" in row) {
      output.word = row.wordEntry.word;
      output.lemma = row.wordEntry.lemma;
      output.phonetic = row.wordEntry.phonetic;
      output.meaningCn = row.wordEntry.meaningCn;
      output.audioUrl = row.wordEntry.audioUrl;
      output.difficultyLevel = row.wordEntry.difficultyLevel;
      output.frequencyCount = row.wordEntry.frequencyCount;
      output.lg10wf = row.wordEntry.lg10wf;
      output.senses = row.senses.map((sense) => ({
        antonyms: sense.antonyms,
        definition: sense.definition,
        definitionIndex: sense.definitionIndex,
        example: sense.example,
        partOfSpeech: sense.partOfSpeech,
        senseIndex: sense.senseIndex,
        source: sense.source,
        synonyms: sense.synonyms,
        wordSenseId: EntityIdCodec.stringify(sense.id),
      }));
    }
    return output;
  }

  private async collectContinueLearningCandidates(
    candidates: ContinueLearningCandidate[],
    seenWordIds: Set<string>,
    emptyReasons: Set<string>,
    input: {
      limit: number;
      practiceType: "audio_meaning" | "review";
      prioritySource: ContinueLearningPrioritySource;
      query: Pick<Parameters<LearningActivationRepository["listUserVocabulary"]>[0], "dueOnly" | "status" | "userId">;
    },
  ): Promise<void> {
    if (candidates.length > input.limit) return;
    const rows = await this.repository.listUserVocabulary({ ...input.query, limit: Math.min(100, input.limit * 3 + 10), offset: 0 });
    if (rows.length === 0) {
      emptyReasons.add(this.emptyReasonForPrioritySource(input.prioritySource));
      return;
    }
    let consumableCount = 0;
    for (const row of rows) {
      const wordId = EntityIdCodec.stringify(row.wordId);
      if (seenWordIds.has(wordId)) continue;
      if (!this.isWordConsumable(row.wordEntry)) {
        this.collectWordContentReason(row.wordEntry, emptyReasons);
        continue;
      }
      consumableCount += 1;
      seenWordIds.add(wordId);
      candidates.push({ practiceType: input.practiceType, prioritySource: input.prioritySource, row });
      if (candidates.length > input.limit) return;
    }
    if (consumableCount === 0) emptyReasons.add(this.emptyReasonForPrioritySource(input.prioritySource));
  }

  private isWordConsumable(row: UserVocabularyWithWordRow["wordEntry"]): boolean {
    return Boolean(row.publishStatus === "published" && row.reviewStatus === "approved" && !row.isExcluded && (row.audioStatus === "ready" || row.audioStatus === "default") && row.audioUrl);
  }

  private collectWordContentReason(row: UserVocabularyWithWordRow["wordEntry"], emptyReasons: Set<string>): void {
    if (row.publishStatus !== "published" || row.reviewStatus !== "approved" || row.isExcluded) emptyReasons.add("content_not_published");
    if (!row.audioUrl || (row.audioStatus !== "ready" && row.audioStatus !== "default")) emptyReasons.add("no_audio");
  }

  private emptyReasonForPrioritySource(source: ContinueLearningPrioritySource): string {
    if (source === "due_review") return "no_due_review_words";
    if (source === "yellow_consolidation") return "no_yellow_words";
    if (source === "red_activation") return "no_unlocked_red_words";
    return "no_next_unlocked_batch";
  }

  private dailyTask(row: DailyTaskRow, items: unknown[]): JsonRecord {
    return { ...serialize(row, "dailyTaskId"), items: items.map((item) => serialize(item as Record<string, unknown>, "dailyTaskItemId")) };
  }

  private listenRepeat(row: ListenRepeatAttemptRow): JsonRecord {
    return serialize(row, "listenRepeatAttemptId");
  }

  private courseReport(row: CourseReportRow): JsonRecord {
    return serialize(row, "courseReportId");
  }

  private assessmentSession(row: AssessmentSessionRow, currentRoundItems: AssessmentItemRow[]): JsonRecord {
    return {
      ...serialize(row, "assessmentSessionId"),
      currentRoundItems: currentRoundItems.map((item) => ({
        assessmentItemId: EntityIdCodec.stringify(item.id),
        answered: Boolean(item.answeredAt),
        bandKey: item.bandKey,
        difficultyLevel: item.difficultyLevel,
        isCorrect: item.answeredAt ? item.isCorrect : null,
        itemIndex: item.itemIndex,
        lg10wf: item.lg10wf,
        options: [...item.options, "不认识/不确定"],
        roundIndex: item.roundIndex,
        selectedOption: item.selectedOption,
        word: item.word,
        wordId: EntityIdCodec.stringify(item.wordId),
      })),
      progress: {
        answeredInCurrentRound: currentRoundItems.filter((item) => item.answeredAt).length,
        maxQuestions: row.maxRounds * row.questionsPerRound,
        maxRounds: row.maxRounds,
        minQuestions: row.minRounds * row.questionsPerRound,
        minRounds: row.minRounds,
        questionsPerRound: row.questionsPerRound,
      },
    };
  }

  private estimateVocabulary(answers: unknown): number {
    if (!Array.isArray(answers)) return 2500;
    return Math.max(500, Math.min(7500, 1000 + answers.length * 1000));
  }

  private async generateInitialVocabulary(userId: string, estimate: number, source: string): Promise<number> {
    const words = await this.repository.publishedWordsForInitialVocabulary(Math.min(estimate, 500));
    let count = 0;
    for (const word of words) {
      const row = await this.repository.createUserVocabularyEntry({
        activationStatus: "red",
        avoidUntil: null,
        consecutiveCorrect: 0,
        failureCount: 0,
        lastPracticeType: null,
        nextReviewAt: this.repository.now(),
        sentenceExposures: 0,
        skipCount: 0,
        source,
        spokenCount: 0,
        srsIntervalDays: 0,
        totalAttempts: 0,
        totalCorrect: 0,
        userId,
        weakPronunciations: [],
        wordId: word.id,
      });
      await this.repository.createUserVocabularyEvent({
        adminUserId: null,
        eventType: "initial_generation",
        metadata: { assessmentEstimate: estimate },
        newStatus: row.activationStatus,
        oldStatus: null,
        reason: source,
        userId,
        userVocabularyEntryId: row.id,
      });
      count += 1;
    }
    return count;
  }

  private async generateInitialVocabularyByBoundary(userId: string, estimate: number, band: AssessmentBand, source: string): Promise<number> {
    const words = await this.repository.publishedWordsForInitialVocabularyBoundary({
      limit: Math.min(estimate, 500),
      maxDifficultyLevel: band.difficultyLevel,
      minLg10wf: Math.max(0, band.minLg10wf - 0.2),
    });
    let count = 0;
    for (const word of words) {
      const row = await this.repository.createUserVocabularyEntry({
        activationStatus: "red",
        avoidUntil: null,
        consecutiveCorrect: 0,
        failureCount: 0,
        lastPracticeType: null,
        nextReviewAt: this.repository.now(),
        sentenceExposures: 0,
        skipCount: 0,
        source,
        spokenCount: 0,
        srsIntervalDays: 0,
        totalAttempts: 0,
        totalCorrect: 0,
        userId,
        weakPronunciations: [],
        wordId: word.id,
      });
      await this.repository.createUserVocabularyEvent({
        adminUserId: null,
        eventType: "initial_generation",
        metadata: { assessmentEstimate: estimate, frontierBand: band.key },
        newStatus: row.activationStatus,
        oldStatus: null,
        reason: source,
        userId,
        userVocabularyEntryId: row.id,
      });
      count += 1;
    }
    return count;
  }

  private async applyActivationState(userId: string, wordId: EntityId, practiceType: string, isCorrect: boolean): Promise<JsonRecord | null> {
    const entry = await this.repository.findUserVocabulary(userId, wordId);
    if (!entry) return null;
    const attempts = await this.repository.recentActivationAttempts(userId, wordId, practiceType, 3);
    let nextStatus = entry.activationStatus;
    let consecutiveCorrect = isCorrect ? entry.consecutiveCorrect + 1 : 0;
    let failureCount = isCorrect ? 0 : entry.failureCount + 1;
    if (entry.activationStatus === "red" && practiceType === "audio_meaning" && attempts.slice(0, 2).every((attempt) => attempt.isCorrect) && attempts.length >= 2) {
      nextStatus = "yellow";
      consecutiveCorrect = 0;
    }
    if (entry.activationStatus === "yellow" && practiceType === "audio_meaning" && attempts.slice(0, 3).every((attempt) => !attempt.isCorrect) && attempts.length >= 3) {
      nextStatus = "red";
    }
    if (entry.activationStatus === "green" && practiceType === "review" && attempts.slice(0, 2).every((attempt) => !attempt.isCorrect) && attempts.length >= 2) {
      nextStatus = "yellow";
    }
    const nextReviewAt = new Date(this.repository.now().getTime() + this.nextSrsIntervalDays(nextStatus, entry.srsIntervalDays, isCorrect) * 24 * 60 * 60 * 1000);
    const result = await this.repository.updateUserVocabulary(entry.id, {
      activationStatus: nextStatus,
      consecutiveCorrect,
      failureCount,
      lastPracticeType: practiceType,
      nextReviewAt,
      srsIntervalDays: this.nextSrsIntervalDays(nextStatus, entry.srsIntervalDays, isCorrect),
      totalAttempts: entry.totalAttempts + 1,
      totalCorrect: entry.totalCorrect + (isCorrect ? 1 : 0),
    });
    if (!result?.after) return null;
    if (entry.activationStatus !== nextStatus) {
      await this.repository.createUserVocabularyEvent({
        adminUserId: null,
        eventType: "practice_transition",
        metadata: { isCorrect, practiceType },
        newStatus: nextStatus,
        oldStatus: entry.activationStatus,
        reason: "practice_result",
        userId,
        userVocabularyEntryId: entry.id,
      });
    }
    return this.userVocabulary(result.after);
  }

  private async completeDailyTaskForActivationAttempt(userId: string, wordId: EntityId, practiceType: string): Promise<void> {
    const itemTypes = practiceType === "review" ? ["review_word"] : practiceType === "audio_meaning" ? ["audio_meaning"] : [];
    if (itemTypes.length === 0) return;
    await this.repository.completeDailyTaskItemForWord(userId, this.todayDate(), wordId, itemTypes);
  }

  private async completeDailyTaskForListenRepeat(userId: string, sentenceId: EntityId): Promise<void> {
    await this.repository.completeDailyTaskItemForSentence(userId, this.todayDate(), sentenceId);
  }

  private todayDate(): string {
    return this.repository.now().toISOString().slice(0, 10);
  }

  private async applyRepeatActivation(userId: string, targetWords: string[], textMatchRate: number, targetWordHits: string[]): Promise<JsonRecord[]> {
    if (textMatchRate < 0.6) return [];
    const updates = [];
    for (const hit of targetWordHits) {
      if (!targetWords.includes(hit)) continue;
      const wordId = tryParseEntityId(hit);
      if (!wordId) continue;
      const entry = await this.repository.findUserVocabulary(userId, wordId);
      if (!entry) continue;
      const spokenCount = entry.spokenCount + 1;
      const nextStatus = entry.activationStatus === "yellow" && spokenCount >= 2 && textMatchRate >= 0.9 ? "green" : entry.activationStatus;
      const result = await this.repository.updateUserVocabulary(entry.id, {
        activationStatus: nextStatus,
        lastPracticeType: "repeat_activation",
        spokenCount,
        totalAttempts: entry.totalAttempts + 1,
        totalCorrect: entry.totalCorrect + 1,
      });
      if (result?.after) updates.push(this.userVocabulary(result.after));
    }
    return updates;
  }

  private nextSrsIntervalDays(status: string, previous: number, isCorrect: boolean): number {
    if (!isCorrect) return 0;
    if (status === "yellow") return 1;
    if (status !== "green") return 0;
    if (previous < 1) return 1;
    if (previous < 3) return 3;
    if (previous < 7) return 7;
    if (previous < 15) return 15;
    return 30;
  }

  private async audit(admin: CurrentAdmin, permissionKey: string, action: string, objectType: string, objectId: EntityId | null, oldValue?: JsonRecord, newValue?: JsonRecord, reason?: string): Promise<void> {
    await this.adminService.audit(admin, permissionKey, action, objectType, objectId === null ? null : EntityIdCodec.stringify(objectId), oldValue, newValue, reason);
  }
}

const weakFormWords = new Set(["a", "an", "the", "of", "to", "for", "and", "or", "but", "can", "would", "was", "were", "have", "has", "had", "do", "does", "did"]);
const contractionWords = new Set(["gonna", "wanna", "gotta", "dunno", "lemme", "kinda", "sorta"]);
const assessmentBands: AssessmentBand[] = [
  { difficultyLevel: 1, estimate: 800, key: "L1_HIGH", maxLg10wf: 8, minLg10wf: 5.2 },
  { difficultyLevel: 1, estimate: 1200, key: "L1_MID", maxLg10wf: 5.2, minLg10wf: 4.7 },
  { difficultyLevel: 2, estimate: 1800, key: "L2_HIGH", maxLg10wf: 4.7, minLg10wf: 4.3 },
  { difficultyLevel: 2, estimate: 2500, key: "L2_MID", maxLg10wf: 4.3, minLg10wf: 3.9 },
  { difficultyLevel: 3, estimate: 3500, key: "L3_HIGH", maxLg10wf: 3.9, minLg10wf: 3.5 },
  { difficultyLevel: 3, estimate: 5000, key: "L3_MID", maxLg10wf: 3.5, minLg10wf: 3.1 },
  { difficultyLevel: 4, estimate: 6500, key: "L4_HIGH", maxLg10wf: 3.1, minLg10wf: 2.7 },
  { difficultyLevel: 4, estimate: 7500, key: "L4_MID", maxLg10wf: 2.7, minLg10wf: 0 },
];

function fixed(value: number): string {
  return value.toFixed(4);
}

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function sentenceTokens(sentence: string): string[] {
  return sentence.match(/[A-Za-z]+(?:'[A-Za-z]+)?/g)?.map((token) => token.toLowerCase()) ?? [];
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim().toLowerCase()).filter(Boolean))];
}

function uniqueNonEmptyStrings(values: string[]): string[] {
  const seen = new Set<string>();
  const output: string[] = [];
  for (const value of values) {
    const trimmed = value.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    output.push(trimmed);
  }
  return output;
}

function uniqueNumbers(values: number[]): number[] {
  return [...new Set(values.filter((value) => Number.isFinite(value)))];
}

function rotate<T>(values: T[], count: number): T[] {
  if (values.length === 0) return values;
  const normalized = count % values.length;
  return [...values.slice(normalized), ...values.slice(0, normalized)];
}

function phraseChunks(sentence: string): string[] {
  const tokens = sentenceTokens(sentence);
  if (tokens.length <= 12) return [sentence];
  const punctuation = sentence.split(/[,;:—-]\s*/).map((chunk) => chunk.trim()).filter(Boolean);
  if (punctuation.length > 1) return punctuation;
  const markerPattern = /\b(that|which|who|where|when|if|because|although|since|while|but)\b/i;
  const words = sentence.split(/\s+/);
  const chunks: string[] = [];
  let current: string[] = [];
  for (const word of words) {
    if (current.length >= 6 && markerPattern.test(word)) {
      chunks.push(current.join(" "));
      current = [word];
    } else {
      current.push(word);
    }
  }
  if (current.length > 0) chunks.push(current.join(" "));
  if (chunks.length > 1) return chunks;
  const midpoint = Math.ceil(words.length / 2);
  return [words.slice(0, midpoint).join(" "), words.slice(midpoint).join(" ")].filter(Boolean);
}

function hasLinkingBoundary(tokens: string[]): boolean {
  for (let index = 0; index < tokens.length - 1; index += 1) {
    const current = tokens[index] ?? "";
    const next = tokens[index + 1] ?? "";
    if (/[bcdfghjklmnpqrstvwxyz]$/.test(current) && /^[aeiou]/.test(next)) return true;
    if (/[tdkgpb]$/.test(current) && /^[bcdfghjklmnpqrstvwxyz]/.test(next)) return true;
  }
  return false;
}

function serialize(row: Record<string, unknown>, idName: string): JsonRecord {
  const output: JsonRecord = {};
  for (const [key, value] of Object.entries(row)) {
    if (key === "id" && typeof value === "bigint") {
      output[idName] = EntityIdCodec.stringify(value);
    } else if (typeof value === "bigint") {
      output[key] = EntityIdCodec.stringify(value);
    } else if (value instanceof Date) {
      output[key] = value.toISOString();
    } else {
      output[key] = value;
    }
  }
  return output;
}

function requiredString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.length === 0) throw new AppError("validation_failed", `${field} is required`);
  return value;
}

function stringValue(value: unknown, fallback: string): string {
  return typeof value === "string" && value.length > 0 ? value : fallback;
}

function optionalString(value: unknown): string | undefined {
  return value === undefined ? undefined : requiredString(value, "value");
}

function stringOrNull(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function stringOrUndefined(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function nullableString(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  return value === null ? null : requiredString(value, "value");
}

function numberValue(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function optionalNumber(value: unknown): number | undefined {
  return value === undefined ? undefined : numberValue(value, 0);
}

function nullableNumber(value: unknown): number | null {
  return value === undefined || value === null ? null : numberValue(value, 0);
}

function enumValue<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === "string" && allowed.includes(value as T) ? (value as T) : fallback;
}

function optionalEnum<T extends string>(value: unknown, allowed: readonly [T, ...T[]]): T | undefined {
  return value === undefined ? undefined : enumValue(value, allowed, allowed[0]);
}

function recordValue(value: unknown, fallback: JsonRecord): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as JsonRecord) : fallback;
}

function optionalRecord(value: unknown): JsonRecord | undefined {
  return value === undefined ? undefined : recordValue(value, {});
}

function arrayRecord(value: unknown): JsonRecord[] {
  return Array.isArray(value) ? value.filter((item): item is JsonRecord => Boolean(item && typeof item === "object" && !Array.isArray(item))) : [];
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function optionalStringArray(value: unknown): string[] | undefined {
  return value === undefined ? undefined : stringArray(value);
}

function pickDefined<T extends Record<string, unknown>>(input: T): Partial<T> {
  return Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined)) as Partial<T>;
}

function ratio(recordingMs: unknown, originalMs: unknown): number | null {
  const recording = nullableNumber(recordingMs);
  const original = nullableNumber(originalMs);
  if (!recording || !original) return null;
  return recording / original;
}

function textMatchLevel(rate: number): "accurate" | "partial" | "low" {
  if (rate >= 0.9) return "accurate";
  if (rate >= 0.6) return "partial";
  return "low";
}

function tryParseEntityId(value: string): EntityId | null {
  try {
    return EntityIdCodec.parse(value);
  } catch {
    return null;
  }
}

function slugValue(value: unknown, fallback: string): string {
  const source = typeof value === "string" && value.length > 0 ? value : fallback;
  const slug = source.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return slug || "content";
}
