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

function newService(options: { sceneStatus?: string; sentenceAudioStatus?: string; defaultAudioConfigured?: boolean }): ContentAdminService {
  const scene = sceneRow({ publishStatus: options.sceneStatus ?? "published" });
  const course = courseRow();
  const sentences = [
    sentenceRow({ id: 31n, sortOrder: 1, audioStatus: options.sentenceAudioStatus ?? "ready" }),
    sentenceRow({ id: 32n, sortOrder: 2, audioStatus: "ready" }),
  ];
  const repository: Pick<ContentAdminRepository, "findCourse" | "findScene" | "courseSentences" | "setting"> = {
    async courseSentences() {
      return sentences;
    },
    async findCourse() {
      return course;
    },
    async findScene() {
      return scene;
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
