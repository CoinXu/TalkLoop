import { and, asc, desc, eq, ilike, inArray, notInArray, sql } from "drizzle-orm";
import type { EntityId } from "../domain/EntityId.js";
import type { AppDatabase } from "../infrastructure/database/Database.js";
import {
  annotationResults,
  annotationTasks,
  assessmentConfigs,
  assessmentItems,
  assessmentSessions,
  corpusScenes,
  corpusSentences,
  courseProgress,
  courseReports,
  courses,
  dailyTaskItems,
  dailyTasks,
  dailyTaskStrategies,
  listenRepeatAttempts,
  practiceRuleConfigs,
  sentenceLearningStats,
  userAssessmentResults,
  userLearningStats,
  userVocabularyEntries,
  userVocabularyEvents,
  wordActivationAttempts,
  wordEntries,
  hearingTrapWords,
  wordSenses,
} from "../infrastructure/database/schema.js";
import type { SnowflakeIdGenerator } from "../infrastructure/SnowflakeIdGenerator.js";

export type SceneRow = typeof corpusScenes.$inferSelect;
export type CourseRow = typeof courses.$inferSelect;
export type SentenceRow = typeof corpusSentences.$inferSelect;
export type AnnotationTaskRow = typeof annotationTasks.$inferSelect;
export type AnnotationResultRow = typeof annotationResults.$inferSelect;
export type AssessmentConfigRow = typeof assessmentConfigs.$inferSelect;
export type AssessmentItemRow = typeof assessmentItems.$inferSelect;
export type AssessmentSessionRow = typeof assessmentSessions.$inferSelect;
export type UserVocabularyEntryRow = typeof userVocabularyEntries.$inferSelect;
export type WordSenseRow = typeof wordSenses.$inferSelect;
export type UserVocabularyWithWordRow = UserVocabularyEntryRow & { senses: WordSenseRow[]; wordEntry: WordRow };
export type DailyTaskRow = typeof dailyTasks.$inferSelect;
export type DailyTaskItemRow = typeof dailyTaskItems.$inferSelect;
export type ListenRepeatAttemptRow = typeof listenRepeatAttempts.$inferSelect;
export type CourseReportRow = typeof courseReports.$inferSelect;
export type WordRow = typeof wordEntries.$inferSelect;
export type AssessmentWordRow = WordRow & { assessmentMeaning: string };

export interface ListQuery {
  keyword?: string | undefined;
  publishStatus?: string | undefined;
  reviewStatus?: string | undefined;
  status?: string | undefined;
  limit: number;
  offset: number;
}

export interface UserVocabularyListQuery {
  dueOnly?: boolean | undefined;
  limit: number;
  offset: number;
  skipCountMin?: number | undefined;
  source?: string | undefined;
  status?: string | undefined;
  userId: string;
  wordId?: EntityId | undefined;
}

export interface ListenRepeatListQuery {
  asrStatus?: string | undefined;
  limit: number;
  maxTextMatchRate?: number | undefined;
  minTextMatchRate?: number | undefined;
  mode?: string | undefined;
  offset: number;
  sentenceId?: EntityId | undefined;
  textMatchLevel?: string | undefined;
  userId?: string | undefined;
}

export interface CourseReportListQuery {
  courseId?: EntityId | undefined;
  limit: number;
  maxAverageAccuracy?: number | undefined;
  minAverageAccuracy?: number | undefined;
  offset: number;
  userId?: string | undefined;
}

export interface AnnotationResultListQuery extends ListQuery {
  algorithmVersion?: string | undefined;
  maxConfidence?: number | undefined;
  minConfidence?: number | undefined;
  resultStatus?: string | undefined;
  resultType?: string | undefined;
  targetId?: EntityId | undefined;
  targetType?: string | undefined;
  taskId?: EntityId | undefined;
  trapType?: string | undefined;
}

export interface AssessmentBandQuery {
  difficultyLevel: number;
  excludeWordIds?: EntityId[] | undefined;
  limit: number;
  maxLg10wf: number;
  minLg10wf: number;
  offset?: number | undefined;
}

type Patch<T> = Partial<Omit<T, "id" | "createdAt" | "updatedAt">>;

export class LearningActivationRepository {
  constructor(
    private readonly db: AppDatabase,
    private readonly idGenerator: SnowflakeIdGenerator,
  ) {}

  nextId(): EntityId {
    return this.idGenerator.nextId();
  }

  now(): Date {
    return this.idGenerator.now();
  }

  async listPublicScenes(): Promise<SceneRow[]> {
    return this.db.select().from(corpusScenes).where(eq(corpusScenes.publishStatus, "published")).orderBy(asc(corpusScenes.sortOrder), asc(corpusScenes.name));
  }

  async listScenes(query: ListQuery): Promise<SceneRow[]> {
    const filters = [];
    if (query.keyword) filters.push(ilike(corpusScenes.name, `%${query.keyword}%`));
    if (query.publishStatus) filters.push(eq(corpusScenes.publishStatus, query.publishStatus));
    return this.db.select().from(corpusScenes).where(filters.length > 0 ? and(...filters) : undefined).orderBy(asc(corpusScenes.sortOrder)).limit(query.limit).offset(query.offset);
  }

  async createScene(input: Omit<typeof corpusScenes.$inferInsert, "id" | "createdAt" | "updatedAt">): Promise<SceneRow> {
    return this.insertReturning(corpusScenes, input);
  }

  async updateScene(id: EntityId, patch: Partial<Omit<typeof corpusScenes.$inferInsert, "id" | "createdAt" | "updatedAt">>) {
    return this.updateReturning(corpusScenes, corpusScenes.id, id, patch);
  }

  async listPublicCourses(sceneId?: EntityId): Promise<CourseRow[]> {
    const filters = [eq(courses.publishStatus, "published")];
    if (sceneId) filters.push(eq(courses.sceneId, sceneId));
    return this.db.select().from(courses).where(and(...filters)).orderBy(asc(courses.sortOrder), asc(courses.title));
  }

  async listCourses(query: ListQuery & { sceneId?: EntityId | undefined; level?: number | undefined }): Promise<CourseRow[]> {
    const filters = [];
    if (query.keyword) filters.push(ilike(courses.title, `%${query.keyword}%`));
    if (query.publishStatus) filters.push(eq(courses.publishStatus, query.publishStatus));
    if (query.sceneId) filters.push(eq(courses.sceneId, query.sceneId));
    if (query.level) filters.push(eq(courses.level, query.level));
    return this.db.select().from(courses).where(filters.length > 0 ? and(...filters) : undefined).orderBy(asc(courses.sortOrder)).limit(query.limit).offset(query.offset);
  }

  async findCourse(id: EntityId): Promise<CourseRow | undefined> {
    return this.db.query.courses.findFirst({ where: eq(courses.id, id) });
  }

  async courseSentenceCount(courseId: EntityId): Promise<number> {
    const [row] = await this.db.select({ count: sql<number>`count(*)::int` }).from(corpusSentences).where(eq(corpusSentences.courseId, courseId));
    return row?.count ?? 0;
  }

  async courseSentencesForValidation(courseId: EntityId): Promise<SentenceRow[]> {
    return this.db.select().from(corpusSentences).where(eq(corpusSentences.courseId, courseId));
  }

  async createCourse(input: Omit<typeof courses.$inferInsert, "id" | "createdAt" | "updatedAt">): Promise<CourseRow> {
    return this.insertReturning(courses, input);
  }

  async updateCourse(id: EntityId, patch: Patch<typeof courses.$inferInsert>) {
    return this.updateReturning(courses, courses.id, id, patch);
  }

  async listSentences(query: ListQuery & { courseId?: EntityId | undefined; sceneId?: EntityId | undefined; difficultyLevel?: number | undefined; audioStatus?: string | undefined; hasAudio?: boolean | undefined; sceneTag?: string | undefined; targetWord?: string | undefined }): Promise<SentenceRow[]> {
    const filters = [];
    if (query.keyword) filters.push(ilike(corpusSentences.sentenceText, `%${query.keyword}%`));
    if (query.publishStatus) filters.push(eq(corpusSentences.publishStatus, query.publishStatus));
    if (query.reviewStatus) filters.push(eq(corpusSentences.reviewStatus, query.reviewStatus));
    if (query.courseId) filters.push(eq(corpusSentences.courseId, query.courseId));
    if (query.sceneId) filters.push(eq(corpusSentences.sceneId, query.sceneId));
    if (query.difficultyLevel) filters.push(eq(corpusSentences.difficultyLevel, query.difficultyLevel));
    if (query.audioStatus) filters.push(eq(corpusSentences.audioStatus, query.audioStatus));
    if (query.hasAudio !== undefined) filters.push(query.hasAudio ? sql`${corpusSentences.normalAudioUrl} IS NOT NULL AND ${corpusSentences.slowAudioUrl} IS NOT NULL` : sql`${corpusSentences.normalAudioUrl} IS NULL OR ${corpusSentences.slowAudioUrl} IS NULL`);
    if (query.sceneTag) filters.push(sql`${corpusSentences.sceneTags} @> ${JSON.stringify([query.sceneTag])}::jsonb`);
    if (query.targetWord) filters.push(sql`${corpusSentences.targetWords} @> ${JSON.stringify([query.targetWord])}::jsonb`);
    return this.db.select().from(corpusSentences).where(filters.length > 0 ? and(...filters) : undefined).orderBy(asc(corpusSentences.sortOrder)).limit(query.limit).offset(query.offset);
  }

  async findSentence(id: EntityId): Promise<SentenceRow | undefined> {
    return this.db.query.corpusSentences.findFirst({ where: eq(corpusSentences.id, id) });
  }

  async createSentence(input: Omit<typeof corpusSentences.$inferInsert, "id" | "createdAt" | "updatedAt">): Promise<SentenceRow> {
    return this.insertReturning(corpusSentences, input);
  }

  async updateSentence(id: EntityId, patch: Patch<typeof corpusSentences.$inferInsert>) {
    return this.updateReturning(corpusSentences, corpusSentences.id, id, patch);
  }

  async listAnnotationTasks(query: ListQuery & { targetType?: string | undefined; taskType?: string | undefined; targetId?: EntityId | undefined; algorithmVersion?: string | undefined }): Promise<AnnotationTaskRow[]> {
    const filters = [];
    if (query.reviewStatus) filters.push(eq(annotationTasks.reviewStatus, query.reviewStatus));
    if (query.targetType) filters.push(eq(annotationTasks.targetType, query.targetType));
    if (query.taskType) filters.push(eq(annotationTasks.taskType, query.taskType));
    if (query.targetId) filters.push(eq(annotationTasks.targetId, query.targetId));
    if (query.algorithmVersion) filters.push(eq(annotationTasks.algorithmVersion, query.algorithmVersion));
    return this.db.select().from(annotationTasks).where(filters.length > 0 ? and(...filters) : undefined).orderBy(desc(annotationTasks.createdAt)).limit(query.limit).offset(query.offset);
  }

  async createAnnotationTask(input: Omit<typeof annotationTasks.$inferInsert, "id" | "createdAt" | "updatedAt">): Promise<AnnotationTaskRow> {
    return this.insertReturning(annotationTasks, input);
  }

  async updateAnnotationTask(id: EntityId, patch: Patch<typeof annotationTasks.$inferInsert>) {
    return this.updateReturning(annotationTasks, annotationTasks.id, id, patch);
  }

  async findAnnotationTask(id: EntityId): Promise<AnnotationTaskRow | undefined> {
    return this.db.query.annotationTasks.findFirst({ where: eq(annotationTasks.id, id) });
  }

  async listAnnotationResults(query: AnnotationResultListQuery): Promise<AnnotationResultRow[]> {
    const filters = [];
    if (query.resultStatus) filters.push(eq(annotationResults.resultStatus, query.resultStatus));
    if (query.reviewStatus) filters.push(eq(annotationResults.resultStatus, query.reviewStatus));
    if (query.resultType) filters.push(eq(annotationResults.resultType, query.resultType));
    if (query.targetType) filters.push(eq(annotationResults.targetType, query.targetType));
    if (query.targetId) filters.push(eq(annotationResults.targetId, query.targetId));
    if (query.taskId) filters.push(eq(annotationResults.taskId, query.taskId));
    if (query.trapType) filters.push(eq(annotationResults.trapType, query.trapType));
    if (query.algorithmVersion) filters.push(eq(annotationResults.algorithmVersion, query.algorithmVersion));
    if (query.minConfidence !== undefined) filters.push(sql`${annotationResults.confidence}::numeric >= ${query.minConfidence}`);
    if (query.maxConfidence !== undefined) filters.push(sql`${annotationResults.confidence}::numeric <= ${query.maxConfidence}`);
    return this.db
      .select()
      .from(annotationResults)
      .where(filters.length > 0 ? and(...filters) : undefined)
      .orderBy(desc(annotationResults.createdAt))
      .limit(query.limit)
      .offset(query.offset);
  }

  async createAnnotationResults(rows: Array<Omit<typeof annotationResults.$inferInsert, "id" | "createdAt" | "updatedAt">>): Promise<number> {
    if (rows.length === 0) return 0;
    const now = this.now();
    const batchSize = 250;
    for (let offset = 0; offset < rows.length; offset += batchSize) {
      const batch = rows.slice(offset, offset + batchSize);
      await this.db.insert(annotationResults).values(batch.map((row) => ({ ...row, createdAt: now, id: this.nextId(), updatedAt: now })));
    }
    return rows.length;
  }

  async updateAnnotationResult(id: EntityId, patch: Patch<typeof annotationResults.$inferInsert>) {
    return this.updateReturning(annotationResults, annotationResults.id, id, patch);
  }

  async findAnnotationResultsByIds(ids: EntityId[]): Promise<AnnotationResultRow[]> {
    if (ids.length === 0) return [];
    return this.db.select().from(annotationResults).where(inArray(annotationResults.id, ids));
  }

  async bulkUpdateAnnotationResults(ids: EntityId[], patch: Patch<typeof annotationResults.$inferInsert>): Promise<number> {
    if (ids.length === 0) return 0;
    const result = await this.db.update(annotationResults).set({ ...patch, updatedAt: this.now() }).where(inArray(annotationResults.id, ids));
    return Number(result.rowCount ?? 0);
  }

  async annotationWordCandidates(input: { limit: number; offset: number; targetId?: EntityId | undefined }): Promise<Array<WordRow & { hearingTraps: Record<string, unknown>[] }>> {
    const filters = [];
    if (input.targetId) filters.push(eq(wordEntries.id, input.targetId));
    const rows = await this.db
      .select({ traps: hearingTrapWords.traps, word: wordEntries })
      .from(wordEntries)
      .leftJoin(hearingTrapWords, eq(hearingTrapWords.sourceWordId, wordEntries.id))
      .where(filters.length > 0 ? and(...filters) : undefined)
      .orderBy(asc(wordEntries.word))
      .limit(input.limit)
      .offset(input.offset);
    return rows.map((row) => ({ ...row.word, hearingTraps: Array.isArray(row.traps) ? row.traps as Record<string, unknown>[] : [] }));
  }

  async annotationSentenceCandidates(input: { limit: number; offset: number; targetId?: EntityId | undefined }): Promise<SentenceRow[]> {
    const filters = [];
    if (input.targetId) filters.push(eq(corpusSentences.id, input.targetId));
    return this.db
      .select()
      .from(corpusSentences)
      .where(filters.length > 0 ? and(...filters) : undefined)
      .orderBy(asc(corpusSentences.sortOrder), asc(corpusSentences.sentenceText))
      .limit(input.limit)
      .offset(input.offset);
  }

  async updateAnnotationWord(id: EntityId, patch: Partial<Pick<typeof wordEntries.$inferInsert, "distractors" | "levelTags" | "sceneTags">>) {
    return this.updateReturning(wordEntries, wordEntries.id, id, patch);
  }

  async listAssessmentConfigs(query: ListQuery & { version?: string | undefined }): Promise<AssessmentConfigRow[]> {
    const filters = [];
    if (query.status) filters.push(eq(assessmentConfigs.status, query.status));
    if (query.keyword) filters.push(ilike(assessmentConfigs.version, `%${query.keyword}%`));
    if (query.version) filters.push(eq(assessmentConfigs.version, query.version));
    return this.db.select().from(assessmentConfigs).where(filters.length > 0 ? and(...filters) : undefined).orderBy(desc(assessmentConfigs.createdAt)).limit(query.limit).offset(query.offset);
  }

  async activeAssessmentConfig(): Promise<AssessmentConfigRow | undefined> {
    return this.db.query.assessmentConfigs.findFirst({ where: eq(assessmentConfigs.status, "active"), orderBy: desc(assessmentConfigs.createdAt) });
  }

  async createAssessmentConfig(input: Omit<typeof assessmentConfigs.$inferInsert, "id" | "createdAt" | "updatedAt">): Promise<AssessmentConfigRow> {
    return this.insertReturning(assessmentConfigs, input);
  }

  async createAssessmentResult(input: Omit<typeof userAssessmentResults.$inferInsert, "id" | "createdAt" | "updatedAt">) {
    return this.insertReturning(userAssessmentResults, input);
  }

  async findActiveAssessmentSession(userId: string): Promise<AssessmentSessionRow | undefined> {
    return this.db.query.assessmentSessions.findFirst({
      where: and(eq(assessmentSessions.userId, userId), eq(assessmentSessions.status, "in_progress"), sql`${assessmentSessions.expiresAt} > now()`),
      orderBy: desc(assessmentSessions.updatedAt),
    });
  }

  async findAssessmentSession(id: EntityId): Promise<AssessmentSessionRow | undefined> {
    return this.db.query.assessmentSessions.findFirst({ where: eq(assessmentSessions.id, id) });
  }

  async createAssessmentSession(input: Omit<typeof assessmentSessions.$inferInsert, "id" | "createdAt" | "updatedAt">): Promise<AssessmentSessionRow> {
    return this.insertReturning(assessmentSessions, input);
  }

  async updateAssessmentSession(id: EntityId, patch: Patch<typeof assessmentSessions.$inferInsert>) {
    return this.updateReturning(assessmentSessions, assessmentSessions.id, id, patch);
  }

  async createAssessmentItems(rows: Array<Omit<typeof assessmentItems.$inferInsert, "id" | "createdAt" | "updatedAt">>): Promise<number> {
    if (rows.length === 0) return 0;
    const now = this.now();
    await this.db.insert(assessmentItems).values(rows.map((row) => ({ ...row, createdAt: now, id: this.nextId(), updatedAt: now }))).onConflictDoNothing();
    return rows.length;
  }

  async listAssessmentItems(sessionId: EntityId): Promise<AssessmentItemRow[]> {
    return this.db.select().from(assessmentItems).where(eq(assessmentItems.sessionId, sessionId)).orderBy(asc(assessmentItems.roundIndex), asc(assessmentItems.itemIndex));
  }

  async listAssessmentRoundItems(sessionId: EntityId, roundIndex: number): Promise<AssessmentItemRow[]> {
    return this.db
      .select()
      .from(assessmentItems)
      .where(and(eq(assessmentItems.sessionId, sessionId), eq(assessmentItems.roundIndex, roundIndex)))
      .orderBy(asc(assessmentItems.itemIndex));
  }

  async updateAssessmentItem(id: EntityId, patch: Patch<typeof assessmentItems.$inferInsert>) {
    return this.updateReturning(assessmentItems, assessmentItems.id, id, patch);
  }

  async assessmentQuestionCandidates(query: AssessmentBandQuery): Promise<AssessmentWordRow[]> {
    const filters = [
      eq(wordEntries.publishStatus, "published"),
      eq(wordEntries.reviewStatus, "approved"),
      eq(wordEntries.isExcluded, false),
      sql`((${wordEntries.meaningCn} IS NOT NULL AND length(trim(${wordEntries.meaningCn})) > 0) OR EXISTS (SELECT 1 FROM word_senses WHERE word_senses.word_id = ${wordEntries.id}))`,
      sql`${wordEntries.lg10wf} IS NOT NULL`,
      sql`${wordEntries.lg10wf}::numeric >= ${query.minLg10wf}`,
      sql`${wordEntries.lg10wf}::numeric < ${query.maxLg10wf}`,
    ];
    if (query.excludeWordIds?.length) filters.push(notInArray(wordEntries.id, query.excludeWordIds));
    const rows = await this.db
      .select()
      .from(wordEntries)
      .where(and(...filters))
      .orderBy(desc(wordEntries.frequencyCount), asc(wordEntries.word))
      .limit(query.limit)
      .offset(query.offset ?? 0);
    return this.withAssessmentMeanings(rows);
  }

  async assessmentDistractors(input: { difficultyLevel: number; excludeWordIds: EntityId[]; limit: number }): Promise<AssessmentWordRow[]> {
    const filters = [
      eq(wordEntries.publishStatus, "published"),
      eq(wordEntries.reviewStatus, "approved"),
      eq(wordEntries.isExcluded, false),
      sql`((${wordEntries.meaningCn} IS NOT NULL AND length(trim(${wordEntries.meaningCn})) > 0) OR EXISTS (SELECT 1 FROM word_senses WHERE word_senses.word_id = ${wordEntries.id}))`,
    ];
    if (input.excludeWordIds.length) filters.push(notInArray(wordEntries.id, input.excludeWordIds));
    const rows = await this.db
      .select()
      .from(wordEntries)
      .where(and(...filters))
      .orderBy(sql`random()`)
      .limit(input.limit);
    return this.withAssessmentMeanings(rows);
  }

  private async withAssessmentMeanings(rows: WordRow[]): Promise<AssessmentWordRow[]> {
    if (rows.length === 0) return [];
    const missing = rows.filter((row) => !row.meaningCn);
    const senses = missing.length === 0
      ? []
      : await this.db
        .select()
        .from(wordSenses)
        .where(inArray(wordSenses.wordId, missing.map((row) => row.id)))
        .orderBy(wordSenses.wordId, wordSenses.senseIndex, wordSenses.definitionIndex);
    const firstSenseByWordId = new Map<string, string>();
    for (const sense of senses) {
      const key = String(sense.wordId);
      if (!firstSenseByWordId.has(key)) firstSenseByWordId.set(key, sense.definition);
    }
    return rows.map((row) => ({ ...row, assessmentMeaning: row.meaningCn ?? firstSenseByWordId.get(String(row.id)) ?? "" }));
  }

  async publishedWordsForInitialVocabulary(limit: number): Promise<WordRow[]> {
    return this.db
      .select()
      .from(wordEntries)
      .where(
        and(
          eq(wordEntries.publishStatus, "published"),
          eq(wordEntries.reviewStatus, "approved"),
          eq(wordEntries.audioStatus, "ready"),
          eq(wordEntries.isExcluded, false),
        ),
      )
      .orderBy(desc(wordEntries.lg10wf), desc(wordEntries.frequencyCount))
      .limit(limit);
  }

  async publishedWordsForInitialVocabularyBoundary(input: { limit: number; maxDifficultyLevel: number; minLg10wf: number }): Promise<WordRow[]> {
    return this.db
      .select()
      .from(wordEntries)
      .where(
        and(
          eq(wordEntries.publishStatus, "published"),
          eq(wordEntries.reviewStatus, "approved"),
          eq(wordEntries.isExcluded, false),
          sql`((${wordEntries.meaningCn} IS NOT NULL AND length(trim(${wordEntries.meaningCn})) > 0) OR EXISTS (SELECT 1 FROM word_senses WHERE word_senses.word_id = ${wordEntries.id}))`,
          sql`${wordEntries.lg10wf} IS NOT NULL`,
          sql`${wordEntries.lg10wf}::numeric >= ${input.minLg10wf}`,
        ),
      )
      .orderBy(desc(wordEntries.lg10wf), desc(wordEntries.frequencyCount))
      .limit(input.limit);
  }

  async listUserVocabulary(query: UserVocabularyListQuery): Promise<UserVocabularyWithWordRow[]> {
    const filters = [eq(userVocabularyEntries.userId, query.userId)];
    if (query.status) filters.push(eq(userVocabularyEntries.activationStatus, query.status));
    if (query.source) filters.push(eq(userVocabularyEntries.source, query.source));
    if (query.wordId) filters.push(eq(userVocabularyEntries.wordId, query.wordId));
    if (query.dueOnly) filters.push(sql`${userVocabularyEntries.nextReviewAt} <= now()`);
    if (query.skipCountMin !== undefined) filters.push(sql`${userVocabularyEntries.skipCount} >= ${query.skipCountMin}`);
    const rows = await this.db
      .select({ entry: userVocabularyEntries, wordEntry: wordEntries })
      .from(userVocabularyEntries)
      .innerJoin(wordEntries, eq(wordEntries.id, userVocabularyEntries.wordId))
      .where(and(...filters))
      .orderBy(asc(userVocabularyEntries.activationStatus), desc(userVocabularyEntries.updatedAt))
      .limit(query.limit)
      .offset(query.offset);
    if (rows.length === 0) return [];
    const senses = await this.db
      .select()
      .from(wordSenses)
      .where(inArray(wordSenses.wordId, rows.map((row) => row.entry.wordId)))
      .orderBy(wordSenses.wordId, wordSenses.senseIndex, wordSenses.definitionIndex);
    const sensesByWordId = new Map<string, WordSenseRow[]>();
    for (const sense of senses) {
      const key = String(sense.wordId);
      sensesByWordId.set(key, [...(sensesByWordId.get(key) ?? []), sense]);
    }
    return rows.map((row) => ({ ...row.entry, senses: sensesByWordId.get(String(row.entry.wordId)) ?? [], wordEntry: row.wordEntry }));
  }

  async vocabularySummary(userId: string): Promise<Record<string, number>> {
    const rows = await this.db
      .select({ status: userVocabularyEntries.activationStatus, count: sql<number>`count(*)::int` })
      .from(userVocabularyEntries)
      .where(eq(userVocabularyEntries.userId, userId))
      .groupBy(userVocabularyEntries.activationStatus);
    return Object.fromEntries(rows.map((row) => [row.status, row.count]));
  }

  async createUserVocabularyEntry(input: Omit<typeof userVocabularyEntries.$inferInsert, "id" | "createdAt" | "updatedAt">): Promise<UserVocabularyEntryRow> {
    const now = this.now();
    const [row] = await this.db
      .insert(userVocabularyEntries)
      .values({ ...input, id: this.nextId(), createdAt: now, updatedAt: now })
      .onConflictDoNothing({ target: [userVocabularyEntries.userId, userVocabularyEntries.wordId] })
      .returning();
    if (row) return row;
    const existing = await this.findUserVocabulary(input.userId, input.wordId);
    if (!existing) throw new Error("Failed to create user vocabulary entry");
    return existing;
  }

  async findUserVocabulary(userId: string, wordId: EntityId): Promise<UserVocabularyEntryRow | undefined> {
    return this.db.query.userVocabularyEntries.findFirst({ where: and(eq(userVocabularyEntries.userId, userId), eq(userVocabularyEntries.wordId, wordId)) });
  }

  async updateUserVocabulary(id: EntityId, patch: Partial<Omit<typeof userVocabularyEntries.$inferInsert, "id" | "createdAt" | "updatedAt">>) {
    return this.updateReturning(userVocabularyEntries, userVocabularyEntries.id, id, patch);
  }

  async createUserVocabularyEvent(input: Omit<typeof userVocabularyEvents.$inferInsert, "id" | "createdAt">) {
    const [row] = await this.db.insert(userVocabularyEvents).values({ ...input, id: this.nextId(), createdAt: this.now() }).returning();
    return row;
  }

  async listPracticeRules(query: ListQuery & { version?: string | undefined }) {
    const filters = [];
    if (query.status) filters.push(eq(practiceRuleConfigs.status, query.status));
    if (query.version) filters.push(eq(practiceRuleConfigs.version, query.version));
    return this.db.select().from(practiceRuleConfigs).where(filters.length > 0 ? and(...filters) : undefined).orderBy(desc(practiceRuleConfigs.createdAt)).limit(query.limit).offset(query.offset);
  }

  async createPracticeRule(input: Omit<typeof practiceRuleConfigs.$inferInsert, "id" | "createdAt" | "updatedAt">) {
    return this.insertReturning(practiceRuleConfigs, input);
  }

  async createWordActivationAttempt(input: Omit<typeof wordActivationAttempts.$inferInsert, "id" | "createdAt">) {
    const [row] = await this.db.insert(wordActivationAttempts).values({ ...input, id: this.nextId(), createdAt: this.now() }).returning();
    if (!row) throw new Error("Failed to create word activation attempt");
    return row;
  }

  async recentActivationAttempts(userId: string, wordId: EntityId, practiceType: string, limit: number) {
    return this.db
      .select()
      .from(wordActivationAttempts)
      .where(and(eq(wordActivationAttempts.userId, userId), eq(wordActivationAttempts.wordId, wordId), eq(wordActivationAttempts.practiceType, practiceType)))
      .orderBy(desc(wordActivationAttempts.createdAt))
      .limit(limit);
  }

  async listDailyTaskStrategies(query: ListQuery & { version?: string | undefined }) {
    const filters = [];
    if (query.status) filters.push(eq(dailyTaskStrategies.status, query.status));
    if (query.version) filters.push(eq(dailyTaskStrategies.version, query.version));
    return this.db.select().from(dailyTaskStrategies).where(filters.length > 0 ? and(...filters) : undefined).orderBy(desc(dailyTaskStrategies.createdAt)).limit(query.limit).offset(query.offset);
  }

  async createDailyTaskStrategy(input: Omit<typeof dailyTaskStrategies.$inferInsert, "id" | "createdAt" | "updatedAt">) {
    return this.insertReturning(dailyTaskStrategies, input);
  }

  async activeDailyTaskStrategy() {
    return this.db.query.dailyTaskStrategies.findFirst({ where: eq(dailyTaskStrategies.status, "active"), orderBy: desc(dailyTaskStrategies.createdAt) });
  }

  async findDailyTask(userId: string, taskDate: string): Promise<DailyTaskRow | undefined> {
    return this.db.query.dailyTasks.findFirst({ where: and(eq(dailyTasks.userId, userId), eq(dailyTasks.taskDate, taskDate)) });
  }

  async resetDailyTask(userId: string, taskDate: string): Promise<{ deletedTaskItems: number; deletedTasks: number }> {
    const existing = await this.findDailyTask(userId, taskDate);
    if (!existing) return { deletedTaskItems: 0, deletedTasks: 0 };
    const deletedItems = await this.db.delete(dailyTaskItems).where(eq(dailyTaskItems.dailyTaskId, existing.id));
    const deletedTasks = await this.db.delete(dailyTasks).where(eq(dailyTasks.id, existing.id));
    return { deletedTaskItems: deletedItems.rowCount ?? 0, deletedTasks: deletedTasks.rowCount ?? 0 };
  }

  async dailyAudioMeaningCandidates(userId: string, limit: number): Promise<UserVocabularyEntryRow[]> {
    return this.db
      .select()
      .from(userVocabularyEntries)
      .where(and(eq(userVocabularyEntries.userId, userId), eq(userVocabularyEntries.activationStatus, "red")))
      .orderBy(asc(userVocabularyEntries.skipCount), asc(userVocabularyEntries.nextReviewAt))
      .limit(limit);
  }

  async dailyReviewCandidates(userId: string, limit: number): Promise<UserVocabularyEntryRow[]> {
    return this.db
      .select()
      .from(userVocabularyEntries)
      .where(and(eq(userVocabularyEntries.userId, userId), sql`${userVocabularyEntries.nextReviewAt} <= now()`))
      .orderBy(asc(userVocabularyEntries.nextReviewAt))
      .limit(limit);
  }

  async repeatSentenceCandidates(limit: number): Promise<SentenceRow[]> {
    return this.db
      .select()
      .from(corpusSentences)
      .where(and(eq(corpusSentences.publishStatus, "published"), eq(corpusSentences.reviewStatus, "approved"), eq(corpusSentences.audioStatus, "ready")))
      .orderBy(asc(corpusSentences.difficultyLevel), asc(corpusSentences.sortOrder))
      .limit(limit);
  }

  async createDailyTask(input: Omit<typeof dailyTasks.$inferInsert, "id" | "createdAt" | "updatedAt">): Promise<DailyTaskRow> {
    return this.insertReturning(dailyTasks, input);
  }

  async listDailyTaskItems(dailyTaskId: EntityId) {
    return this.db.select().from(dailyTaskItems).where(eq(dailyTaskItems.dailyTaskId, dailyTaskId)).orderBy(desc(dailyTaskItems.priorityScore));
  }

  async createDailyTaskItem(input: Omit<typeof dailyTaskItems.$inferInsert, "id" | "createdAt" | "updatedAt">) {
    return this.insertReturning(dailyTaskItems, input);
  }

  async completeDailyTaskItemForWord(userId: string, taskDate: string, wordId: EntityId, itemTypes: string[]): Promise<DailyTaskItemRow | undefined> {
    const [match] = await this.db
      .select({ item: dailyTaskItems })
      .from(dailyTaskItems)
      .innerJoin(dailyTasks, eq(dailyTaskItems.dailyTaskId, dailyTasks.id))
      .where(and(eq(dailyTasks.userId, userId), eq(dailyTasks.taskDate, taskDate), eq(dailyTaskItems.status, "pending"), eq(dailyTaskItems.wordId, wordId), inArray(dailyTaskItems.itemType, itemTypes)))
      .orderBy(desc(dailyTaskItems.priorityScore), asc(dailyTaskItems.createdAt))
      .limit(1);
    if (!match) return undefined;
    const completed = await this.completeDailyTaskItem(match.item.id);
    await this.completeDailyTaskIfNoPending(match.item.dailyTaskId);
    return completed;
  }

  async completeDailyTaskItemForSentence(userId: string, taskDate: string, sentenceId: EntityId): Promise<DailyTaskItemRow | undefined> {
    const [match] = await this.db
      .select({ item: dailyTaskItems })
      .from(dailyTaskItems)
      .innerJoin(dailyTasks, eq(dailyTaskItems.dailyTaskId, dailyTasks.id))
      .where(and(eq(dailyTasks.userId, userId), eq(dailyTasks.taskDate, taskDate), eq(dailyTaskItems.status, "pending"), eq(dailyTaskItems.itemType, "repeat_sentence"), eq(dailyTaskItems.sentenceId, sentenceId)))
      .orderBy(desc(dailyTaskItems.priorityScore), asc(dailyTaskItems.createdAt))
      .limit(1);
    if (!match) return undefined;
    const completed = await this.completeDailyTaskItem(match.item.id);
    await this.completeDailyTaskIfNoPending(match.item.dailyTaskId);
    return completed;
  }

  private async completeDailyTaskItem(id: EntityId): Promise<DailyTaskItemRow | undefined> {
    const [row] = await this.db.update(dailyTaskItems).set({ status: "completed", updatedAt: this.now() }).where(eq(dailyTaskItems.id, id)).returning();
    return row;
  }

  private async completeDailyTaskIfNoPending(dailyTaskId: EntityId): Promise<void> {
    const [{ pendingCount } = { pendingCount: 0 }] = await this.db
      .select({ pendingCount: sql<number>`count(*)::int` })
      .from(dailyTaskItems)
      .where(and(eq(dailyTaskItems.dailyTaskId, dailyTaskId), eq(dailyTaskItems.status, "pending")));
    if (pendingCount === 0) {
      await this.db.update(dailyTasks).set({ status: "completed", updatedAt: this.now() }).where(eq(dailyTasks.id, dailyTaskId));
    }
  }

  async createListenRepeatAttempt(input: Omit<typeof listenRepeatAttempts.$inferInsert, "id" | "createdAt">): Promise<ListenRepeatAttemptRow> {
    const [row] = await this.db.insert(listenRepeatAttempts).values({ ...input, id: this.nextId(), createdAt: this.now() }).returning();
    if (!row) throw new Error("Failed to create listen-repeat attempt");
    return row;
  }

  async listListenRepeatAttempts(query: ListenRepeatListQuery): Promise<ListenRepeatAttemptRow[]> {
    const filters = [];
    if (query.userId) filters.push(eq(listenRepeatAttempts.userId, query.userId));
    if (query.sentenceId) filters.push(eq(listenRepeatAttempts.sentenceId, query.sentenceId));
    if (query.mode) filters.push(eq(listenRepeatAttempts.mode, query.mode));
    if (query.asrStatus) filters.push(eq(listenRepeatAttempts.asrStatus, query.asrStatus));
    if (query.textMatchLevel) filters.push(eq(listenRepeatAttempts.textMatchLevel, query.textMatchLevel));
    if (query.minTextMatchRate !== undefined) filters.push(sql`${listenRepeatAttempts.textMatchRate}::numeric >= ${query.minTextMatchRate}`);
    if (query.maxTextMatchRate !== undefined) filters.push(sql`${listenRepeatAttempts.textMatchRate}::numeric <= ${query.maxTextMatchRate}`);
    return this.db
      .select()
      .from(listenRepeatAttempts)
      .where(filters.length > 0 ? and(...filters) : undefined)
      .orderBy(desc(listenRepeatAttempts.createdAt))
      .limit(query.limit)
      .offset(query.offset);
  }

  async upsertSentenceStat(input: Omit<typeof sentenceLearningStats.$inferInsert, "id" | "createdAt" | "updatedAt">) {
    const now = this.now();
    const [row] = await this.db
      .insert(sentenceLearningStats)
      .values({ ...input, id: this.nextId(), createdAt: now, updatedAt: now })
      .onConflictDoUpdate({
        target: [sentenceLearningStats.userId, sentenceLearningStats.sentenceId],
        set: { ...input, updatedAt: now },
      })
      .returning();
    return row;
  }

  async upsertCourseProgress(input: Omit<typeof courseProgress.$inferInsert, "id" | "createdAt" | "updatedAt">) {
    const now = this.now();
    const [row] = await this.db
      .insert(courseProgress)
      .values({ ...input, id: this.nextId(), createdAt: now, updatedAt: now })
      .onConflictDoUpdate({
        target: [courseProgress.userId, courseProgress.courseId],
        set: { ...input, updatedAt: now },
      })
      .returning();
    return row;
  }

  async createCourseReport(input: Omit<typeof courseReports.$inferInsert, "id" | "createdAt">): Promise<CourseReportRow> {
    const [row] = await this.db.insert(courseReports).values({ ...input, id: this.nextId(), createdAt: this.now() }).returning();
    if (!row) throw new Error("Failed to create course report");
    return row;
  }

  async listCourseReports(query: CourseReportListQuery): Promise<CourseReportRow[]> {
    const filters = [];
    if (query.userId) filters.push(eq(courseReports.userId, query.userId));
    if (query.courseId) filters.push(eq(courseReports.courseId, query.courseId));
    if (query.minAverageAccuracy !== undefined) filters.push(sql`${courseReports.averageAccuracy}::numeric >= ${query.minAverageAccuracy}`);
    if (query.maxAverageAccuracy !== undefined) filters.push(sql`${courseReports.averageAccuracy}::numeric <= ${query.maxAverageAccuracy}`);
    return this.db.select().from(courseReports).where(filters.length > 0 ? and(...filters) : undefined).orderBy(desc(courseReports.createdAt)).limit(query.limit).offset(query.offset);
  }

  async upsertUserLearningStats(input: Omit<typeof userLearningStats.$inferInsert, "id" | "createdAt" | "updatedAt">) {
    const now = this.now();
    const [row] = await this.db
      .insert(userLearningStats)
      .values({ ...input, id: this.nextId(), createdAt: now, updatedAt: now })
      .onConflictDoUpdate({
        target: userLearningStats.userId,
        set: { ...input, updatedAt: now },
      })
      .returning();
    return row;
  }

  private async insertReturning<TTable extends { $inferInsert: { id: EntityId; createdAt: Date; updatedAt: Date }; $inferSelect: unknown }>(
    table: TTable,
    input: Omit<TTable["$inferInsert"], "id" | "createdAt" | "updatedAt">,
  ): Promise<TTable["$inferSelect"]> {
    const now = this.now();
    const [row] = await (this.db as never as { insert: (target: unknown) => { values: (value: unknown) => { returning: () => Promise<unknown[]> } } })
      .insert(table)
      .values({ ...input, id: this.nextId(), createdAt: now, updatedAt: now })
      .returning();
    if (!row) throw new Error("Failed to insert row");
    return row as TTable["$inferSelect"];
  }

  private async updateReturning<TTable extends { $inferInsert: { updatedAt: Date }; $inferSelect: unknown }>(
    table: TTable,
    idColumn: unknown,
    id: EntityId,
    patch: Patch<TTable["$inferInsert"]>,
  ): Promise<{ before: TTable["$inferSelect"]; after: TTable["$inferSelect"] | undefined } | undefined> {
    const [before] = await (this.db as never as { select: () => { from: (target: unknown) => { where: (condition: unknown) => { limit: (limit: number) => Promise<unknown[]> } } } })
      .select()
      .from(table)
      .where(eq(idColumn as never, id))
      .limit(1);
    if (!before) return undefined;
    const [after] = await (this.db as never as { update: (target: unknown) => { set: (value: unknown) => { where: (condition: unknown) => { returning: () => Promise<unknown[]> } } } })
      .update(table)
      .set({ ...patch, updatedAt: this.now() })
      .where(eq(idColumn as never, id))
      .returning();
    return { before: before as TTable["$inferSelect"], after: after as TTable["$inferSelect"] | undefined };
  }
}
