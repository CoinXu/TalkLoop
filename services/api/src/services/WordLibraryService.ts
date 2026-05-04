import { AppError } from "../domain/AppError.js";
import { EntityIdCodec, type EntityId } from "../domain/EntityId.js";
import type { CurrentAdmin, AdminService } from "./AdminService.js";
import type { WordEntryRow, WordLibraryRepository, WordMetaRow } from "../repositories/WordLibraryRepository.js";
import type { SubtlexusRepository, SubtlexusWordRow } from "../repositories/SubtlexusRepository.js";
import { SubtlexImportParser } from "./SubtlexImportParser.js";
import { randomUUID } from "node:crypto";

export interface WordEntryInput {
  word: string;
  lemma?: string | undefined;
  phonetic?: string | null | undefined;
  meaningCn?: string | null | undefined;
  meaningEn?: string | null | undefined;
  audioUrl?: string | null | undefined;
  partOfSpeech?: string | null | undefined;
  frequencyCount?: number | null | undefined;
  cdCount?: number | null | undefined;
  frequencyLow?: number | null | undefined;
  cdLow?: number | null | undefined;
  subtlwf?: string | null | undefined;
  lg10wf?: string | null | undefined;
  subtlcd?: string | null | undefined;
  lg10cd?: string | null | undefined;
  difficultyLevel?: number | null | undefined;
  levelTags?: string[] | undefined;
  sceneTags?: string[] | undefined;
  hearingTrap?: string | null | undefined;
  distractors?: { pronunciation: string[]; meaning: string[]; difficulty: string[] } | undefined;
  commonCollocations?: string[] | undefined;
  reviewStatus?: "pending_review" | "approved" | "rejected" | undefined;
  publishStatus?: "draft" | "published" | "archived" | undefined;
  audioStatus?: "missing" | "ready" | "failed" | undefined;
  isExcluded?: boolean | undefined;
  exclusionReason?: string | null | undefined;
  reason?: string | undefined;
}

type WordEntryPatchInput = {
  [K in keyof WordEntryInput]?: WordEntryInput[K] | undefined;
};

export interface DictionaryApiImportRecord {
  schemaVersion?: number | undefined;
  status?: string | undefined;
  word?: string | undefined;
  lemma?: string | undefined;
  dictionaryApi?: unknown;
  source?: { provider?: string | undefined; apiUrl?: string | undefined; fetchedAt?: string | undefined } | undefined;
}

export interface DictionaryApiDerivedFields {
  audioStatus: "missing" | "ready";
  audioUrl: string | null;
  lemma: string;
  meaningEn: string | null;
  partOfSpeech: string | null;
  phonetic: string | null;
  word: string;
}

interface DictionaryApiMetaInput {
  derivedFields: DictionaryApiDerivedFields;
  importBatchId: string;
  licenseName: string | null;
  licenseUrl: string | null;
  meanings: Record<string, unknown>[];
  normalizedWord: string;
  phonetics: Record<string, unknown>[];
  rawPayload: Record<string, unknown>;
  source: string;
  sourceUrl: string | null;
  word: string;
  wordId?: EntityId | null | undefined;
}

export function buildDictionaryApiMetaInput(raw: unknown, importBatchId: string): DictionaryApiMetaInput | undefined {
  if (!isRecord(raw) || raw.status !== "ok" || typeof raw.word !== "string") {
    return undefined;
  }
  const entries = Array.isArray(raw.dictionaryApi) ? raw.dictionaryApi.filter(isRecord) : [];
  if (entries.length === 0) {
    return undefined;
  }

  const word = raw.word.trim();
  if (!word) {
    return undefined;
  }
  const normalizedWord = typeof raw.lemma === "string" && raw.lemma.trim() ? raw.lemma.trim().toLowerCase() : word.toLowerCase();
  const phonetics = entries.flatMap((entry) => (Array.isArray(entry.phonetics) ? entry.phonetics.filter(isRecord) : []));
  const meanings = entries.flatMap((entry) => (Array.isArray(entry.meanings) ? entry.meanings.filter(isRecord) : []));
  const derivedFields = deriveDictionaryApiFields(word, normalizedWord, entries, phonetics, meanings);
  const firstEntry = entries[0];
  const license = isRecord(firstEntry?.license) ? firstEntry.license : undefined;
  const sourceUrls = entries.flatMap((entry) => (Array.isArray(entry.sourceUrls) ? entry.sourceUrls.filter((url): url is string => typeof url === "string") : []));
  const source = isRecord(raw.source) ? raw.source : undefined;

  return {
    derivedFields,
    importBatchId,
    licenseName: typeof license?.name === "string" ? license.name : null,
    licenseUrl: typeof license?.url === "string" ? license.url : null,
    meanings,
    normalizedWord,
    phonetics,
    rawPayload: raw,
    source: "dictionaryapi",
    sourceUrl: typeof source?.apiUrl === "string" ? source.apiUrl : sourceUrls[0] ?? null,
    word,
  };
}

function deriveDictionaryApiFields(
  word: string,
  normalizedWord: string,
  entries: Record<string, unknown>[],
  phonetics: Record<string, unknown>[],
  meanings: Record<string, unknown>[],
): DictionaryApiDerivedFields {
  const firstEntry = entries[0];
  const audioUrl = firstString(phonetics.map((item) => item.audio));
  const phonetic = firstString([firstEntry?.phonetic, ...phonetics.map((item) => item.text)]);
  const firstMeaning = meanings[0];
  const partOfSpeech = typeof firstMeaning?.partOfSpeech === "string" ? firstMeaning.partOfSpeech : null;
  const definitions = meanings
    .flatMap((meaning) => (Array.isArray(meaning.definitions) ? meaning.definitions.filter(isRecord) : []))
    .map((definition) => definition.definition)
    .filter((definition): definition is string => typeof definition === "string" && definition.trim().length > 0)
    .slice(0, 5);

  return {
    audioStatus: audioUrl ? "ready" : "missing",
    audioUrl,
    lemma: normalizedWord,
    meaningEn: definitions.length > 0 ? definitions.join("\n") : null,
    partOfSpeech,
    phonetic,
    word,
  };
}

function firstString(values: unknown[]): string | null {
  const value = values.find((item): item is string => typeof item === "string" && item.trim().length > 0);
  return value?.trim() ?? null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export class WordLibraryService {
  private readonly subtlexImportParser = new SubtlexImportParser();

  constructor(
    private readonly wordRepository: WordLibraryRepository,
    private readonly subtlexusRepository: SubtlexusRepository,
    private readonly adminService: AdminService,
  ) {}

  async listPublished(limit: number, offset: number, difficultyLevel?: number): Promise<Record<string, unknown>[]> {
    const rows = await this.wordRepository.listPublished(limit, offset, difficultyLevel);
    return rows.filter((row) => this.isConsumable(row)).map((row) => this.toPublicWord(row));
  }

  async listWordMeta(query: Parameters<WordLibraryRepository["listMeta"]>[0]): Promise<Record<string, unknown>[]> {
    return (await this.wordRepository.listMeta(query)).map((row) => this.toPublicWordMeta(row));
  }

  async adminList(admin: CurrentAdmin, query: Parameters<WordLibraryRepository["list"]>[0]): Promise<Record<string, unknown>[]> {
    this.adminService.assertPermission(admin, "admin.word_library.write");
    return (await this.wordRepository.list(query)).map((row) => this.toAdminWord(row));
  }

  async adminListSubtlexusWords(admin: CurrentAdmin, query: Parameters<SubtlexusRepository["list"]>[0]): Promise<Record<string, unknown>[]> {
    this.adminService.assertPermission(admin, "admin.word_library.write");
    return (await this.subtlexusRepository.list(query)).map((row) => this.toSubtlexusWord(row));
  }

  async adminListWordMeta(admin: CurrentAdmin, query: Parameters<WordLibraryRepository["listMeta"]>[0]): Promise<Record<string, unknown>[]> {
    this.adminService.assertPermission(admin, "admin.word_meta.read");
    return (await this.wordRepository.listMeta(query)).map((row) => this.toWordMeta(row));
  }

  async adminCreate(admin: CurrentAdmin, input: WordEntryInput): Promise<Record<string, unknown>> {
    this.adminService.assertPermission(admin, "admin.word_library.write");
    const existing = await this.wordRepository.findByWord(input.word);
    if (existing) {
      throw new AppError("conflict", "Word already exists");
    }

    const row = await this.wordRepository.create({
      audioStatus: input.audioStatus ?? (input.audioUrl ? "ready" : "missing"),
      audioUrl: input.audioUrl ?? null,
      cdCount: input.cdCount ?? null,
      cdLow: input.cdLow ?? null,
      commonCollocations: input.commonCollocations ?? [],
      difficultyLevel: input.difficultyLevel ?? null,
      distractors: input.distractors ?? { pronunciation: [], meaning: [], difficulty: [] },
      exclusionReason: input.exclusionReason ?? null,
      frequencyCount: input.frequencyCount ?? null,
      frequencyLow: input.frequencyLow ?? null,
      hearingTrap: input.hearingTrap ?? null,
      isExcluded: input.isExcluded ?? false,
      lemma: input.lemma ?? input.word.toLowerCase(),
      levelTags: input.levelTags ?? [],
      lg10cd: input.lg10cd ?? null,
      lg10wf: input.lg10wf ?? null,
      meaningCn: input.meaningCn ?? null,
      meaningEn: input.meaningEn ?? null,
      partOfSpeech: input.partOfSpeech ?? null,
      phonetic: input.phonetic ?? null,
      publishStatus: input.publishStatus ?? "draft",
      reviewStatus: input.reviewStatus ?? "pending_review",
      sceneTags: input.sceneTags ?? [],
      subtlcd: input.subtlcd ?? null,
      subtlwf: input.subtlwf ?? null,
      word: input.word,
    });
    await this.adminService.audit(admin, "admin.word_library.write", "word_entry_create", "word_entry", EntityIdCodec.stringify(row.id), undefined, this.toAdminWord(row), input.reason);
    return this.toAdminWord(row);
  }

  async adminUpdate(admin: CurrentAdmin, id: EntityId, input: WordEntryPatchInput): Promise<Record<string, unknown>> {
    this.adminService.assertPermission(admin, "admin.word_library.write");
    const patch = this.buildPatch(input);
    const result = await this.wordRepository.update(id, patch);
    if (!result?.after) {
      throw new AppError("not_found", "Word entry not found");
    }
    await this.adminService.audit(admin, "admin.word_library.write", "word_entry_update", "word_entry", EntityIdCodec.stringify(id), this.toAdminWord(result.before), this.toAdminWord(result.after), input.reason);
    return this.toAdminWord(result.after);
  }

  async adminSetPublishStatus(admin: CurrentAdmin, id: EntityId, publishStatus: "draft" | "published" | "archived", reason?: string): Promise<Record<string, unknown>> {
    this.adminService.assertPermission(admin, "admin.word_library.write");
    const word = await this.wordRepository.findById(id);
    if (!word) {
      throw new AppError("not_found", "Word entry not found");
    }
    if (publishStatus === "published") {
      this.assertPublishable(word);
    }
    const result = await this.wordRepository.update(id, { publishStatus });
    if (!result?.after) {
      throw new AppError("not_found", "Word entry not found");
    }
    await this.adminService.audit(admin, "admin.word_library.write", "word_entry_publish_status", "word_entry", EntityIdCodec.stringify(id), this.toAdminWord(result.before), this.toAdminWord(result.after), reason);
    return this.toAdminWord(result.after);
  }

  async adminImportSubtlexFrequency(
    admin: CurrentAdmin,
    input: { buffer: Buffer; fileName: string; dryRun?: boolean | undefined; limit?: number | undefined; reason?: string | undefined },
  ): Promise<Record<string, unknown>> {
    this.adminService.assertPermission(admin, "admin.word_library.write");
    if (!input.fileName.match(/\.(xls|xlsx)$/i)) {
      throw new AppError("validation_failed", "SUBTLEXus import requires an .xls or .xlsx file");
    }

    const parsed = this.subtlexImportParser.parse(input.buffer, input.limit);
    const importBatchId = randomUUID();
    const summary = {
      dryRun: input.dryRun === true,
      fileName: input.fileName,
      importBatchId,
      importableRows: parsed.rows.length,
      skippedRows: parsed.skippedRows,
      totalRows: parsed.totalRows,
    };

    if (input.dryRun) {
      return { ...summary, created: 0, updated: 0 };
    }

    const stats = await this.subtlexusRepository.upsertRows(parsed.rows, input.fileName, importBatchId);
    const result = { ...summary, ...stats };
    await this.adminService.audit(admin, "admin.word_library.write", "subtlexus_import", "subtlexus_word", null, undefined, result, input.reason);
    return result;
  }

  async adminCreateWordsFromSubtlexus(
    admin: CurrentAdmin,
    input: { excludeExisting?: boolean | undefined; maxRows?: number | undefined; minLg10Wf?: number | undefined; reason?: string | undefined; words?: string[] | undefined },
  ): Promise<Record<string, unknown>> {
    this.adminService.assertPermission(admin, "admin.word_library.write");
    const stats = await this.subtlexusRepository.createWordEntriesFromSubtlexus({
      excludeExisting: input.excludeExisting ?? true,
      maxRows: input.maxRows ?? 500,
      minLg10Wf: input.minLg10Wf,
      words: input.words,
    });
    const result = { ...stats };
    await this.adminService.audit(admin, "admin.word_library.write", "word_entries_create_from_subtlexus", "word_entry", null, undefined, result, input.reason);
    return result;
  }

  async adminImportDictionaryApiMeta(
    admin: CurrentAdmin,
    input: { rows: unknown[]; applyToWords?: boolean | undefined; createMissing?: boolean | undefined; dryRun?: boolean | undefined; importBatchId?: string | undefined; overwrite?: boolean | undefined; reason?: string | undefined },
  ): Promise<Record<string, unknown>> {
    this.adminService.assertPermission(admin, "admin.word_meta.write");
    const importBatchId = input.importBatchId ?? randomUUID();
    const parsed = input.rows.map((row) => buildDictionaryApiMetaInput(row, importBatchId)).filter((row): row is DictionaryApiMetaInput => row !== undefined);
    const summary = {
      applyToWords: input.applyToWords !== false,
      createMissing: input.createMissing !== false,
      dryRun: input.dryRun === true,
      importBatchId,
      skippedRows: input.rows.length - parsed.length,
      totalRows: input.rows.length,
    };
    if (input.dryRun) {
      return { ...summary, applied: 0, created: 0, linked: 0, updated: 0 };
    }

    const stats = await this.wordRepository.upsertMetaRows(parsed.map((row) => this.toWordMetaInsert(row)));
    let applied = 0;
    if (input.applyToWords !== false) {
      for (const row of parsed) {
        applied += (await this.applyDerivedFields(row.derivedFields, { createMissing: input.createMissing !== false, overwrite: input.overwrite === true })) ? 1 : 0;
      }
    }
    const linked = await this.wordRepository.linkMetaToWords([...new Set(parsed.map((row) => row.normalizedWord))]);
    const result = { ...summary, ...stats, applied, linked };
    await this.adminService.audit(admin, "admin.word_meta.write", "dictionaryapi_meta_import", "word_meta", null, undefined, result, input.reason);
    return result;
  }

  async adminApplyDictionaryMeta(
    admin: CurrentAdmin,
    metaId: EntityId,
    input: { createMissing?: boolean | undefined; overwrite?: boolean | undefined; reason?: string | undefined },
  ): Promise<Record<string, unknown>> {
    this.adminService.assertPermission(admin, "admin.word_meta.write");
    const meta = await this.wordRepository.findMetaById(metaId);
    if (!meta) {
      throw new AppError("not_found", "Word metadata not found");
    }
    const derived = this.readDerivedFields(meta);
    const row = await this.applyDerivedFields(derived, { createMissing: input.createMissing !== false, overwrite: input.overwrite === true });
    if (!row) {
      throw new AppError("validation_failed", "Word entry was not found and createMissing is false");
    }
    await this.adminService.audit(admin, "admin.word_meta.write", "dictionaryapi_meta_apply", "word_entry", EntityIdCodec.stringify(row.id), this.toWordMeta(meta), this.toAdminWord(row), input.reason);
    return this.toAdminWord(row);
  }

  toAdminWord(row: WordEntryRow): Record<string, unknown> {
    return {
      audioStatus: row.audioStatus,
      audioUrl: row.audioUrl,
      cdCount: row.cdCount,
      cdLow: row.cdLow,
      commonCollocations: row.commonCollocations,
      createdAt: row.createdAt.toISOString(),
      difficultyLevel: row.difficultyLevel,
      distractors: row.distractors,
      exclusionReason: row.exclusionReason,
      frequencyCount: row.frequencyCount,
      frequencyLow: row.frequencyLow,
      hearingTrap: row.hearingTrap,
      isExcluded: row.isExcluded,
      lemma: row.lemma,
      levelTags: row.levelTags,
      lg10cd: row.lg10cd,
      lg10wf: row.lg10wf,
      meaningCn: row.meaningCn,
      meaningEn: row.meaningEn,
      partOfSpeech: row.partOfSpeech,
      phonetic: row.phonetic,
      publishStatus: row.publishStatus,
      reviewStatus: row.reviewStatus,
      sceneTags: row.sceneTags,
      subtlcd: row.subtlcd,
      subtlwf: row.subtlwf,
      updatedAt: row.updatedAt.toISOString(),
      word: row.word,
      wordId: EntityIdCodec.stringify(row.id),
    };
  }

  private toWordMeta(row: WordMetaRow): Record<string, unknown> {
    return {
      createdAt: row.createdAt.toISOString(),
      derivedFields: row.derivedFields,
      importBatchId: row.importBatchId,
      licenseName: row.licenseName,
      licenseUrl: row.licenseUrl,
      meanings: row.meanings,
      normalizedWord: row.normalizedWord,
      phonetics: row.phonetics,
      rawPayload: row.rawPayload,
      source: row.source,
      sourceUrl: row.sourceUrl,
      updatedAt: row.updatedAt.toISOString(),
      word: row.word,
      wordId: row.wordId ? EntityIdCodec.stringify(row.wordId) : null,
      wordMetaId: EntityIdCodec.stringify(row.id),
    };
  }

  private toPublicWordMeta(row: WordMetaRow): Record<string, unknown> {
    return {
      derivedFields: row.derivedFields,
      licenseName: row.licenseName,
      licenseUrl: row.licenseUrl,
      meanings: row.meanings,
      normalizedWord: row.normalizedWord,
      phonetics: row.phonetics,
      source: row.source,
      sourceUrl: row.sourceUrl,
      word: row.word,
      wordId: row.wordId ? EntityIdCodec.stringify(row.wordId) : null,
      wordMetaId: EntityIdCodec.stringify(row.id),
    };
  }

  private toWordMetaInsert(input: DictionaryApiMetaInput) {
    return {
      derivedFields: { ...input.derivedFields },
      importBatchId: input.importBatchId,
      licenseName: input.licenseName,
      licenseUrl: input.licenseUrl,
      meanings: input.meanings,
      normalizedWord: input.normalizedWord,
      phonetics: input.phonetics,
      rawPayload: input.rawPayload,
      source: input.source,
      sourceUrl: input.sourceUrl,
      word: input.word,
      wordId: input.wordId ?? null,
    };
  }

  private toSubtlexusWord(row: SubtlexusWordRow): Record<string, unknown> {
    return {
      cdCount: row.cdCount,
      cdLow: row.cdLow,
      createdAt: row.createdAt.toISOString(),
      freqCount: row.freqCount,
      freqLow: row.freqLow,
      importBatchId: row.importBatchId,
      lg10Cd: row.lg10Cd,
      lg10Wf: row.lg10Wf,
      normalizedWord: row.normalizedWord,
      sourceFileName: row.sourceFileName,
      subtlCd: row.subtlCd,
      subtlWf: row.subtlWf,
      subtlexusWordId: EntityIdCodec.stringify(row.id),
      updatedAt: row.updatedAt.toISOString(),
      word: row.word,
    };
  }

  private toPublicWord(row: WordEntryRow): Record<string, unknown> {
    return {
      audioUrl: row.audioUrl,
      difficultyLevel: row.difficultyLevel,
      meaningCn: row.meaningCn,
      meaningEn: row.meaningEn,
      phonetic: row.phonetic,
      sceneTags: row.sceneTags,
      word: row.word,
      wordId: EntityIdCodec.stringify(row.id),
    };
  }

  private buildPatch(input: WordEntryPatchInput) {
    const patch: Parameters<WordLibraryRepository["update"]>[1] = {};
    const assign = <K extends keyof typeof patch>(key: K, value: (typeof patch)[K] | undefined): void => {
      if (value !== undefined) {
        patch[key] = value;
      }
    };
    assign("audioStatus", input.audioStatus);
    assign("audioUrl", input.audioUrl);
    assign("cdCount", input.cdCount);
    assign("cdLow", input.cdLow);
    assign("commonCollocations", input.commonCollocations);
    assign("difficultyLevel", input.difficultyLevel);
    assign("distractors", input.distractors);
    assign("exclusionReason", input.exclusionReason);
    assign("frequencyCount", input.frequencyCount);
    assign("frequencyLow", input.frequencyLow);
    assign("hearingTrap", input.hearingTrap);
    assign("isExcluded", input.isExcluded);
    assign("lemma", input.lemma);
    assign("levelTags", input.levelTags);
    assign("lg10cd", input.lg10cd);
    assign("lg10wf", input.lg10wf);
    assign("meaningCn", input.meaningCn);
    assign("meaningEn", input.meaningEn);
    assign("partOfSpeech", input.partOfSpeech);
    assign("phonetic", input.phonetic);
    assign("publishStatus", input.publishStatus);
    assign("reviewStatus", input.reviewStatus);
    assign("sceneTags", input.sceneTags);
    assign("subtlcd", input.subtlcd);
    assign("subtlwf", input.subtlwf);
    assign("word", input.word);
    return patch;
  }

  private readDerivedFields(meta: WordMetaRow): DictionaryApiDerivedFields {
    const value = meta.derivedFields;
    if (
      !isRecord(value) ||
      typeof value.word !== "string" ||
      typeof value.lemma !== "string" ||
      (value.audioStatus !== "missing" && value.audioStatus !== "ready")
    ) {
      throw new AppError("validation_failed", "Word metadata does not contain derived word fields");
    }
    return {
      audioStatus: value.audioStatus,
      audioUrl: typeof value.audioUrl === "string" ? value.audioUrl : null,
      lemma: value.lemma,
      meaningEn: typeof value.meaningEn === "string" ? value.meaningEn : null,
      partOfSpeech: typeof value.partOfSpeech === "string" ? value.partOfSpeech : null,
      phonetic: typeof value.phonetic === "string" ? value.phonetic : null,
      word: value.word,
    };
  }

  private async applyDerivedFields(derived: DictionaryApiDerivedFields, options: { createMissing: boolean; overwrite: boolean }): Promise<WordEntryRow | undefined> {
    const existing = (await this.wordRepository.findByWord(derived.word)) ?? (await this.wordRepository.findByLemma(derived.lemma));
    if (!existing) {
      if (!options.createMissing) {
        return undefined;
      }
      return this.wordRepository.create({
        audioStatus: derived.audioStatus,
        audioUrl: derived.audioUrl,
        cdCount: null,
        cdLow: null,
        commonCollocations: [],
        difficultyLevel: null,
        distractors: { pronunciation: [], meaning: [], difficulty: [] },
        exclusionReason: null,
        frequencyCount: null,
        frequencyLow: null,
        hearingTrap: null,
        isExcluded: false,
        lemma: derived.lemma,
        levelTags: [],
        lg10cd: null,
        lg10wf: null,
        meaningCn: null,
        meaningEn: derived.meaningEn,
        partOfSpeech: derived.partOfSpeech,
        phonetic: derived.phonetic,
        publishStatus: "draft",
        reviewStatus: "pending_review",
        sceneTags: [],
        subtlcd: null,
        subtlwf: null,
        word: derived.word,
      });
    }

    const input: WordEntryPatchInput = {};
    this.assignDerivedPatch(input, "audioUrl", existing.audioUrl, derived.audioUrl, options.overwrite);
    this.assignDerivedPatch(input, "meaningEn", existing.meaningEn, derived.meaningEn, options.overwrite);
    this.assignDerivedPatch(input, "partOfSpeech", existing.partOfSpeech, derived.partOfSpeech, options.overwrite);
    this.assignDerivedPatch(input, "phonetic", existing.phonetic, derived.phonetic, options.overwrite);
    if ((options.overwrite || existing.audioStatus === "missing") && derived.audioStatus === "ready") {
      input.audioStatus = "ready";
    }
    const result = await this.wordRepository.update(existing.id, this.buildPatch(input));
    return result?.after;
  }

  private assignDerivedPatch<K extends "audioUrl" | "meaningEn" | "partOfSpeech" | "phonetic">(
    patch: WordEntryPatchInput,
    key: K,
    existing: string | null,
    incoming: string | null,
    overwrite: boolean,
  ): void {
    if (incoming !== null && (overwrite || !existing)) {
      patch[key] = incoming;
    }
  }

  private isConsumable(row: WordEntryRow): boolean {
    return Boolean(row.meaningCn && row.meaningEn && row.audioUrl && row.frequencyCount && row.cdCount && row.lg10wf && row.lg10cd);
  }

  private assertPublishable(row: WordEntryRow): void {
    if (row.reviewStatus !== "approved") {
      throw new AppError("validation_failed", "Word must be approved before publishing");
    }
    if (row.isExcluded) {
      throw new AppError("validation_failed", "Excluded words cannot be published");
    }
    if (!this.isConsumable(row) || row.audioStatus !== "ready") {
      throw new AppError("validation_failed", "Word must include meanings, audio, frequency fields, and context diversity before publishing");
    }
  }
}
