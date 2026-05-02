import fs from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseFile } from "music-metadata";
import type pdfParseType from "pdf-parse";
import type { CreateContentUnitInput, TranscriptSegmentInput } from "../domain/ContentModels.js";
import { EntityIdCodec } from "../domain/EntityId.js";
import { loadServiceEnv } from "../config/loadServiceEnv.js";
import { Database } from "../infrastructure/database/Database.js";
import { SnowflakeIdGenerator } from "../infrastructure/SnowflakeIdGenerator.js";
import { ContentRepository } from "../repositories/ContentRepository.js";

const require = createRequire(import.meta.url);
const pdfParse = require("pdf-parse/lib/pdf-parse.js") as typeof pdfParseType;

interface CliOptions {
  audioUrl: string;
  pdfUrl: string;
  outputDir: string;
  dryRun: boolean;
  databaseUrl?: string;
  uploadedBy: string;
  audioPublicUrl?: string;
}

interface ParsedPdfContent {
  title: string;
  expression: string;
  expressionMeaning: string;
  transcriptSegments: TranscriptSegmentInput[];
  targetSentenceText: string;
  targetSegmentId: bigint;
}

interface AudioInfo {
  durationSeconds: number;
  format: string;
  title?: string;
  artist?: string;
  bitrate?: number;
  sampleRate?: number;
  channels?: number;
}

interface ImportedLearningUnit {
  unitDraft: CreateContentUnitInput;
  audioInfo: AudioInfo;
  localFiles: {
    audioPath: string;
    pdfPath: string;
    manifestPath: string;
  };
}

const speakerLinePattern = /^(?:[A-Z][A-Za-z]+|Examples)(?:\s+[A-Z][A-Za-z]+)?$/;

function usage(): string {
  return [
    "Usage:",
    "  npm run import:learning-unit -- --audio-url <mp3-url> --pdf-url <pdf-url> [--dry-run]",
    "",
    "Options:",
    "  --output-dir <dir>       Default: .data/imports",
    "  --database-url <url>     Default: DATABASE_URL from env/.env",
    "  --uploaded-by <name>     Default: import-script",
    "  --audio-public-url <url> Stored in audio_assets.url instead of the generated static URL",
  ].join("\n");
}

function parseArgs(argv: string[]): CliOptions {
  const values = new Map<string, string>();
  const flags = new Set<string>();

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg?.startsWith("--")) {
      continue;
    }

    const key = arg.slice(2);
    if (key === "dry-run" || key === "help") {
      flags.add(key);
      continue;
    }

    const value = argv[index + 1];
    if (!value || value.startsWith("--")) {
      throw new Error(`Missing value for --${key}`);
    }
    values.set(key, value);
    index += 1;
  }

  if (flags.has("help")) {
    console.log(usage());
    process.exit(0);
  }

  const audioUrl = values.get("audio-url");
  const pdfUrl = values.get("pdf-url");
  if (!audioUrl || !pdfUrl) {
    throw new Error(`--audio-url and --pdf-url are required\n\n${usage()}`);
  }

  const options: CliOptions = {
    audioUrl,
    pdfUrl,
    outputDir: values.get("output-dir") ?? ".data/imports",
    dryRun: flags.has("dry-run"),
    uploadedBy: values.get("uploaded-by") ?? "import-script",
  };

  const databaseUrl = values.get("database-url") ?? process.env.DATABASE_URL;
  if (databaseUrl) {
    options.databaseUrl = databaseUrl;
  }

  const audioPublicUrl = values.get("audio-public-url");
  if (audioPublicUrl) {
    options.audioPublicUrl = audioPublicUrl;
  }

  return options;
}

function slugFromUrl(url: string): string {
  const parsed = new URL(url);
  const basename = path.basename(parsed.pathname).replace(/\.[^.]+$/, "");
  return basename
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

async function downloadFile(url: string, destinationPath: string): Promise<void> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download ${url}: ${response.status} ${response.statusText}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  await fs.writeFile(destinationPath, buffer);
}

function normalizeText(text: string): string {
  return text
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\r/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function splitBilingualTitle(value: string): { english: string; chinese?: string } {
  const match = /^(.+?)\s*([\u3400-\u9fff].*)$/.exec(value.trim());
  if (!match) {
    return { english: value.trim() };
  }

  const chinese = match[2]?.trim();
  return chinese
    ? { english: match[1]?.trim() ?? value.trim(), chinese }
    : { english: match[1]?.trim() ?? value.trim() };
}

function isBoilerplateLine(line: string): boolean {
  return (
    line === "BBC LEARNING ENGLISH" ||
    line === "Authentic Real English" ||
    line === "地道英语" ||
    line.startsWith("Authentic Real English ©") ||
    line.startsWith("bbclearningenglish.com/") ||
    /^Page \d+ of \d+$/.test(line) ||
    line.startsWith("• 关于台词的备注") ||
    line.startsWith("这不是广播节目的逐字稿件")
  );
}

function inferTitle(lines: string[], audioTitle?: string): { title: string; expression: string; meaning: string } {
  if (audioTitle) {
    const parsed = splitBilingualTitle(audioTitle);
    return {
      title: parsed.english,
      expression: parsed.english,
      meaning: parsed.chinese ?? "待运营确认",
    };
  }

  const contentLines = lines.filter((line) => !isBoilerplateLine(line));
  const titleIndex = contentLines.findIndex((line, index) => {
    const next = contentLines[index + 1];
    return /^[A-Z][A-Za-z' -]+$/.test(line) && next !== undefined && /[\u3400-\u9fff]/.test(next);
  });

  const title = titleIndex >= 0 ? contentLines[titleIndex] ?? "Imported BBC unit" : "Imported BBC unit";
  const meaning = titleIndex >= 0 ? contentLines[titleIndex + 1] ?? "待运营确认" : "待运营确认";
  return { title, expression: title, meaning };
}

function parseTranscriptSegments(lines: string[]): TranscriptSegmentInput[] {
  const segments: TranscriptSegmentInput[] = [];
  let currentSpeaker: string | undefined;
  let currentLines: string[] = [];

  function flush(): void {
    const text = currentLines.join(" ").trim();
    if (!text) {
      return;
    }

    const segment: TranscriptSegmentInput = {
      segmentId: BigInt(segments.length + 1),
      englishText: text,
      segmentOrder: segments.length,
    };
    if (currentSpeaker && currentSpeaker !== "Examples") {
      segment.speaker = currentSpeaker;
    }
    segments.push(segment);
  }

  for (const line of lines) {
    if (isBoilerplateLine(line)) {
      continue;
    }

    if (speakerLinePattern.test(line)) {
      flush();
      currentSpeaker = line;
      currentLines = [];
      continue;
    }

    if (currentSpeaker) {
      currentLines.push(line);
    }
  }
  flush();

  return segments;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function findTargetSentence(segments: TranscriptSegmentInput[], expression: string): { text: string; segmentId: bigint } {
  const expressionPattern = new RegExp(escapeRegExp(expression), "i");
  for (const segment of segments) {
    const sentences = segment.englishText.split(/(?<=[.!?。！？])\s+/);
    const sentence = sentences.find((candidate) => expressionPattern.test(candidate));
    if (sentence && segment.segmentId) {
      return { text: sentence.trim(), segmentId: segment.segmentId };
    }
  }

  const fallback = segments[0];
  if (!fallback?.segmentId) {
    throw new Error("No transcript segments parsed from PDF");
  }
  return { text: fallback.englishText, segmentId: fallback.segmentId };
}

export async function parsePdfContent(pdfPath: string, audioTitle?: string): Promise<ParsedPdfContent> {
  const pdfBuffer = await fs.readFile(pdfPath);
  const pdf = await pdfParse(pdfBuffer);
  const text = normalizeText(pdf.text);
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const title = inferTitle(lines, audioTitle);
  const transcriptSegments = parseTranscriptSegments(lines);
  const target = findTargetSentence(transcriptSegments, title.expression);

  return {
    title: title.title,
    expression: title.expression,
    expressionMeaning: title.meaning,
    transcriptSegments,
    targetSentenceText: target.text,
    targetSegmentId: target.segmentId,
  };
}

export async function parseAudioInfo(audioPath: string): Promise<AudioInfo> {
  const metadata = await parseFile(audioPath);
  const format = metadata.format.container ?? metadata.format.codec ?? (path.extname(audioPath).slice(1) || "unknown");
  const info: AudioInfo = {
    durationSeconds: Math.max(1, Math.ceil(metadata.format.duration ?? 0)),
    format,
  };

  if (metadata.common.title) {
    info.title = metadata.common.title;
  }
  if (metadata.common.artist) {
    info.artist = metadata.common.artist;
  }
  if (metadata.format.bitrate) {
    info.bitrate = metadata.format.bitrate;
  }
  if (metadata.format.sampleRate) {
    info.sampleRate = metadata.format.sampleRate;
  }
  if (metadata.format.numberOfChannels) {
    info.channels = metadata.format.numberOfChannels;
  }

  return info;
}

function buildLearningUnit(input: {
  pdf: ParsedPdfContent;
  audio: AudioInfo;
  pdfUrl: string;
  audioAssetUrl: string;
  uploadedBy: string;
}): CreateContentUnitInput {
  const promptExpression = input.pdf.expression.charAt(0).toLowerCase() + input.pdf.expression.slice(1);
  return {
    title: input.pdf.title,
    expression: input.pdf.expression,
    expressionMeaning: input.pdf.expressionMeaning,
    difficulty: "intermediate",
    sceneTags: ["bbc", "authentic-real-english"],
    estimatedMinutes: Math.max(1, Math.ceil(input.audio.durationSeconds / 60)),
    sourceType: "bbc_url_import",
    sourceUrl: input.pdfUrl,
    licenseStatus: "internal_review",
    audioAsset: {
      url: input.audioAssetUrl,
      durationSeconds: input.audio.durationSeconds,
      format: input.audio.format,
      uploadedBy: input.uploadedBy,
    },
    transcriptSegments: input.pdf.transcriptSegments,
    targetSentences: [
      {
        englishText: input.pdf.targetSentenceText,
        chinesePrompt: `请用英语表达：${input.pdf.expressionMeaning}`,
        includesExpression: new RegExp(escapeRegExp(input.pdf.expression), "i").test(input.pdf.targetSentenceText),
        segmentId: input.pdf.targetSegmentId,
      },
    ],
    speakingPrompts: [
      {
        chineseScenario: `你需要在临场场景中表达“${input.pdf.expressionMeaning}”。`,
        englishPromptGap: `I had to ${promptExpression} when the situation changed.`,
        targetExpression: input.pdf.expression,
        expectedAnswer: input.pdf.expression,
      },
    ],
  };
}

function jsonReplacer(_key: string, value: unknown): unknown {
  return typeof value === "bigint" ? value.toString() : value;
}

async function persistLearningUnit(databaseUrl: string, sourceUrl: string, imported: ImportedLearningUnit): Promise<string> {
  const database = new Database(databaseUrl);
  let jobId: bigint | undefined;
  try {
    const repository = new ContentRepository(database.db, new SnowflakeIdGenerator());
    jobId = await repository.createImportJob(sourceUrl);
    const unitId = await repository.createDraft(imported.unitDraft);
    await repository.completeImportJob(jobId, unitId, {
      audioInfo: imported.audioInfo,
      localFiles: imported.localFiles,
    });
    return EntityIdCodec.stringify(unitId);
  } catch (error) {
    if (jobId) {
      const repository = new ContentRepository(database.db, new SnowflakeIdGenerator());
      await repository.failImportJob(jobId, error instanceof Error ? error.message : "Unknown import failure");
    }
    throw error;
  } finally {
    await database.close();
  }
}

export async function importLearningUnit(options: CliOptions): Promise<{ imported: ImportedLearningUnit; unitId?: string }> {
  const slug = slugFromUrl(options.pdfUrl || options.audioUrl);
  const outputRoot = path.resolve(process.cwd(), options.outputDir, slug);
  await fs.mkdir(outputRoot, { recursive: true });

  const audioPath = path.join(outputRoot, `${slug}.mp3`);
  const pdfPath = path.join(outputRoot, `${slug}.pdf`);
  const manifestPath = path.join(outputRoot, "learning-unit.json");

  await Promise.all([downloadFile(options.audioUrl, audioPath), downloadFile(options.pdfUrl, pdfPath)]);

  const audioInfo = await parseAudioInfo(audioPath);
  const pdfContent = await parsePdfContent(pdfPath, audioInfo.title);
  const staticBaseUrl = process.env.STATIC_ASSET_PUBLIC_BASE_URL ?? "http://127.0.0.1:3000";
  const audioAssetUrl =
    options.audioPublicUrl ??
    `${staticBaseUrl.replace(/\/$/, "")}/static/imports/${encodeURIComponent(slug)}/${encodeURIComponent(`${slug}.mp3`)}`;
  const unitDraft = buildLearningUnit({
    pdf: pdfContent,
    audio: audioInfo,
    pdfUrl: options.pdfUrl,
    audioAssetUrl,
    uploadedBy: options.uploadedBy,
  });

  const imported: ImportedLearningUnit = {
    unitDraft,
    audioInfo,
    localFiles: { audioPath, pdfPath, manifestPath },
  };
  await fs.writeFile(manifestPath, `${JSON.stringify(imported, jsonReplacer, 2)}\n`);

  if (options.dryRun || !options.databaseUrl) {
    return { imported };
  }

  const unitId = await persistLearningUnit(options.databaseUrl, options.pdfUrl, imported);
  return { imported, unitId };
}

async function main(): Promise<void> {
  loadServiceEnv();
  const options = parseArgs(process.argv.slice(2));
  const result = await importLearningUnit(options);

  console.log(`audio: ${result.imported.localFiles.audioPath}`);
  console.log(`pdf: ${result.imported.localFiles.pdfPath}`);
  console.log(`manifest: ${result.imported.localFiles.manifestPath}`);
  if (result.unitId) {
    console.log(`created content unit: ${result.unitId}`);
  } else {
    console.log("database insert skipped; pass DATABASE_URL or --database-url to persist");
  }
}

const isEntrypoint = process.argv[1] ? fileURLToPath(import.meta.url) === path.resolve(process.argv[1]) : false;
if (isEntrypoint) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
