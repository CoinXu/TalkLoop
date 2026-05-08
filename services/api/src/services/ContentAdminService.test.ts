import { describe, expect, it } from "vitest";
import { ContentAdminService } from "./ContentAdminService.js";
import type { CurrentAdmin } from "./AdminService.js";
import type { ContentAdminRepository, ContentCourseRow, ContentSceneRow, ContentSentenceRow } from "../repositories/ContentAdminRepository.js";

const admin: CurrentAdmin = {
  adminRole: "super_admin",
  adminUserId: 1n,
  displayName: "Admin",
  loginName: "admin",
  permissionKeys: ["admin.content.read", "admin.content.write", "admin.content.publish"],
};

describe("ContentAdminService publishing validation", () => {
  it("blocks course publishing when parent scene is not published", async () => {
    const service = newService({ sceneStatus: "draft", defaultAudioConfigured: true });

    const validation = await service.validateCourse(20n);

    expect(validation.valid).toBe(false);
    expect(validation.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ message: "scene_must_be_published", severity: "blocking" }),
      ]),
    );
  });

  it("allows default audio fallback as a warning when configured", async () => {
    const service = newService({ sentenceAudioStatus: "missing", defaultAudioConfigured: true });

    const validation = await service.validateCourse(20n);

    expect(validation.valid).toBe(true);
    expect(validation.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ message: "sentence_will_use_default_audio", severity: "warning" }),
      ]),
    );
  });

  it("blocks missing audio when default audio is not configured", async () => {
    const service = newService({ sentenceAudioStatus: "missing", defaultAudioConfigured: false });

    const validation = await service.validateCourse(20n);

    expect(validation.valid).toBe(false);
    expect(validation.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ message: "default_audio_missing_and_sentence_audio_unavailable", severity: "blocking" }),
      ]),
    );
  });
});

describe("ContentAdminService content admin completion APIs", () => {
  it("validates multiple publishing targets with object-level results", async () => {
    const service = newService({ sceneStatus: "draft", defaultAudioConfigured: true });

    const validation = await service.validateTarget(admin, {
      targets: [
        { objectId: "20", objectType: "course" },
        { objectId: "31", objectType: "sentence" },
      ],
    });

    expect(validation.failed).toBe(1);
    expect(validation.succeeded).toBe(1);
    expect(validation.results).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ objectId: "20", objectType: "course", valid: false }),
        expect.objectContaining({ objectId: "31", objectType: "sentence", valid: true }),
      ]),
    );
  });

  it("stores import validation results and returns failed rows as CSV", async () => {
    const settings = new Map<string, Record<string, unknown>>();
    const service = importService(settings);

    const validation = await service.validateImport(admin, {
      importBatchId: "batch-1",
      data: "sentenceText,targetWords\n,meeting\nValid sentence,meeting",
    });
    const result = await service.importResult(admin, "batch-1");
    const csv = await service.importFailureCsv(admin, "batch-1");

    expect(validation.errorCount).toBe(1);
    expect(result.stage).toBe("validated");
    expect(csv).toContain("sentenceText");
    expect(csv).toContain("sentenceText is required");
  });

  it("partially confirms valid import rows and records failed rows", async () => {
    const settings = new Map<string, Record<string, unknown>>();
    const createdRows: Record<string, unknown>[] = [];
    const service = importService(settings, createdRows);

    const result = await service.confirmImport(admin, {
      importBatchId: "batch-2",
      rows: [
        { sentenceText: "", targetWords: ["meeting"] },
        { sentenceText: "Valid sentence", targetWords: ["meeting"] },
      ],
    });
    const stored = await service.importResult(admin, "batch-2");

    expect(result).toEqual(expect.objectContaining({ created: 1, failed: 1, status: "partial_success" }));
    expect(createdRows).toHaveLength(1);
    expect(stored.stage).toBe("confirmed");
  });
});

function newService(options: { sceneStatus?: string; sentenceAudioStatus?: string; defaultAudioConfigured?: boolean }): ContentAdminService {
  const scene = sceneRow({ publishStatus: options.sceneStatus ?? "published" });
  const course = courseRow();
  const sentences = [
    sentenceRow({ id: 31n, sortOrder: 1, audioStatus: options.sentenceAudioStatus ?? "ready" }),
    sentenceRow({ id: 32n, sortOrder: 2, audioStatus: "ready" }),
  ];
  const repository: Pick<ContentAdminRepository, "findCourse" | "findScene" | "findSentence" | "courseSentences" | "setting"> = {
    async courseSentences() {
      return sentences;
    },
    async findCourse() {
      return course;
    },
    async findScene() {
      return scene;
    },
    async findSentence(id) {
      return sentences.find((sentence) => sentence.id === id);
    },
    async setting() {
      return { configured: options.defaultAudioConfigured ?? true };
    },
  };
  return new ContentAdminService(repository as ContentAdminRepository, {
    assertPermission(current: CurrentAdmin, permissionKey: string): void {
      if (!current.permissionKeys.includes(permissionKey)) throw new Error("permission denied");
    },
    audit: async () => undefined,
  } as never);
}

function importService(settings: Map<string, Record<string, unknown>>, createdRows: Record<string, unknown>[] = []): ContentAdminService {
  const repository: Pick<ContentAdminRepository, "createSentence" | "findSentenceByText" | "sortOrdersInCourse" | "setting" | "upsertSetting"> = {
    async createSentence(input) {
      createdRows.push(input);
      return sentenceRow({ id: BigInt(100 + createdRows.length), ...input });
    },
    async findSentenceByText(sentenceText) {
      return sentenceText === "Duplicate sentence" ? sentenceRow({ sentenceText }) : undefined;
    },
    async setting(key) {
      return settings.get(key) ?? null;
    },
    async sortOrdersInCourse() {
      return [];
    },
    async upsertSetting(key, value) {
      settings.set(key, value);
      return value;
    },
  };
  return new ContentAdminService(repository as ContentAdminRepository, {
    assertPermission(current: CurrentAdmin, permissionKey: string): void {
      if (!current.permissionKeys.includes(permissionKey)) throw new Error("permission denied");
    },
    audit: async () => undefined,
  } as never);
}

function sceneRow(patch: Partial<ContentSceneRow> = {}): ContentSceneRow {
  return {
    createdAt: new Date("2026-05-04T00:00:00.000Z"),
    description: "Scene",
    id: 10n,
    name: "Workplace",
    publishStatus: "published",
    slug: "workplace",
    sortOrder: 1,
    updatedAt: new Date("2026-05-04T00:00:00.000Z"),
    updatedByAdminId: null,
    ...patch,
  };
}

function courseRow(patch: Partial<ContentCourseRow> = {}): ContentCourseRow {
  return {
    createdAt: new Date("2026-05-04T00:00:00.000Z"),
    description: "Course",
    id: 20n,
    level: 2,
    maxSentenceCount: 3,
    minSentenceCount: 2,
    needsRevalidation: false,
    publishStatus: "draft",
    sceneId: 10n,
    slug: "meeting",
    sortOrder: 1,
    title: "Meeting",
    unlockPolicy: { type: "none" },
    updatedAt: new Date("2026-05-04T00:00:00.000Z"),
    updatedByAdminId: null,
    ...patch,
  };
}

function sentenceRow(patch: Partial<ContentSentenceRow> = {}): ContentSentenceRow {
  const id = patch.id ?? 31n;
  return {
    audioStatus: "ready",
    bonusWords: [],
    courseId: 20n,
    createdAt: new Date("2026-05-04T00:00:00.000Z"),
    difficultyLevel: 2,
    id,
    importBatchId: null,
    normalAudioUrl: "https://audio.example.com/normal.mp3",
    phraseChunks: [],
    publishStatus: "draft",
    reviewStatus: "approved",
    sceneId: 10n,
    sceneTags: ["workplace"],
    sentenceText: `Sentence ${id.toString()}`,
    slowAudioUrl: null,
    sortOrder: 1,
    targetWords: ["meeting"],
    translationCn: null,
    updatedAt: new Date("2026-05-04T00:00:00.000Z"),
    updatedByAdminId: null,
    ...patch,
  };
}
