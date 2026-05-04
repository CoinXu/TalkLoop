import fs from "node:fs";
import readline from "node:readline";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadServiceEnv } from "../config/loadServiceEnv.js";
import { Database } from "../infrastructure/database/Database.js";
import { SnowflakeIdGenerator } from "../infrastructure/SnowflakeIdGenerator.js";
import { AdminRepository } from "../repositories/AdminRepository.js";
import { SubtlexusRepository } from "../repositories/SubtlexusRepository.js";
import { WordLibraryRepository } from "../repositories/WordLibraryRepository.js";
import { AdminService, type CurrentAdmin } from "../services/AdminService.js";
import { WordLibraryService } from "../services/WordLibraryService.js";

loadServiceEnv();

const API_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const REPO_ROOT = path.resolve(API_ROOT, "../..");
const DEFAULT_INPUT = path.resolve(REPO_ROOT, "services/vocabulary/word/.data/dictionaryapi-raw.jsonl");

interface ImportOptions {
  applyToWords: boolean;
  batchSize: number;
  createMissing: boolean;
  dryRun: boolean;
  importBatchId: string | undefined;
  input: string;
  limit: number | undefined;
  overwrite: boolean;
}

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
  const service = new WordLibraryService(new WordLibraryRepository(database.db, idGenerator), new SubtlexusRepository(database.db, idGenerator), adminService);
  const admin = await currentAdmin(adminService);
  const result = await importRows(service, admin, options);
  console.log(JSON.stringify(result, null, 2));
} finally {
  await database.close();
}

async function importRows(service: WordLibraryService, admin: CurrentAdmin, options: ImportOptions) {
  let applied = 0;
  let created = 0;
  let linked = 0;
  let processed = 0;
  let skippedRows = 0;
  let updated = 0;
  const importBatchId = options.importBatchId ?? `dictionaryapi-${new Date().toISOString()}`;
  let batch: unknown[] = [];

  for await (const row of readJsonl(options.input)) {
    if (options.limit !== undefined && processed >= options.limit) {
      break;
    }
    batch.push(row);
    processed += 1;
    if (batch.length >= options.batchSize) {
      const result = await flushBatch(service, admin, batch, options, importBatchId);
      applied += result.applied;
      created += result.created;
      linked += result.linked;
      skippedRows += result.skippedRows;
      updated += result.updated;
      batch = [];
      console.log(JSON.stringify({ applied, created, linked, processed, skippedRows, updated }));
    }
  }

  if (batch.length > 0) {
    const result = await flushBatch(service, admin, batch, options, importBatchId);
    applied += result.applied;
    created += result.created;
    linked += result.linked;
    skippedRows += result.skippedRows;
    updated += result.updated;
  }

  return {
    applied,
    applyToWords: options.applyToWords,
    created,
    createMissing: options.createMissing,
    dryRun: options.dryRun,
    importBatchId,
    input: options.input,
    linked,
    overwrite: options.overwrite,
    processed,
    skippedRows,
    updated,
  };
}

async function flushBatch(service: WordLibraryService, admin: CurrentAdmin, rows: unknown[], options: ImportOptions, importBatchId: string) {
  const result = await service.adminImportDictionaryApiMeta(admin, {
    applyToWords: options.applyToWords,
    createMissing: options.createMissing,
    dryRun: options.dryRun,
    importBatchId,
    overwrite: options.overwrite,
    reason: "dictionaryapi jsonl import",
    rows,
  });
  return {
    applied: numberValue(result.applied),
    created: numberValue(result.created),
    linked: numberValue(result.linked),
    skippedRows: numberValue(result.skippedRows),
    updated: numberValue(result.updated),
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

async function* readJsonl(input: string): AsyncGenerator<unknown> {
  const stream = fs.createReadStream(input, { encoding: "utf8" });
  const lines = readline.createInterface({ crlfDelay: Infinity, input: stream });
  for await (const line of lines) {
    if (!line.trim()) continue;
    yield JSON.parse(line);
  }
}

function numberValue(value: unknown): number {
  return typeof value === "number" ? value : 0;
}

function parseArgs(argv: string[]): ImportOptions {
  const parsed: ImportOptions = {
    applyToWords: true,
    batchSize: 500,
    createMissing: true,
    dryRun: false,
    importBatchId: undefined,
    input: DEFAULT_INPUT,
    limit: undefined,
    overwrite: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--dry-run") {
      parsed.dryRun = true;
    } else if (arg === "--no-apply") {
      parsed.applyToWords = false;
    } else if (arg === "--no-create-missing") {
      parsed.createMissing = false;
    } else if (arg === "--overwrite") {
      parsed.overwrite = true;
    } else if (arg === "--input") {
      parsed.input = path.resolve(requireValue(argv, ++index, arg));
    } else if (arg === "--limit") {
      parsed.limit = Number(requireValue(argv, ++index, arg));
    } else if (arg === "--batch-size") {
      parsed.batchSize = Number(requireValue(argv, ++index, arg));
    } else if (arg === "--import-batch-id") {
      parsed.importBatchId = requireValue(argv, ++index, arg);
    } else if (arg === "--help") {
      printHelp();
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (!Number.isInteger(parsed.batchSize) || parsed.batchSize < 1 || parsed.batchSize > 10000) {
    throw new Error("--batch-size must be an integer between 1 and 10000");
  }
  if (parsed.limit !== undefined && (!Number.isInteger(parsed.limit) || parsed.limit < 1)) {
    throw new Error("--limit must be a positive integer");
  }
  return parsed;
}

function requireValue(argv: string[], index: number, name: string): string {
  const value = argv[index];
  if (!value) {
    throw new Error(`${name} requires a value`);
  }
  return value;
}

function printHelp(): void {
  console.log(`Usage: npm run word-meta:import -- [options]

Options:
  --input <path>             JSONL file path. Defaults to services/vocabulary/word/.data/dictionaryapi-raw.jsonl
  --dry-run                  Parse and summarize without writing.
  --no-apply                 Import word_meta only; do not update/create word_entries.
  --no-create-missing        Only update existing word_entries.
  --overwrite                Overwrite existing word entry dictionary fields.
  --limit <n>                Limit rows for a test run.
  --batch-size <n>           Rows per import batch. Default: 500.
  --import-batch-id <value>  Stable import batch id.
`);
}
