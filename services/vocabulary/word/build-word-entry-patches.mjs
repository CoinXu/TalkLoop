#!/usr/bin/env node
import fsp from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, "../../..");
const DATA_DIR = path.resolve(SCRIPT_DIR, ".data");
const DEFAULT_INPUT = path.resolve(DATA_DIR, "dictionaryapi-raw.jsonl");
const DEFAULT_SOURCE = path.resolve(SCRIPT_DIR, "../resource/SUBTLEXusfrequencyabove1.xls");
const DEFAULT_OUTPUT = path.resolve(DATA_DIR, "word-entry-patches.jsonl");

const args = parseArgs(process.argv.slice(2));

if (args.help) {
  printHelp();
  process.exit(0);
}

const options = {
  input: path.resolve(String(args.input ?? DEFAULT_INPUT)),
  maxDefinitions: numberOption(args.maxDefinitions, 6),
  output: path.resolve(String(args.output ?? DEFAULT_OUTPUT)),
  source: args.source === false ? null : path.resolve(String(args.source ?? DEFAULT_SOURCE)),
};

const frequencyByWord = options.source ? loadFrequencyByWord(options.source) : new Map();
const rows = await readJsonl(options.input);
const outputRows = rows
  .filter((row) => row.status === "ok" && Array.isArray(row.dictionaryApi))
  .map((row) => buildPatchRow(row, frequencyByWord, options.maxDefinitions));

await fsp.mkdir(path.dirname(options.output), { recursive: true });
await fsp.writeFile(options.output, `${outputRows.map((row) => JSON.stringify(row)).join("\n")}\n`, "utf8");

console.log(JSON.stringify({ input: options.input, output: options.output, total: rows.length, written: outputRows.length }, null, 2));

function buildPatchRow(row, frequencyByWord, maxDefinitions) {
  const word = row.word;
  const normalized = normalizeEntries(row.dictionaryApi, maxDefinitions);
  const frequency = frequencyByWord.get(word.toLowerCase()) ?? {};

  return {
    schemaVersion: 1,
    word,
    lemma: word.toLowerCase(),
    wordEntryPatch: {
      ...frequency,
      audioStatus: normalized.audioUrl ? "ready" : "missing",
      audioUrl: normalized.audioUrl,
      lemma: word.toLowerCase(),
      meaningEn: normalized.meaningEn,
      partOfSpeech: normalized.partOfSpeech,
      phonetic: normalized.phonetic,
      publishStatus: "draft",
      reviewStatus: "pending_review",
      word,
    },
    dictionaryApiSummary: normalized.dictionaryApiSummary,
    source: {
      dictionaryApiRawFile: options.input,
      frequencySourceFile: options.source,
      processedAt: new Date().toISOString(),
    },
  };
}

function normalizeEntries(entries, maxDefinitions) {
  const entry = entries[0] ?? {};
  const phonetics = entries.flatMap((item) => (Array.isArray(item.phonetics) ? item.phonetics : []));
  const meanings = entries.flatMap((item) => (Array.isArray(item.meanings) ? item.meanings : []));
  const phonetic = firstText(entry.phonetic) ?? firstText(phonetics.find((item) => firstText(item.text))?.text) ?? null;
  const audioUrl = pickAudioUrl(phonetics);
  const definitionGroups = meanings
    .map((meaning) => ({
      partOfSpeech: firstText(meaning.partOfSpeech),
      definitions: Array.isArray(meaning.definitions)
        ? meaning.definitions
            .map((definition) => ({
              definition: firstText(definition.definition),
              example: firstText(definition.example),
              synonyms: stringArray(definition.synonyms),
              antonyms: stringArray(definition.antonyms),
            }))
            .filter((definition) => definition.definition)
        : [],
      synonyms: stringArray(meaning.synonyms),
      antonyms: stringArray(meaning.antonyms),
    }))
    .filter((meaning) => meaning.partOfSpeech && meaning.definitions.length > 0);

  const selectedGroups = trimDefinitions(definitionGroups, maxDefinitions);
  const meaningEn = selectedGroups
    .map((meaning) => `${meaning.partOfSpeech}: ${meaning.definitions.map((definition) => definition.definition).join("; ")}`)
    .join("\n") || null;

  return {
    audioUrl,
    meaningEn,
    partOfSpeech: selectedGroups[0]?.partOfSpeech ?? null,
    phonetic,
    dictionaryApiSummary: {
      word: firstText(entry.word),
      phonetic,
      phonetics: phonetics.map((item) => ({
        text: firstText(item.text),
        audio: firstText(item.audio),
        sourceUrl: firstText(item.sourceUrl),
        license: normalizeLicense(item.license),
      })),
      meanings: selectedGroups,
      license: normalizeLicense(entry.license),
      sourceUrls: stringArray(entry.sourceUrls),
    },
  };
}

function trimDefinitions(groups, maxDefinitions) {
  const result = [];
  let remaining = maxDefinitions;
  for (const group of groups) {
    if (remaining <= 0) break;
    const definitions = group.definitions.slice(0, remaining);
    remaining -= definitions.length;
    result.push({ ...group, definitions });
  }
  return result;
}

function pickAudioUrl(phonetics) {
  const withAudio = phonetics.filter((item) => firstText(item.audio));
  const preferred = withAudio.find((item) => String(item.audio).includes("-us.mp3")) ?? withAudio.find((item) => String(item.audio).includes("us.mp3")) ?? withAudio[0];
  return firstText(preferred?.audio) ?? null;
}

async function readJsonl(input) {
  const content = await fsp.readFile(input, "utf8");
  return content
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

function loadFrequencyByWord(source) {
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

  const frequencyByWord = new Map();
  for (const row of dataRows) {
    const word = firstText(cell(row, headerMap, "word"));
    if (!word) continue;
    frequencyByWord.set(word.toLowerCase(), {
      cdCount: intCell(row, headerMap, "cdcount"),
      cdLow: intCell(row, headerMap, "cdlow"),
      frequencyCount: intCell(row, headerMap, "freqcount"),
      frequencyLow: intCell(row, headerMap, "freqlow"),
      lg10cd: decimalCell(row, headerMap, "lg10cd"),
      lg10wf: decimalCell(row, headerMap, "lg10wf"),
      subtlcd: decimalCell(row, headerMap, "subtlcd"),
      subtlwf: decimalCell(row, headerMap, "subtlwf"),
    });
  }
  return frequencyByWord;
}

function loadXlsx() {
  const require = createRequire(import.meta.url);
  try {
    return require("xlsx");
  } catch {
    return require(path.resolve(REPO_ROOT, "services/api/node_modules/xlsx"));
  }
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

function intCell(row, headerMap, header) {
  const value = Number(cell(row, headerMap, header));
  return Number.isFinite(value) ? Math.trunc(value) : null;
}

function decimalCell(row, headerMap, header) {
  const value = Number(cell(row, headerMap, header));
  return Number.isFinite(value) ? String(value) : null;
}

function firstText(value) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function stringArray(value) {
  return Array.isArray(value) ? value.filter((item) => typeof item === "string" && item.trim()).map((item) => item.trim()) : [];
}

function normalizeLicense(value) {
  if (!value || typeof value !== "object") return null;
  return {
    name: firstText(value.name),
    url: firstText(value.url),
  };
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
    if (key === "no-source") {
      parsed.source = false;
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

function numberOption(value, fallback) {
  if (value === undefined) return fallback;
  const number = Number(value);
  return Number.isFinite(number) ? Math.trunc(number) : fallback;
}

function printHelp() {
  console.log(`Usage:
  node services/vocabulary/dict/build-word-entry-patches.mjs [options]

Options:
  --input <path>            Raw dictionaryapi JSONL input
                            Default: ${DEFAULT_INPUT}
  --source <path>           SUBTLEX source workbook for frequency fields
                            Default: ${DEFAULT_SOURCE}
  --no-source               Do not enrich with SUBTLEX frequency fields
  --output <path>           WordEntryInput-compatible patch JSONL
                            Default: ${DEFAULT_OUTPUT}
  --maxDefinitions <n>      Max definitions kept in meaningEn, default 6
  --help                    Show this help
`);
}
