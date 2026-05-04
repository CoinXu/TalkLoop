#!/usr/bin/env node
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, "../../..");
const DATA_DIR = path.resolve(SCRIPT_DIR, ".data");
const DEFAULT_SOURCE = path.resolve(SCRIPT_DIR, "../subtlexus/SUBTLEXusfrequencyabove1.xls");
const DEFAULT_OUTPUT = path.resolve(DATA_DIR, "dictionaryapi-raw.jsonl");
const API_BASE = "https://api.dictionaryapi.dev/api/v2/entries/en";
const RETRYABLE_STATUSES = new Set([429, 500, 502, 503, 504]);

const args = parseArgs(process.argv.slice(2));

if (args.help) {
  printHelp();
  process.exit(0);
}

const options = {
  concurrency: numberOption(args.concurrency, 1),
  delayMs: numberOption(args.delayMs, 2000),
  limit: optionalNumber(args.limit),
  output: path.resolve(String(args.output ?? DEFAULT_OUTPUT)),
  resume: args.resume !== false,
  source: path.resolve(String(args.source ?? DEFAULT_SOURCE)),
  words: typeof args.words === "string" ? splitWords(args.words) : [],
};

if (options.concurrency < 1) {
  throw new Error("--concurrency must be greater than 0");
}

const words = await loadWords(options);
const completedWords = options.resume ? await loadCompletedWords(options.output) : new Set();
const pendingWords = words.filter((word) => !completedWords.has(word.toLowerCase()));

await fsp.mkdir(path.dirname(options.output), { recursive: true });

const outputStream = fs.createWriteStream(options.output, { flags: options.resume ? "a" : "w" });
const throttle = createRateLimiter(options.delayMs);

let ok = 0;
let failed = 0;
let skipped = words.length - pendingWords.length;
const failedByStatus = {};

try {
  await mapConcurrent(pendingWords, options.concurrency, async (word) => {
    const result = await fetchWord(word, throttle);
    if (result.status === "ok") {
      ok += 1;
      outputStream.write(`${JSON.stringify(result)}\n`);
      return;
    }

    failed += 1;
    failedByStatus[result.httpStatus ?? result.status] = (failedByStatus[result.httpStatus ?? result.status] ?? 0) + 1;
  });
} finally {
  await closeStream(outputStream);
}

console.log(JSON.stringify({ failed, failedByStatus, ok, output: options.output, skipped, total: words.length }, null, 2));

async function fetchWord(word, throttle) {
  const apiUrl = `${API_BASE}/${encodeURIComponent(word)}`;
  const fetchedAt = new Date().toISOString();

  try {
    const response = await fetchWithRetry(apiUrl, throttle);
    if (response.status === 404) {
      return failureRecord(word, "not_found", fetchedAt, apiUrl, response.status, "dictionaryapi.dev returned 404");
    }
    if (!response.ok) {
      return failureRecord(word, "error", fetchedAt, apiUrl, response.status, `dictionaryapi.dev returned ${response.status}`);
    }

    const payload = await response.json();
    if (!Array.isArray(payload) || payload.length === 0) {
      return failureRecord(word, "error", fetchedAt, apiUrl, "empty_payload", "dictionaryapi.dev returned an empty payload");
    }

    return {
      schemaVersion: 1,
      status: "ok",
      word,
      lemma: word.toLowerCase(),
      dictionaryApi: payload,
      source: {
        provider: "dictionaryapi.dev",
        apiUrl,
        fetchedAt,
      },
    };
  } catch (error) {
    return failureRecord(word, "error", fetchedAt, apiUrl, "exception", error instanceof Error ? error.message : String(error));
  }
}

async function fetchWithRetry(url, throttle) {
  let lastResponse;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    await throttle();
    const response = await fetch(url, { headers: { accept: "application/json" } });
    if (!RETRYABLE_STATUSES.has(response.status)) {
      return response;
    }
    lastResponse = response;
    await sleep(retryDelayMs(response, attempt));
  }
  return lastResponse;
}

async function loadWords({ limit, source, words }) {
  const sourceWords = words.length > 0 ? words : await loadWordsFromSource(source);
  const unique = [];
  const seen = new Set();
  for (const word of sourceWords) {
    const normalized = normalizeWord(word);
    if (!normalized || seen.has(normalized.toLowerCase())) continue;
    seen.add(normalized.toLowerCase());
    unique.push(normalized);
    if (limit !== undefined && unique.length >= limit) break;
  }
  return unique;
}

async function loadWordsFromSource(source) {
  if (source.endsWith(".jsonl")) {
    return loadWordsFromJsonl(source);
  }
  if (source.endsWith(".txt") || source.endsWith(".md") || source.endsWith(".csv")) {
    const content = await fsp.readFile(source, "utf8");
    return content.split(/\r?\n|,/);
  }
  if (source.endsWith(".xls") || source.endsWith(".xlsx")) {
    return loadWordsFromWorkbook(source);
  }
  throw new Error(`Unsupported source format: ${source}`);
}

async function loadWordsFromJsonl(source) {
  const content = await fsp.readFile(source, "utf8");
  return content
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => {
      const item = JSON.parse(line);
      return item.word;
    });
}

function loadWordsFromWorkbook(source) {
  const XLSX = loadXlsx();
  const workbook = XLSX.readFile(source);
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) {
    throw new Error(`Workbook has no sheets: ${source}`);
  }
  const sheet = workbook.Sheets[firstSheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: null, blankrows: false });
  const [headerRow, ...dataRows] = rows;
  const headerMap = buildHeaderMap(headerRow);
  if (!headerMap.has("word")) {
    throw new Error(`Workbook is missing Word header: ${source}`);
  }
  return dataRows.map((row) => cell(row, headerMap, "word"));
}

function loadXlsx() {
  const require = createRequire(import.meta.url);
  try {
    return require("xlsx");
  } catch {
    return require(path.resolve(REPO_ROOT, "services/api/node_modules/xlsx"));
  }
}

async function loadCompletedWords(output) {
  const completed = new Set();
  try {
    const content = await fsp.readFile(output, "utf8");
    for (const line of content.split(/\r?\n/)) {
      if (!line.trim()) continue;
      const item = JSON.parse(line);
      if (typeof item.word === "string") {
        completed.add(item.word.toLowerCase());
      }
    }
  } catch (error) {
    if (error?.code !== "ENOENT") {
      throw error;
    }
  }
  return completed;
}

function failureRecord(word, status, fetchedAt, apiUrl, httpStatus, reason) {
  return {
    schemaVersion: 1,
    status,
    httpStatus,
    word,
    lemma: word.toLowerCase(),
    reason,
    source: {
      provider: "dictionaryapi.dev",
      apiUrl,
      fetchedAt,
    },
  };
}

function createRateLimiter(delayMs) {
  let nextAt = 0;
  return async () => {
    if (delayMs <= 0) return;
    const now = Date.now();
    const waitMs = Math.max(0, nextAt - now);
    nextAt = Math.max(now, nextAt) + delayMs;
    if (waitMs > 0) {
      await sleep(waitMs);
    }
  };
}

function retryDelayMs(response, attempt) {
  const retryAfter = Number(response.headers.get("retry-after"));
  if (Number.isFinite(retryAfter) && retryAfter > 0) {
    return Math.ceil(retryAfter * 1000);
  }
  return Math.min(30000, 2000 * 2 ** attempt);
}

function normalizeWord(value) {
  if (value === null || value === undefined) return null;
  const word = String(value).trim();
  if (!word || word.length > 64) return null;
  if (!/^[A-Za-z][A-Za-z'-]*$/.test(word)) return null;
  return word;
}

function buildHeaderMap(headerRow) {
  const map = new Map();
  if (!Array.isArray(headerRow)) return map;
  headerRow.forEach((value, index) => {
    map.set(String(value ?? "").toLowerCase().replaceAll(/[^a-z0-9]/g, ""), index);
  });
  return map;
}

function cell(row, headerMap, header) {
  const index = headerMap.get(header);
  if (index === undefined) return null;
  const value = row[index];
  return value === null || value === undefined ? null : String(value).trim();
}

async function mapConcurrent(items, concurrency, worker) {
  let nextIndex = 0;
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      await worker(items[index], index);
    }
  });
  await Promise.all(workers);
}

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith("--")) continue;
    const key = arg.slice(2);
    if (key === "help") {
      parsed.help = true;
      continue;
    }
    if (key === "no-resume") {
      parsed.resume = false;
      continue;
    }
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) {
      parsed[key] = true;
      continue;
    }
    parsed[key] = next;
    index += 1;
  }
  return parsed;
}

function splitWords(value) {
  return value.split(",").map((word) => word.trim());
}

function numberOption(value, fallback) {
  const number = optionalNumber(value);
  return number ?? fallback;
}

function optionalNumber(value) {
  if (value === undefined) return undefined;
  const number = Number(value);
  return Number.isFinite(number) ? Math.trunc(number) : undefined;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function closeStream(stream) {
  return new Promise((resolve, reject) => {
    stream.end((error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}

function printHelp() {
  console.log(`Usage:
  node services/vocabulary/dict/fetch-dictionaryapi.mjs [options]

Options:
  --source <path>           Word source: .xls/.xlsx/.txt/.csv/.md/.jsonl
                            Default: ${DEFAULT_SOURCE}
  --words <a,b,c>           Fetch only these comma-separated words
  --limit <n>               Limit words read from source
  --output <path>           Raw dictionaryapi JSONL output path
                            Default: ${DEFAULT_OUTPUT}
  --concurrency <n>         Parallel requests, default 1
  --delayMs <n>             Minimum delay between request starts, default 2000
  --no-resume               Overwrite output instead of appending and skipping completed words
  --help                    Show this help
`);
}
