import { describe, expect, it } from "vitest";
import { LearningActivationService } from "./LearningActivationService.js";
import type { CourseRow, LearningActivationRepository, UserVocabularyWithWordRow, WordRow } from "../repositories/LearningActivationRepository.js";

describe("LearningActivationService course unlock", () => {
  it("unlocks the first three published courses by list rank instead of sortOrder value", async () => {
    const service = new LearningActivationService(
      {
        async courseSentenceCount() {
          return 0;
        },
        async listCourses() {
          return [
            courseRow({ id: 1n, sortOrder: 10, title: "First" }),
            courseRow({ id: 2n, sortOrder: 20, title: "Second" }),
            courseRow({ id: 3n, sortOrder: 30, title: "Third" }),
            courseRow({ id: 4n, sortOrder: 40, title: "Fourth" }),
          ];
        },
      } as unknown as LearningActivationRepository,
      {} as never,
    );

    const courses = await service.listPublicCourses({ limit: 10, offset: 0 });

    expect(courses.map((course) => course.unlocked)).toEqual([true, true, true, false]);
    expect(courses[0]?.sortOrder).toBe(10);
    expect(courses[3]?.lockReason).toBe("previous_course_required");
  });

  it("uses the query offset when calculating unlock rank", async () => {
    const service = new LearningActivationService(
      {
        async courseSentenceCount() {
          return 0;
        },
        async listCourses() {
          return [courseRow({ id: 4n, sortOrder: 40, title: "Fourth" })];
        },
      } as unknown as LearningActivationRepository,
      {} as never,
    );

    const courses = await service.listPublicCourses({ limit: 1, offset: 3 });

    expect(courses[0]?.unlocked).toBe(false);
  });
});

describe("LearningActivationService continue learning", () => {
  it("returns the next batch by due review, yellow consolidation, then red activation priority", async () => {
    const service = new LearningActivationService(
      {
        async listUserVocabulary(query: Parameters<LearningActivationRepository["listUserVocabulary"]>[0]) {
          if (query.status === "green" && query.dueOnly) return [vocabularyRow({ id: 1n, wordId: 101n, activationStatus: "green", word: "green" })];
          if (query.status === "yellow") return [vocabularyRow({ id: 2n, wordId: 102n, activationStatus: "yellow", word: "yellow" })];
          if (query.status === "red") return [vocabularyRow({ id: 3n, wordId: 103n, activationStatus: "red", word: "red" })];
          return [];
        },
        async vocabularySummary() {
          return { green: 1, red: 1, yellow: 1 };
        },
      } as unknown as LearningActivationRepository,
      {} as never,
    );

    const batch = await service.continueLearning("user-1", { limit: 3 });

    expect((batch.items as Record<string, unknown>[]).map((item) => item.prioritySource)).toEqual(["due_review", "yellow_consolidation", "red_activation"]);
    expect((batch.items as Record<string, unknown>[]).map((item) => item.practiceType)).toEqual(["review", "audio_meaning", "audio_meaning"]);
  });

  it("returns specific empty reasons when candidates are not consumable", async () => {
    const service = new LearningActivationService(
      {
        async listUserVocabulary(query: Parameters<LearningActivationRepository["listUserVocabulary"]>[0]) {
          if (query.status === "red") {
            return [vocabularyRow({ audioStatus: "missing", audioUrl: null, id: 3n, wordId: 103n, activationStatus: "red", word: "red" })];
          }
          return [];
        },
        async vocabularySummary() {
          return { red: 1 };
        },
      } as unknown as LearningActivationRepository,
      {} as never,
    );

    const batch = await service.continueLearning("user-1", { limit: 3 });

    expect(batch.items).toEqual([]);
    expect(batch.emptyReasons).toContain("no_audio");
    expect(batch.emptyReasons).toContain("no_unlocked_red_words");
  });
});

function courseRow(patch: Partial<CourseRow> = {}): CourseRow {
  return {
    createdAt: new Date("2026-05-05T00:00:00.000Z"),
    description: null,
    id: 1n,
    level: 1,
    maxSentenceCount: 12,
    minSentenceCount: 8,
    needsRevalidation: false,
    publishStatus: "published",
    sceneId: 10n,
    slug: "course",
    sortOrder: 10,
    title: "Course",
    unlockPolicy: { type: "previous_course_completed" },
    updatedAt: new Date("2026-05-05T00:00:00.000Z"),
    updatedByAdminId: null,
    ...patch,
  };
}

function vocabularyRow(
  patch: Partial<UserVocabularyWithWordRow> & { audioStatus?: string; audioUrl?: string | null; word?: string } = {},
): UserVocabularyWithWordRow {
  const word = wordRow({
    audioStatus: patch.audioStatus ?? "ready",
    audioUrl: patch.audioUrl === undefined ? "/audio/default.mp3" : patch.audioUrl,
    id: patch.wordId ?? 100n,
    word: patch.word ?? "word",
  });
  return {
    activationStatus: "red",
    avoidUntil: null,
    consecutiveCorrect: 0,
    createdAt: new Date("2026-05-05T00:00:00.000Z"),
    failureCount: 0,
    id: 1n,
    lastPracticeType: null,
    nextReviewAt: new Date("2026-05-05T00:00:00.000Z"),
    sentenceExposures: 0,
    skipCount: 0,
    source: "self_description",
    spokenCount: 0,
    srsIntervalDays: 0,
    totalAttempts: 0,
    totalCorrect: 0,
    updatedAt: new Date("2026-05-05T00:00:00.000Z"),
    userId: "user-1",
    weakPronunciations: [],
    senses: [],
    wordEntry: word,
    wordId: word.id,
    ...patch,
  };
}

function wordRow(patch: Partial<WordRow> = {}): WordRow {
  return {
    audioStatus: "ready",
    audioUrl: "/audio/default.mp3",
    cdCount: null,
    cdLow: null,
    commonCollocations: [],
    createdAt: new Date("2026-05-05T00:00:00.000Z"),
    difficultyLevel: 1,
    distractors: { difficulty: [], meaning: [], pronunciation: [] },
    exclusionReason: null,
    frequencyCount: 100,
    frequencyLow: null,
    hearingTrap: null,
    id: 100n,
    isExcluded: false,
    lemma: "word",
    levelTags: [],
    lg10cd: null,
    lg10wf: "3.5",
    meaningCn: "词",
    phonetic: null,
    publishStatus: "published",
    reviewStatus: "approved",
    sceneTags: [],
    subtlcd: null,
    subtlwf: null,
    updatedAt: new Date("2026-05-05T00:00:00.000Z"),
    word: "word",
    ...patch,
  };
}
