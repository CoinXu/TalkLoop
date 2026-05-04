import { and, asc, count, desc, eq, ilike, inArray, isNull, or, sql } from "drizzle-orm";
import type { EntityId } from "../domain/EntityId.js";
import type { AppDatabase } from "../infrastructure/database/Database.js";
import { contentAdminSettings, corpusScenes, corpusSentences, courses } from "../infrastructure/database/schema.js";
import type { SnowflakeIdGenerator } from "../infrastructure/SnowflakeIdGenerator.js";

export type ContentSceneRow = typeof corpusScenes.$inferSelect;
export type ContentCourseRow = typeof courses.$inferSelect;
export type ContentSentenceRow = typeof corpusSentences.$inferSelect;

export interface ContentListQuery {
  audioStatus?: string | undefined;
  assigned?: boolean | undefined;
  courseId?: EntityId | undefined;
  difficultyLevel?: number | undefined;
  hasAudio?: boolean | undefined;
  keyword?: string | undefined;
  limit: number;
  offset: number;
  sceneId?: EntityId | undefined;
  sceneTag?: string | undefined;
  status?: string | undefined;
  targetWord?: string | undefined;
}

export class ContentAdminRepository {
  constructor(
    private readonly db: AppDatabase,
    private readonly idGenerator: SnowflakeIdGenerator,
  ) {}

  now(): Date {
    return this.idGenerator.now();
  }

  nextId(): EntityId {
    return this.idGenerator.nextId();
  }

  async listScenes(query: ContentListQuery): Promise<ContentSceneRow[]> {
    const filters = [];
    if (query.keyword) filters.push(or(ilike(corpusScenes.name, `%${query.keyword}%`), ilike(corpusScenes.slug, `%${query.keyword}%`)));
    if (query.status) filters.push(eq(corpusScenes.publishStatus, query.status));
    return this.db.select().from(corpusScenes).where(filters.length > 0 ? and(...filters) : undefined).orderBy(asc(corpusScenes.sortOrder), asc(corpusScenes.name)).limit(query.limit).offset(query.offset);
  }

  async findScene(id: EntityId): Promise<ContentSceneRow | undefined> {
    return this.db.query.corpusScenes.findFirst({ where: eq(corpusScenes.id, id) });
  }

  async sceneCourseCounts(sceneId: EntityId): Promise<{ courseCount: number; publishedCourseCount: number }> {
    const [row] = await this.db
      .select({ courseCount: count(), publishedCourseCount: sql<number>`count(*) filter (where ${courses.publishStatus} = 'published')::int` })
      .from(courses)
      .where(eq(courses.sceneId, sceneId));
    return { courseCount: row?.courseCount ?? 0, publishedCourseCount: row?.publishedCourseCount ?? 0 };
  }

  async createScene(input: Omit<typeof corpusScenes.$inferInsert, "id" | "createdAt" | "updatedAt">): Promise<ContentSceneRow> {
    return this.insertReturning(corpusScenes, input);
  }

  async updateScene(id: EntityId, patch: Partial<Omit<typeof corpusScenes.$inferInsert, "id" | "createdAt" | "updatedAt">>) {
    return this.updateReturning(corpusScenes, corpusScenes.id, id, patch);
  }

  async listCourses(query: ContentListQuery & { level?: number | undefined }): Promise<ContentCourseRow[]> {
    const filters = [];
    if (query.keyword) filters.push(or(ilike(courses.title, `%${query.keyword}%`), ilike(courses.slug, `%${query.keyword}%`)));
    if (query.status) filters.push(eq(courses.publishStatus, query.status));
    if (query.sceneId) filters.push(eq(courses.sceneId, query.sceneId));
    if (query.level) filters.push(eq(courses.level, query.level));
    return this.db.select().from(courses).where(filters.length > 0 ? and(...filters) : undefined).orderBy(asc(courses.sortOrder), asc(courses.title)).limit(query.limit).offset(query.offset);
  }

  async findCourse(id: EntityId): Promise<ContentCourseRow | undefined> {
    return this.db.query.courses.findFirst({ where: eq(courses.id, id) });
  }

  async courseSentenceCount(courseId: EntityId): Promise<number> {
    const [row] = await this.db.select({ value: count() }).from(corpusSentences).where(eq(corpusSentences.courseId, courseId));
    return row?.value ?? 0;
  }

  async createCourse(input: Omit<typeof courses.$inferInsert, "id" | "createdAt" | "updatedAt">): Promise<ContentCourseRow> {
    return this.insertReturning(courses, input);
  }

  async updateCourse(id: EntityId, patch: Partial<Omit<typeof courses.$inferInsert, "id" | "createdAt" | "updatedAt">>) {
    return this.updateReturning(courses, courses.id, id, patch);
  }

  async listSentences(query: ContentListQuery): Promise<ContentSentenceRow[]> {
    const filters = [];
    if (query.keyword) filters.push(ilike(corpusSentences.sentenceText, `%${query.keyword}%`));
    if (query.status) filters.push(eq(corpusSentences.publishStatus, query.status));
    if (query.sceneId) filters.push(eq(corpusSentences.sceneId, query.sceneId));
    if (query.courseId) filters.push(eq(corpusSentences.courseId, query.courseId));
    if (query.difficultyLevel) filters.push(eq(corpusSentences.difficultyLevel, query.difficultyLevel));
    if (query.audioStatus) filters.push(eq(corpusSentences.audioStatus, query.audioStatus));
    if (query.assigned !== undefined) filters.push(query.assigned ? sql`${corpusSentences.courseId} IS NOT NULL` : isNull(corpusSentences.courseId));
    if (query.hasAudio !== undefined) filters.push(query.hasAudio ? sql`${corpusSentences.normalAudioUrl} IS NOT NULL OR ${corpusSentences.slowAudioUrl} IS NOT NULL` : sql`${corpusSentences.normalAudioUrl} IS NULL AND ${corpusSentences.slowAudioUrl} IS NULL`);
    if (query.sceneTag) filters.push(sql`${corpusSentences.sceneTags} @> ${JSON.stringify([query.sceneTag])}::jsonb`);
    if (query.targetWord) filters.push(sql`${corpusSentences.targetWords} @> ${JSON.stringify([query.targetWord])}::jsonb`);
    return this.db.select().from(corpusSentences).where(filters.length > 0 ? and(...filters) : undefined).orderBy(asc(corpusSentences.sortOrder), desc(corpusSentences.updatedAt)).limit(query.limit).offset(query.offset);
  }

  async findSentence(id: EntityId): Promise<ContentSentenceRow | undefined> {
    return this.db.query.corpusSentences.findFirst({ where: eq(corpusSentences.id, id) });
  }

  async findSentenceByText(sentenceText: string): Promise<ContentSentenceRow | undefined> {
    return this.db.query.corpusSentences.findFirst({ where: eq(corpusSentences.sentenceText, sentenceText) });
  }

  async courseSentences(courseId: EntityId): Promise<ContentSentenceRow[]> {
    return this.db.select().from(corpusSentences).where(eq(corpusSentences.courseId, courseId)).orderBy(asc(corpusSentences.sortOrder), asc(corpusSentences.id));
  }

  async sortOrdersInCourse(courseId: EntityId, sortOrders: number[]): Promise<ContentSentenceRow[]> {
    if (sortOrders.length === 0) return [];
    return this.db.select().from(corpusSentences).where(and(eq(corpusSentences.courseId, courseId), inArray(corpusSentences.sortOrder, sortOrders)));
  }

  async createSentence(input: Omit<typeof corpusSentences.$inferInsert, "id" | "createdAt" | "updatedAt">): Promise<ContentSentenceRow> {
    return this.insertReturning(corpusSentences, input);
  }

  async updateSentence(id: EntityId, patch: Partial<Omit<typeof corpusSentences.$inferInsert, "id" | "createdAt" | "updatedAt">>) {
    return this.updateReturning(corpusSentences, corpusSentences.id, id, patch);
  }

  async updateManySentenceStatus(ids: EntityId[], status: string, adminUserId: EntityId): Promise<void> {
    if (ids.length === 0) return;
    await this.db.update(corpusSentences).set({ publishStatus: status, updatedAt: this.now(), updatedByAdminId: adminUserId }).where(inArray(corpusSentences.id, ids));
  }

  async setting(key: string): Promise<Record<string, unknown> | null> {
    const row = await this.db.query.contentAdminSettings.findFirst({ where: eq(contentAdminSettings.settingKey, key) });
    return row?.settingValue ?? null;
  }

  async upsertSetting(key: string, value: Record<string, unknown>): Promise<Record<string, unknown>> {
    const now = this.now();
    const [row] = await this.db
      .insert(contentAdminSettings)
      .values({ id: this.nextId(), settingKey: key, settingValue: value, createdAt: now, updatedAt: now })
      .onConflictDoUpdate({ target: contentAdminSettings.settingKey, set: { settingValue: value, updatedAt: now } })
      .returning();
    if (!row) throw new Error("Failed to upsert content admin setting");
    return row.settingValue;
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
    if (!row) throw new Error("Failed to insert content admin row");
    return row as TTable["$inferSelect"];
  }

  private async updateReturning<TTable extends { $inferInsert: { updatedAt: Date }; $inferSelect: unknown }>(
    table: TTable,
    idColumn: unknown,
    id: EntityId,
    patch: Partial<Omit<TTable["$inferInsert"], "id" | "createdAt" | "updatedAt">>,
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
