import fs from "node:fs";
import readline from "node:readline";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { and, eq } from "drizzle-orm";
import { loadServiceEnv } from "../config/loadServiceEnv.js";
import { Database } from "../infrastructure/database/Database.js";
import { corpusSentences } from "../infrastructure/database/schema.js";
import { SnowflakeIdGenerator } from "../infrastructure/SnowflakeIdGenerator.js";
import { AdminRepository } from "../repositories/AdminRepository.js";
import { LearningActivationRepository } from "../repositories/LearningActivationRepository.js";
import { AdminService, type CurrentAdmin } from "../services/AdminService.js";
import { LearningActivationService, type JsonRecord } from "../services/LearningActivationService.js";

loadServiceEnv();

const API_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const REPO_ROOT = path.resolve(API_ROOT, "../..");
const DEFAULT_INPUT = path.resolve(REPO_ROOT, "services/vocabulary/sentence/.data/corpus-sentences.jsonl");

interface CorpusSentenceJsonlRow {
  corpusSentencePatch?: JsonRecord | undefined;
  sentenceKey?: string | undefined;
}

interface ImportOptions {
  dryRun: boolean;
  input: string;
  limit: number | undefined;
  updateExisting: boolean;
}

type ExistingSentence = typeof corpusSentences.$inferSelect;

const options = parseArgs(process.argv.slice(2));
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required");
}

const database = new Database(databaseUrl);

try {
  const idGenerator = new SnowflakeIdGenerator();
  const adminRepository = new AdminRepository(database.db, idGenerator);
  const adminService = new AdminService(adminRepository);
  const learningService = new LearningActivationService(new LearningActivationRepository(database.db, idGenerator), adminService);
  const admin = await currentAdmin(adminService);
  const result = await importRows(database, learningService, admin, options);
  console.log(JSON.stringify(result, null, 2));
} finally {
  await database.close();
}

async function importRows(database: Database, learningService: LearningActivationService, admin: CurrentAdmin, options: ImportOptions) {
  let created = 0;
  let duplicateInput = 0;
  let processed = 0;
  let skippedUnchanged = 0;
  let skippedExisting = 0;
  let updated = 0;
  const seenInput = new Set<string>();

  for await (const row of readJsonl(options.input)) {
    if (options.limit !== undefined && processed >= options.limit) {
      break;
    }

    const patch = normalizePatch(row);
    const key = rowKey(patch);
    if (seenInput.has(key)) {
      duplicateInput += 1;
      continue;
    }
    seenInput.add(key);
    processed += 1;

    const existing = await findExistingSentence(database, patch);
    if (options.dryRun) {
      if (existing) skippedExisting += 1;
      else created += 1;
      continue;
    }

    if (existing) {
      if (sentenceMatches(existing, patch)) {
        skippedUnchanged += 1;
        continue;
      }
      if (!options.updateExisting) {
        skippedExisting += 1;
        continue;
      }
      await learningService.adminUpdateSentence(admin, existing.id, { ...patch, reason: "dev corpus sentence import" });
      updated += 1;
    } else {
      await learningService.adminCreateSentence(admin, { ...patch, reason: "dev corpus sentence import" });
      created += 1;
    }

    if (processed % 1000 === 0) {
      console.log(JSON.stringify({ created, processed, skippedExisting, skippedUnchanged, updated }));
    }
  }

  return {
    created,
    dryRun: options.dryRun,
    duplicateInput,
    input: options.input,
    processed,
    skippedExisting,
    skippedUnchanged,
    updated,
    updateExisting: options.updateExisting,
  };
}

async function currentAdmin(adminService: AdminService): Promise<CurrentAdmin> {
  const login = process.env.ADMIN_BOOTSTRAP_LOGIN;
  const password = process.env.ADMIN_BOOTSTRAP_PASSWORD;
  if (!login || !password) {
    throw new Error("ADMIN_BOOTSTRAP_LOGIN and ADMIN_BOOTSTRAP_PASSWORD are required for service-layer import");
  }
  return adminService.login(login, password);
}

async function findExistingSentence(database: Database, patch: JsonRecord) {
  const sentenceText = stringValue(patch.sentenceText, "sentenceText");
  const translationCn = stringValue(patch.translationCn, "translationCn");
  const [row] = await database.db
    .select()
    .from(corpusSentences)
    .where(and(eq(corpusSentences.sentenceText, sentenceText), eq(corpusSentences.translationCn, translationCn)))
    .limit(1);
  return row;
}

function sentenceMatches(existing: ExistingSentence, patch: JsonRecord): boolean {
  return (
    existing.audioStatus === patch.audioStatus &&
    existing.difficultyLevel === patch.difficultyLevel &&
    existing.normalAudioUrl === nullableStringValue(patch.normalAudioUrl) &&
    existing.publishStatus === patch.publishStatus &&
    existing.reviewStatus === patch.reviewStatus &&
    existing.slowAudioUrl === nullableStringValue(patch.slowAudioUrl) &&
    existing.sortOrder === patch.sortOrder &&
    existing.translationCn === nullableStringValue(patch.translationCn) &&
    jsonEqual(existing.bonusWords, patch.bonusWords) &&
    jsonEqual(existing.phraseChunks, patch.phraseChunks) &&
    jsonEqual(existing.sceneTags, patch.sceneTags) &&
    jsonEqual(existing.targetWords, patch.targetWords)
  );
}

function normalizePatch(row: CorpusSentenceJsonlRow): JsonRecord {
  const patch = row.corpusSentencePatch;
  if (!patch || typeof patch !== "object") {
    throw new Error(`Invalid corpus sentence row: ${JSON.stringify(row).slice(0, 200)}`);
  }
  return {
    audioStatus: patch.audioStatus,
    bonusWords: patch.bonusWords,
    courseId: patch.courseId,
    difficultyLevel: patch.difficultyLevel,
    normalAudioUrl: patch.normalAudioUrl,
    phraseChunks: patch.phraseChunks,
    publishStatus: patch.publishStatus,
    reviewStatus: patch.reviewStatus,
    sceneId: patch.sceneId,
    sceneTags: patch.sceneTags,
    sentenceText: patch.sentenceText,
    slowAudioUrl: patch.slowAudioUrl,
    sortOrder: patch.sortOrder,
    targetWords: patch.targetWords,
    translationCn: patch.translationCn,
  };
}

async function* readJsonl(input: string): AsyncGenerator<CorpusSentenceJsonlRow> {
  const stream = fs.createReadStream(input, { encoding: "utf8" });
  const lines = readline.createInterface({ crlfDelay: Infinity, input: stream });
  for await (const line of lines) {
    if (!line.trim()) continue;
    yield JSON.parse(line) as CorpusSentenceJsonlRow;
  }
}

function rowKey(patch: JsonRecord): string {
  return `${stringValue(patch.sentenceText, "sentenceText")}\u0000${stringValue(patch.translationCn, "translationCn")}`;
}

function stringValue(value: unknown, field: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${field} must be a non-empty string`);
  }
  return value;
}

function nullableStringValue(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function jsonEqual(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function parseArgs(argv: string[]): ImportOptions {
  const parsed: ImportOptions = {
    dryRun: false,
    input: DEFAULT_INPUT,
    limit: undefined,
    updateExisting: true,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--dry-run") {
      parsed.dryRun = true;
      continue;
    }
    if (arg === "--no-update-existing") {
      parsed.updateExisting = false;
      continue;
    }
    if (arg === "--input") {
      parsed.input = path.resolve(requiredArg(argv, index, arg));
      index += 1;
      continue;
    }
    if (arg === "--limit") {
      const value = Number(requiredArg(argv, index, arg));
      if (!Number.isFinite(value) || value < 1) throw new Error("--limit must be a positive number");
      parsed.limit = Math.trunc(value);
      index += 1;
      continue;
    }
    if (arg === "--help") {
      printHelp();
      process.exit(0);
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  return parsed;
}

function requiredArg(argv: string[], index: number, flag: string): string {
  const value = argv[index + 1];
  if (!value || value.startsWith("--")) {
    throw new Error(`${flag} requires a value`);
  }
  return value;
}

function printHelp(): void {
  console.log(`Usage:
  tsx src/scripts/importCorpusSentences.ts [options]

Options:
  --input <path>          JSONL input path
                          Default: ${DEFAULT_INPUT}
  --limit <n>             Import only the first n unique rows
  --dry-run               Count rows without writing
  --no-update-existing    Skip matching existing sentenceText + translationCn rows
  --help                  Show this help
`);
}
