import { and, desc, eq, ilike, inArray, sql } from "drizzle-orm";
import type { AppDatabase } from "../infrastructure/database/Database.js";
import { wordEntries, wordMeta, wordSenses } from "../infrastructure/database/schema.js";
import type { SnowflakeIdGenerator } from "../infrastructure/SnowflakeIdGenerator.js";
import type { EntityId } from "../domain/EntityId.js";

export type WordEntryRow = typeof wordEntries.$inferSelect;
export type WordEntryInsert = typeof wordEntries.$inferInsert;
export type WordMetaRow = typeof wordMeta.$inferSelect;
export type WordMetaInsert = typeof wordMeta.$inferInsert;
export type WordSenseRow = typeof wordSenses.$inferSelect;
export type WordSenseInsert = typeof wordSenses.$inferInsert;
export type WordEntryWithSensesRow = WordEntryRow & { senses: WordSenseRow[] };

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

export interface WordMetaListQuery {
  importBatchId?: string | undefined;
  keyword?: string | undefined;
  limit: number;
  normalizedWord?: string | undefined;
  offset: number;
  source?: string | undefined;
  sortBy?: "createdAt" | "updatedAt" | "word" | undefined;
  sortOrder?: "asc" | "desc" | undefined;
  wordId?: EntityId | undefined;
}

export interface WordMetaImportStats {
  created: number;
  importBatchId: string;
  total: number;
  updated: number;
}

export interface WordSenseSourceInput {
  normalizedWord: string;
  senses: Array<Omit<WordSenseInsert, "createdAt" | "id" | "updatedAt" | "wordId" | "wordMetaId">>;
  source: string;
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

  async list(query: WordListQuery): Promise<WordEntryWithSensesRow[]> {
    const filters = [];
    if (query.keyword) {
      filters.push(sql`(${wordEntries.word} ilike ${`%${query.keyword}%`} OR ${wordEntries.lemma} ilike ${`%${query.keyword}%`} OR ${wordEntries.meaningCn} ilike ${`%${query.keyword}%`} OR EXISTS (SELECT 1 FROM ${wordSenses} WHERE ${wordSenses.wordId} = ${wordEntries.id} AND ${wordSenses.definition} ilike ${`%${query.keyword}%`}))`);
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
      const hasSense = sql`EXISTS (SELECT 1 FROM ${wordSenses} WHERE ${wordSenses.wordId} = ${wordEntries.id})`;
      filters.push(query.hasMeaning ? sql`${wordEntries.meaningCn} IS NOT NULL OR ${hasSense}` : sql`${wordEntries.meaningCn} IS NULL AND NOT ${hasSense}`);
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
    const rows = await this.db
      .select()
      .from(wordEntries)
      .where(where)
      .orderBy(query.sortOrder === "asc" ? sortColumn : desc(sortColumn))
      .limit(query.limit)
      .offset(query.offset);
    return this.withSenses(rows);
  }

  async listPublished(limit: number, offset: number, difficultyLevel?: number): Promise<WordEntryWithSensesRow[]> {
    const filters = [
      eq(wordEntries.publishStatus, "published"),
      eq(wordEntries.reviewStatus, "approved"),
      eq(wordEntries.audioStatus, "ready"),
      eq(wordEntries.isExcluded, false),
    ];
    if (difficultyLevel !== undefined) {
      filters.push(eq(wordEntries.difficultyLevel, difficultyLevel));
    }
    const rows = await this.db.select().from(wordEntries).where(and(...filters)).orderBy(wordEntries.difficultyLevel, wordEntries.word).limit(limit).offset(offset);
    return this.withSenses(rows);
  }

  async findById(id: EntityId): Promise<WordEntryRow | undefined> {
    return this.db.query.wordEntries.findFirst({ where: eq(wordEntries.id, id) });
  }

  async findByWord(word: string): Promise<WordEntryRow | undefined> {
    return this.db.query.wordEntries.findFirst({ where: eq(wordEntries.word, word) });
  }

  async findByLemma(lemma: string): Promise<WordEntryRow | undefined> {
    return this.db.query.wordEntries.findFirst({ where: eq(wordEntries.lemma, lemma) });
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

  async listMeta(query: WordMetaListQuery): Promise<WordMetaRow[]> {
    const filters = [];
    if (query.keyword) {
      filters.push(sql`(${wordMeta.word} ilike ${`%${query.keyword}%`} OR ${wordMeta.normalizedWord} ilike ${`%${query.keyword}%`} OR ${wordMeta.source} ilike ${`%${query.keyword}%`} OR ${wordMeta.importBatchId} ilike ${`%${query.keyword}%`})`);
    }
    if (query.normalizedWord) {
      filters.push(ilike(wordMeta.normalizedWord, `%${query.normalizedWord}%`));
    }
    if (query.source) {
      filters.push(eq(wordMeta.source, query.source));
    }
    if (query.importBatchId) {
      filters.push(eq(wordMeta.importBatchId, query.importBatchId));
    }
    if (query.wordId !== undefined) {
      filters.push(eq(wordMeta.wordId, query.wordId));
    }

    const sortColumn = {
      createdAt: wordMeta.createdAt,
      updatedAt: wordMeta.updatedAt,
      word: wordMeta.word,
    }[query.sortBy ?? "createdAt"];
    const sortDirection = query.sortOrder === "asc" ? sortColumn : desc(sortColumn);
    const exactMatchRank = query.keyword
      ? sql`CASE WHEN lower(${wordMeta.word}) = lower(${query.keyword}) OR lower(${wordMeta.normalizedWord}) = lower(${query.keyword}) THEN 0 ELSE 1 END`
      : undefined;

    const queryBuilder = this.db
      .select()
      .from(wordMeta)
      .where(filters.length > 0 ? and(...filters) : undefined);
    if (exactMatchRank) {
      return queryBuilder.orderBy(exactMatchRank, sortDirection).limit(query.limit).offset(query.offset);
    }
    return queryBuilder.orderBy(sortDirection).limit(query.limit).offset(query.offset);
  }

  async findMetaById(id: EntityId): Promise<WordMetaRow | undefined> {
    return this.db.query.wordMeta.findFirst({ where: eq(wordMeta.id, id) });
  }

  async listSensesByWordIds(wordIds: EntityId[]): Promise<WordSenseRow[]> {
    if (wordIds.length === 0) {
      return [];
    }
    return this.db
      .select()
      .from(wordSenses)
      .where(inArray(wordSenses.wordId, wordIds))
      .orderBy(wordSenses.wordId, wordSenses.senseIndex, wordSenses.definitionIndex);
  }

  async wordHasSenses(wordId: EntityId): Promise<boolean> {
    const [row] = await this.db.select({ id: wordSenses.id }).from(wordSenses).where(eq(wordSenses.wordId, wordId)).limit(1);
    return row !== undefined;
  }

  async listSensesByMetaIds(metaIds: EntityId[]): Promise<WordSenseRow[]> {
    if (metaIds.length === 0) {
      return [];
    }
    return this.db
      .select()
      .from(wordSenses)
      .where(inArray(wordSenses.wordMetaId, metaIds))
      .orderBy(wordSenses.wordMetaId, wordSenses.senseIndex, wordSenses.definitionIndex);
  }

  async upsertMetaRows(rows: Array<Omit<WordMetaInsert, "id" | "createdAt" | "updatedAt">>): Promise<WordMetaImportStats> {
    const chunkSize = 250;
    let created = 0;
    let updated = 0;
    const importBatchId = rows[0]?.importBatchId ?? "";

    for (let index = 0; index < rows.length; index += chunkSize) {
      const chunk = rows.slice(index, index + chunkSize);
      const existing = await this.db
        .select({ normalizedWord: wordMeta.normalizedWord, source: wordMeta.source })
        .from(wordMeta)
        .where(inArray(wordMeta.normalizedWord, chunk.map((row) => row.normalizedWord)));
      const existingKeys = new Set(existing.map((row) => `${row.source}:${row.normalizedWord}`));
      created += chunk.filter((row) => !existingKeys.has(`${row.source}:${row.normalizedWord}`)).length;
      updated += chunk.filter((row) => existingKeys.has(`${row.source}:${row.normalizedWord}`)).length;
      const now = this.now();

      await this.db
        .insert(wordMeta)
        .values(
          chunk.map((row) => ({
            ...row,
            createdAt: now,
            id: this.nextId(),
            updatedAt: now,
          })),
        )
        .onConflictDoUpdate({
          target: [wordMeta.source, wordMeta.normalizedWord],
          set: {
            derivedFields: sql`excluded.derived_fields`,
            importBatchId: sql`excluded.import_batch_id`,
            licenseName: sql`excluded.license_name`,
            licenseUrl: sql`excluded.license_url`,
            meanings: sql`excluded.meanings`,
            phonetics: sql`excluded.phonetics`,
            rawPayload: sql`excluded.raw_payload`,
            sourceUrl: sql`excluded.source_url`,
            updatedAt: now,
            word: sql`excluded.word`,
            wordId: sql`COALESCE(excluded.word_id, ${wordMeta.wordId})`,
          },
        });
    }

    return { created, importBatchId, total: rows.length, updated };
  }

  async linkMetaToWords(normalizedWords: string[]): Promise<number> {
    if (normalizedWords.length === 0) {
      return 0;
    }
    const existingWords = await this.db
      .select({ id: wordEntries.id, lemma: wordEntries.lemma })
      .from(wordEntries)
      .where(inArray(wordEntries.lemma, normalizedWords));
    const byLemma = new Map(existingWords.map((row) => [row.lemma, row.id]));
    let linked = 0;
    for (const [lemma, wordId] of byLemma) {
      const result = await this.db.update(wordMeta).set({ wordId, updatedAt: this.now() }).where(eq(wordMeta.normalizedWord, lemma)).returning({ id: wordMeta.id });
      linked += result.length;
    }
    return linked;
  }

  async replaceSensesFromDictionaryApi(inputs: WordSenseSourceInput[]): Promise<number> {
    if (inputs.length === 0) {
      return 0;
    }
    const normalizedWords = [...new Set(inputs.map((input) => input.normalizedWord))];
    const metaRows = await this.db
      .select({ id: wordMeta.id, normalizedWord: wordMeta.normalizedWord, source: wordMeta.source, wordId: wordMeta.wordId })
      .from(wordMeta)
      .where(inArray(wordMeta.normalizedWord, normalizedWords));
    const byKey = new Map(metaRows.map((row) => [`${row.source}:${row.normalizedWord}`, row]));
    const now = this.now();
    let inserted = 0;

    for (const input of inputs) {
      const meta = byKey.get(`${input.source}:${input.normalizedWord}`);
      if (!meta?.wordId) {
        continue;
      }
      await this.db.delete(wordSenses).where(eq(wordSenses.wordMetaId, meta.id));
      if (input.senses.length === 0) {
        continue;
      }
      await this.db.insert(wordSenses).values(
        input.senses.map((sense) => ({
          ...sense,
          createdAt: now,
          id: this.nextId(),
          updatedAt: now,
          wordId: meta.wordId as EntityId,
          wordMetaId: meta.id,
        })),
      );
      inserted += input.senses.length;
    }

    return inserted;
  }

  private async withSenses(rows: WordEntryRow[]): Promise<WordEntryWithSensesRow[]> {
    if (rows.length === 0) {
      return [];
    }
    const senses = await this.listSensesByWordIds(rows.map((row) => row.id));
    const sensesByWordId = new Map<string, WordSenseRow[]>();
    for (const sense of senses) {
      const key = String(sense.wordId);
      sensesByWordId.set(key, [...(sensesByWordId.get(key) ?? []), sense]);
    }
    return rows.map((row) => ({ ...row, senses: sensesByWordId.get(String(row.id)) ?? [] }));
  }
}
