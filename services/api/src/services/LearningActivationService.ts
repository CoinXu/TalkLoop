import { AppError } from "../domain/AppError.js";
import { EntityIdCodec, type EntityId } from "../domain/EntityId.js";
import type {
  AnnotationTaskRow,
  CourseReportRow,
  CourseRow,
  DailyTaskRow,
  LearningActivationRepository,
  ListenRepeatAttemptRow,
  SceneRow,
  SentenceRow,
  UserVocabularyEntryRow,
} from "../repositories/LearningActivationRepository.js";
import type { AdminService, CurrentAdmin } from "./AdminService.js";

export type JsonRecord = Record<string, unknown>;

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
    return Promise.all(courses.map((row) => this.courseWithUnlock(row)));
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

  private async courseWithUnlock(row: CourseRow): Promise<JsonRecord> {
    const sentenceCount = await this.repository.courseSentenceCount(row.id);
    return { ...this.course(row), sentenceCount, unlocked: row.sortOrder < 3, lockReason: row.sortOrder < 3 ? null : "previous_course_required" };
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

  private userVocabulary(row: UserVocabularyEntryRow): JsonRecord {
    return serialize(row, "userVocabularyEntryId");
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

  private async audit(admin: CurrentAdmin, permissionKey: string, action: string, objectType: string, objectId: EntityId, oldValue?: JsonRecord, newValue?: JsonRecord, reason?: string): Promise<void> {
    await this.adminService.audit(admin, permissionKey, action, objectType, EntityIdCodec.stringify(objectId), oldValue, newValue, reason);
  }
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
