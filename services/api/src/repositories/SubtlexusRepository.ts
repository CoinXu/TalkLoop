import { and, asc, desc, eq, ilike, inArray, sql } from "drizzle-orm";
import type { AppDatabase } from "../infrastructure/database/Database.js";
import { subtlexusWords, wordEntries } from "../infrastructure/database/schema.js";
import type { EntityId } from "../domain/EntityId.js";
import type { SnowflakeIdGenerator } from "../infrastructure/SnowflakeIdGenerator.js";
import type { SubtlexImportRow } from "../services/SubtlexImportParser.js";

export type SubtlexusWordRow = typeof subtlexusWords.$inferSelect;

export interface SubtlexusImportStats {
  created: number;
  importBatchId: string;
  total: number;
  updated: number;
}

export interface SubtlexusWordListQuery {
  importBatchId?: string | undefined;
  keyword?: string | undefined;
  limit: number;
  maxCdCount?: number | undefined;
  maxFreqCount?: number | undefined;
  maxLg10Cd?: number | undefined;
  maxLg10Wf?: number | undefined;
  minCdCount?: number | undefined;
  minFreqCount?: number | undefined;
  minLg10Cd?: number | undefined;
  minLg10Wf?: number | undefined;
  normalizedWord?: string | undefined;
  offset: number;
  sourceFileName?: string | undefined;
  sortBy?: "createdAt" | "updatedAt" | "word" | "freqCount" | "cdCount" | "lg10Wf" | "lg10Cd" | undefined;
  sortOrder?: "asc" | "desc" | undefined;
  word?: string | undefined;
}

export interface CreateWordEntriesFromSubtlexusQuery {
  excludeExisting: boolean;
  maxRows: number;
  minLg10Wf?: number | undefined;
  words?: string[] | undefined;
}

export interface CreateWordEntriesFromSubtlexusStats {
  created: number;
  skippedExisting: number;
  source: "subtlexus";
}

export class SubtlexusRepository {
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

  async list(query: SubtlexusWordListQuery): Promise<SubtlexusWordRow[]> {
    const filters = [];
    if (query.keyword) {
      filters.push(sql`(${subtlexusWords.word} ilike ${`%${query.keyword}%`} OR ${subtlexusWords.normalizedWord} ilike ${`%${query.keyword}%`} OR ${subtlexusWords.sourceFileName} ilike ${`%${query.keyword}%`} OR ${subtlexusWords.importBatchId} ilike ${`%${query.keyword}%`})`);
    }
    if (query.word) {
      filters.push(eq(subtlexusWords.word, query.word));
    }
    if (query.normalizedWord) {
      filters.push(ilike(subtlexusWords.normalizedWord, `%${query.normalizedWord}%`));
    }
    if (query.sourceFileName) {
      filters.push(ilike(subtlexusWords.sourceFileName, `%${query.sourceFileName}%`));
    }
    if (query.importBatchId) {
      filters.push(eq(subtlexusWords.importBatchId, query.importBatchId));
    }
    if (query.minFreqCount !== undefined) {
      filters.push(sql`${subtlexusWords.freqCount} >= ${query.minFreqCount}`);
    }
    if (query.maxFreqCount !== undefined) {
      filters.push(sql`${subtlexusWords.freqCount} <= ${query.maxFreqCount}`);
    }
    if (query.minCdCount !== undefined) {
      filters.push(sql`${subtlexusWords.cdCount} >= ${query.minCdCount}`);
    }
    if (query.maxCdCount !== undefined) {
      filters.push(sql`${subtlexusWords.cdCount} <= ${query.maxCdCount}`);
    }
    if (query.minLg10Wf !== undefined) {
      filters.push(sql`${subtlexusWords.lg10Wf}::numeric >= ${query.minLg10Wf}`);
    }
    if (query.maxLg10Wf !== undefined) {
      filters.push(sql`${subtlexusWords.lg10Wf}::numeric <= ${query.maxLg10Wf}`);
    }
    if (query.minLg10Cd !== undefined) {
      filters.push(sql`${subtlexusWords.lg10Cd}::numeric >= ${query.minLg10Cd}`);
    }
    if (query.maxLg10Cd !== undefined) {
      filters.push(sql`${subtlexusWords.lg10Cd}::numeric <= ${query.maxLg10Cd}`);
    }

    const sortColumn = {
      cdCount: subtlexusWords.cdCount,
      createdAt: subtlexusWords.createdAt,
      freqCount: subtlexusWords.freqCount,
      lg10Cd: subtlexusWords.lg10Cd,
      lg10Wf: subtlexusWords.lg10Wf,
      updatedAt: subtlexusWords.updatedAt,
      word: subtlexusWords.word,
    }[query.sortBy ?? "createdAt"];

    return this.db
      .select()
      .from(subtlexusWords)
      .where(filters.length > 0 ? and(...filters) : undefined)
      .orderBy(query.sortOrder === "asc" ? asc(sortColumn) : desc(sortColumn))
      .limit(query.limit)
      .offset(query.offset);
  }

  async upsertRows(rows: SubtlexImportRow[], sourceFileName: string, importBatchId: string): Promise<SubtlexusImportStats> {
    const chunkSize = 500;
    let created = 0;
    let updated = 0;

    for (let index = 0; index < rows.length; index += chunkSize) {
      const chunk = rows.slice(index, index + chunkSize);
      const existing = await this.db.select({ word: subtlexusWords.word }).from(subtlexusWords).where(inArray(subtlexusWords.word, chunk.map((row) => row.word)));
      const existingWords = new Set(existing.map((row) => row.word));
      created += chunk.filter((row) => !existingWords.has(row.word)).length;
      updated += chunk.filter((row) => existingWords.has(row.word)).length;
      const now = this.now();
      await this.db
        .insert(subtlexusWords)
        .values(
          chunk.map((row) => ({
            cdCount: row.cdCount,
            cdLow: row.cdLow,
            createdAt: now,
            freqCount: row.freqCount,
            freqLow: row.freqLow,
            id: this.nextId(),
            importBatchId,
            lg10Cd: row.lg10Cd,
            lg10Wf: row.lg10Wf,
            normalizedWord: row.word.toLowerCase(),
            sourceFileName,
            subtlCd: row.subtlCd,
            subtlWf: row.subtlWf,
            updatedAt: now,
            word: row.word,
          })),
        )
        .onConflictDoUpdate({
          target: subtlexusWords.word,
          set: {
            cdCount: sql`excluded.cd_count`,
            cdLow: sql`excluded.cd_low`,
            freqCount: sql`excluded.freq_count`,
            freqLow: sql`excluded.freq_low`,
            importBatchId: sql`excluded.import_batch_id`,
            lg10Cd: sql`excluded.lg10_cd`,
            lg10Wf: sql`excluded.lg10_wf`,
            normalizedWord: sql`excluded.normalized_word`,
            sourceFileName: sql`excluded.source_file_name`,
            subtlCd: sql`excluded.subtl_cd`,
            subtlWf: sql`excluded.subtl_wf`,
            updatedAt: now,
          },
        });
    }

    return { created, importBatchId, total: rows.length, updated };
  }

  async createWordEntriesFromSubtlexus(query: CreateWordEntriesFromSubtlexusQuery): Promise<CreateWordEntriesFromSubtlexusStats> {
    const filters = [];
    if (query.words?.length) {
      filters.push(inArray(subtlexusWords.word, query.words));
    }
    if (query.minLg10Wf !== undefined) {
      filters.push(sql`${subtlexusWords.lg10Wf}::numeric >= ${query.minLg10Wf}`);
    }
    const sourceRows = await this.db
      .select()
      .from(subtlexusWords)
      .where(filters.length > 0 ? and(...filters) : undefined)
      .orderBy(desc(subtlexusWords.lg10Wf), desc(subtlexusWords.freqCount))
      .limit(query.maxRows);

    if (sourceRows.length === 0) {
      return { created: 0, skippedExisting: 0, source: "subtlexus" };
    }

    const existing = await this.db.select({ word: wordEntries.word }).from(wordEntries).where(inArray(wordEntries.word, sourceRows.map((row) => row.word)));
    const existingWords = new Set(existing.map((row) => row.word));
    const rowsToCreate = query.excludeExisting ? sourceRows.filter((row) => !existingWords.has(row.word)) : sourceRows;
    if (rowsToCreate.length === 0) {
      return { created: 0, skippedExisting: existingWords.size, source: "subtlexus" };
    }

    const now = this.now();
    const inserted = await this.db
      .insert(wordEntries)
      .values(
        rowsToCreate.map((row) => ({
          audioStatus: "missing",
          audioUrl: null,
          cdCount: row.cdCount,
          cdLow: row.cdLow,
          commonCollocations: [],
          createdAt: now,
          difficultyLevel: null,
          distractors: { pronunciation: [], meaning: [], difficulty: [] },
          exclusionReason: null,
          frequencyCount: row.freqCount,
          frequencyLow: row.freqLow,
          id: this.nextId(),
          isExcluded: false,
          lemma: row.normalizedWord,
          levelTags: [],
          lg10cd: row.lg10Cd,
          lg10wf: row.lg10Wf,
          meaningCn: null,
          phonetic: null,
          publishStatus: "draft",
          reviewStatus: "pending_review",
          sceneTags: [],
          subtlcd: row.subtlCd,
          subtlwf: row.subtlWf,
          updatedAt: now,
          word: row.word,
        })),
      )
      .onConflictDoNothing({ target: wordEntries.word })
      .returning({ word: wordEntries.word });

    return {
      created: inserted.length,
      skippedExisting: sourceRows.length - inserted.length,
      source: "subtlexus",
    };
  }
}
