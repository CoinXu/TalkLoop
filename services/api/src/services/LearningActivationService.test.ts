import { describe, expect, it } from "vitest";
import { LearningActivationService } from "./LearningActivationService.js";
import type { AnnotationResultRow, AssessmentItemRow, AssessmentSessionRow, CourseRow, LearningActivationRepository, UserVocabularyWithWordRow, WordRow } from "../repositories/LearningActivationRepository.js";

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

describe("LearningActivationService annotation review", () => {
  it("applies approved bulk annotation patches to their target content", async () => {
    let sentencePatch: unknown = null;
    const service = new LearningActivationService(
      {
        now() {
          return new Date("2026-05-05T00:00:00.000Z");
        },
        async bulkUpdateAnnotationResults() {
          return 1;
        },
        async findAnnotationResultsByIds() {
          return [
            annotationResultRow({
              proposedPatch: { bonusWords: ["later"], targetWords: ["try"] },
              resultType: "target_words",
              targetId: 10n,
              targetType: "sentence",
            }),
          ];
        },
        async updateSentence(_id: bigint, patch: unknown) {
          sentencePatch = patch;
          return null;
        },
      } as unknown as LearningActivationRepository,
      {
        assertPermission() {
          return undefined;
        },
        async audit() {
          return undefined;
        },
      } as never,
    );

    const result = await service.adminBulkReviewAnnotationResults(
      { adminUserId: 99n } as never,
      { annotationResultIds: ["1"], resultStatus: "approved" },
    );

    expect(result).toMatchObject({ applied: 1, resultStatus: "approved", updated: 1 });
    expect(sentencePatch).toEqual({ bonusWords: ["later"], targetWords: ["try"] });
  });
});

describe("LearningActivationService adaptive assessment", () => {
  it("starts a word-sampling assessment session with six question items", async () => {
    const session = assessmentSessionRow();
    const createdItems: AssessmentItemRow[] = [];
    const service = new LearningActivationService(
      {
        now() {
          return new Date("2026-05-05T00:00:00.000Z");
        },
        async activeAssessmentConfig() {
          return undefined;
        },
        async findActiveAssessmentSession() {
          return undefined;
        },
        async createAssessmentSession() {
          return session;
        },
        async assessmentQuestionCandidates() {
          return Array.from({ length: 6 }, (_, index) => ({ ...wordRow({ id: BigInt(100 + index), meaningCn: `释义${index}`, word: `word${index}` }), assessmentMeaning: `释义${index}` }));
        },
        async assessmentDistractors(input: { excludeWordIds: bigint[] }) {
          return [1, 2, 3].map((offset) => ({
            ...wordRow({ id: BigInt(200 + offset + input.excludeWordIds.length), meaningCn: `干扰${offset}-${input.excludeWordIds.length}` }),
            assessmentMeaning: `干扰${offset}-${input.excludeWordIds.length}`,
          }));
        },
        async createAssessmentItems(rows: Array<Omit<AssessmentItemRow, "id" | "createdAt" | "updatedAt">>) {
          createdItems.push(...rows.map((row, index) => ({
            ...row,
            createdAt: new Date("2026-05-05T00:00:00.000Z"),
            id: BigInt(1000 + index),
            updatedAt: new Date("2026-05-05T00:00:00.000Z"),
          })));
          return rows.length;
        },
        async findAssessmentSession() {
          return session;
        },
        async listAssessmentRoundItems() {
          return createdItems;
        },
      } as unknown as LearningActivationRepository,
      {} as never,
    );

    const result = await service.startAssessmentSession("user-1", {});

    expect(result.status).toBe("in_progress");
    expect(result.currentRound).toBe(1);
    expect((result.currentRoundItems as unknown[]).length).toBe(6);
    expect(createdItems.every((item) => item.options.length === 4)).toBe(true);
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

function assessmentSessionRow(patch: Partial<AssessmentSessionRow> = {}): AssessmentSessionRow {
  return {
    assessmentVersion: "adaptive-word-sampling-v1",
    completedAt: null,
    configId: null,
    createdAt: new Date("2026-05-05T00:00:00.000Z"),
    currentBand: "L2_MID",
    currentRound: 1,
    expiresAt: new Date("2026-05-06T00:00:00.000Z"),
    id: 500n,
    maxRounds: 9,
    minRounds: 5,
    painPoints: [],
    questionsPerRound: 6,
    resultId: null,
    resultPayload: {},
    selfDescription: {},
    startedAt: new Date("2026-05-05T00:00:00.000Z"),
    status: "in_progress",
    updatedAt: new Date("2026-05-05T00:00:00.000Z"),
    userId: "user-1",
    ...patch,
  };
}

function annotationResultRow(patch: Partial<AnnotationResultRow> = {}): AnnotationResultRow {
  return {
    algorithmVersion: "auto-annotation-v1",
    confidence: "0.9000",
    createdAt: new Date("2026-05-05T00:00:00.000Z"),
    id: 1n,
    manualPatch: {},
    payload: {},
    proposedPatch: {},
    rejectionReason: null,
    resultStatus: "pending_review",
    resultType: "target_words",
    reviewedAt: null,
    reviewerAdminId: null,
    ruleVersion: "auto-annotation-rules-v1",
    severity: "0.6000",
    targetId: 10n,
    targetType: "sentence",
    taskId: 100n,
    trapType: null,
    updatedAt: new Date("2026-05-05T00:00:00.000Z"),
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
