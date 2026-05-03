import { and, desc, eq, ilike, sql } from "drizzle-orm";
import type { AppDatabase } from "../infrastructure/database/Database.js";
import { wordEntries } from "../infrastructure/database/schema.js";
import type { SnowflakeIdGenerator } from "../infrastructure/SnowflakeIdGenerator.js";
import type { EntityId } from "../domain/EntityId.js";

export type WordEntryRow = typeof wordEntries.$inferSelect;
export type WordEntryInsert = typeof wordEntries.$inferInsert;

export interface WordListQuery {
  keyword?: string | undefined;
  lemma?: string | undefined;
  difficultyLevel?: number | undefined;
  publishStatus?: string | undefined;
  reviewStatus?: string | undefined;
  audioStatus?: string | undefined;
  isExcluded?: boolean | undefined;
  hasMeaning?: boolean | undefined;
  hasAudio?: boolean | undefined;
  minLg10wf?: number | undefined;
  maxLg10wf?: number | undefined;
  minFrequencyCount?: number | undefined;
  maxFrequencyCount?: number | undefined;
  sceneTag?: string | undefined;
  levelTag?: string | undefined;
  sortBy?: "createdAt" | "updatedAt" | "word" | "difficultyLevel" | "lg10wf" | "frequencyCount" | undefined;
  sortOrder?: "asc" | "desc" | undefined;
  limit: number;
  offset: number;
}

export class WordLibraryRepository {
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

  async list(query: WordListQuery): Promise<WordEntryRow[]> {
    const filters = [];
    if (query.keyword) {
      filters.push(sql`(${wordEntries.word} ilike ${`%${query.keyword}%`} OR ${wordEntries.lemma} ilike ${`%${query.keyword}%`} OR ${wordEntries.meaningCn} ilike ${`%${query.keyword}%`} OR ${wordEntries.meaningEn} ilike ${`%${query.keyword}%`})`);
    }
    if (query.lemma) {
      filters.push(ilike(wordEntries.lemma, `%${query.lemma}%`));
    }
    if (query.difficultyLevel !== undefined) {
      filters.push(eq(wordEntries.difficultyLevel, query.difficultyLevel));
    }
    if (query.publishStatus) {
      filters.push(eq(wordEntries.publishStatus, query.publishStatus));
    }
    if (query.reviewStatus) {
      filters.push(eq(wordEntries.reviewStatus, query.reviewStatus));
    }
    if (query.audioStatus) {
      filters.push(eq(wordEntries.audioStatus, query.audioStatus));
    }
    if (query.isExcluded !== undefined) {
      filters.push(eq(wordEntries.isExcluded, query.isExcluded));
    }
    if (query.hasMeaning !== undefined) {
      filters.push(query.hasMeaning ? sql`${wordEntries.meaningCn} IS NOT NULL OR ${wordEntries.meaningEn} IS NOT NULL` : sql`${wordEntries.meaningCn} IS NULL AND ${wordEntries.meaningEn} IS NULL`);
    }
    if (query.hasAudio !== undefined) {
      filters.push(query.hasAudio ? sql`${wordEntries.audioUrl} IS NOT NULL` : sql`${wordEntries.audioUrl} IS NULL`);
    }
    if (query.minLg10wf !== undefined) {
      filters.push(sql`${wordEntries.lg10wf}::numeric >= ${query.minLg10wf}`);
    }
    if (query.maxLg10wf !== undefined) {
      filters.push(sql`${wordEntries.lg10wf}::numeric <= ${query.maxLg10wf}`);
    }
    if (query.minFrequencyCount !== undefined) {
      filters.push(sql`${wordEntries.frequencyCount} >= ${query.minFrequencyCount}`);
    }
    if (query.maxFrequencyCount !== undefined) {
      filters.push(sql`${wordEntries.frequencyCount} <= ${query.maxFrequencyCount}`);
    }
    if (query.sceneTag) {
      filters.push(sql`${wordEntries.sceneTags} @> ${JSON.stringify([query.sceneTag])}::jsonb`);
    }
    if (query.levelTag) {
      filters.push(sql`${wordEntries.levelTags} @> ${JSON.stringify([query.levelTag])}::jsonb`);
    }

    const where = filters.length > 0 ? and(...filters) : undefined;
    const sortColumn = {
      createdAt: wordEntries.createdAt,
      difficultyLevel: wordEntries.difficultyLevel,
      frequencyCount: wordEntries.frequencyCount,
      lg10wf: wordEntries.lg10wf,
      updatedAt: wordEntries.updatedAt,
      word: wordEntries.word,
    }[query.sortBy ?? "createdAt"];
    return this.db
      .select()
      .from(wordEntries)
      .where(where)
      .orderBy(query.sortOrder === "asc" ? sortColumn : desc(sortColumn))
      .limit(query.limit)
      .offset(query.offset);
  }

  async listPublished(limit: number, offset: number, difficultyLevel?: number): Promise<WordEntryRow[]> {
    const filters = [
      eq(wordEntries.publishStatus, "published"),
      eq(wordEntries.reviewStatus, "approved"),
      eq(wordEntries.audioStatus, "ready"),
      eq(wordEntries.isExcluded, false),
    ];
    if (difficultyLevel !== undefined) {
      filters.push(eq(wordEntries.difficultyLevel, difficultyLevel));
    }
    return this.db.select().from(wordEntries).where(and(...filters)).orderBy(wordEntries.difficultyLevel, wordEntries.word).limit(limit).offset(offset);
  }

  async findById(id: EntityId): Promise<WordEntryRow | undefined> {
    return this.db.query.wordEntries.findFirst({ where: eq(wordEntries.id, id) });
  }

  async findByWord(word: string): Promise<WordEntryRow | undefined> {
    return this.db.query.wordEntries.findFirst({ where: eq(wordEntries.word, word) });
  }

  async create(input: Omit<WordEntryInsert, "id" | "createdAt" | "updatedAt">): Promise<WordEntryRow> {
    const now = this.now();
    const [row] = await this.db
      .insert(wordEntries)
      .values({
        ...input,
        id: this.nextId(),
        createdAt: now,
        updatedAt: now,
      })
      .returning();
    if (!row) {
      throw new Error("Failed to create word entry");
    }
    return row;
  }

  async update(id: EntityId, patch: Partial<Omit<WordEntryInsert, "id" | "createdAt" | "updatedAt">>): Promise<{ before: WordEntryRow; after: WordEntryRow | undefined } | undefined> {
    const before = await this.findById(id);
    if (!before) {
      return undefined;
    }
    const [after] = await this.db.update(wordEntries).set({ ...patch, updatedAt: this.now() }).where(eq(wordEntries.id, id)).returning();
    return { before, after };
  }

}
