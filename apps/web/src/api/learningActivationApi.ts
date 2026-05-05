import { requestFormData, requestJson } from "./client";
import type {
  AdminSession,
  ContinueLearningResponse,
  Course,
  CreateWordsFromSubtlexusResult,
  DailyTask,
  JsonRecord,
  ListResponse,
  Scene,
  Sentence,
  SubtlexusImportResult,
  SubtlexusWord,
  VocabularyOverview,
  WordEntry,
  WordMeta,
} from "../types";

const defaultListQuery = "?limit=10&offset=0";

type QueryValue = boolean | number | string | null | undefined;

function withQuery(path: string, query?: Record<string, QueryValue>): string {
  const params = new URLSearchParams();
  Object.entries(query ?? {}).forEach(([key, value]) => {
    if (value === null || value === undefined || value === "") return;
    params.set(key, String(value));
  });
  const text = params.toString();
  return text ? `${path}?${text}` : path;
}

export const learningApi = {
  activeAssessment: () => requestJson<JsonRecord>("/learning/assessment/active"),
  activationAttempt: (body: JsonRecord) =>
    requestJson<JsonRecord>("/learning/practice/activation-attempts", { body, method: "POST", requireSession: true }),
  courseReport: (body: JsonRecord) =>
    requestJson<JsonRecord>("/learning/course-reports", { body, method: "POST", requireSession: true }),
  continueLearning: (query?: Record<string, QueryValue>) =>
    requestJson<ContinueLearningResponse>(withQuery("/learning/continue-learning", { limit: 6, ...query }), { requireSession: true }),
  courses: () => requestJson<ListResponse<Course>>("/learning/courses"),
  dailyTask: () => requestJson<DailyTask>("/learning/daily-task", { requireSession: true }),
  resetDailyTask: (taskDate?: string) =>
    requestJson<DailyTask>(withQuery("/learning/daily-task/reset", { taskDate }), { method: "POST", requireSession: true }),
  listenRepeatAttempt: (body: JsonRecord) =>
    requestJson<JsonRecord>("/learning/listen-repeat/attempts", { body: normalizeListenRepeatAttemptBody(body), method: "POST", requireSession: true }),
  scenes: () => requestJson<ListResponse<Scene>>("/learning/scenes"),
  sentences: (courseId?: string) =>
    requestJson<ListResponse<Sentence>>(courseId ? `/learning/sentences?courseId=${encodeURIComponent(courseId)}` : "/learning/sentences"),
  submitAssessment: (body: JsonRecord) =>
    requestJson<JsonRecord>("/learning/assessment/self-description", { body, method: "POST", requireSession: true }),
  vocabulary: () => requestJson<VocabularyOverview>("/learning/vocabulary", { requireSession: true }),
  vocabularyWords: (query?: Record<string, QueryValue>) =>
    requestJson<ListResponse<JsonRecord>>(withQuery("/learning/vocabulary/words", { limit: 10, offset: 0, ...query }), {
      requireSession: true,
    }),
  wordMeta: (query?: Record<string, QueryValue>) =>
    requestJson<ListResponse<WordMeta>>(withQuery("/word-library/word-meta", { limit: 10, offset: 0, ...query })),
  words: () => requestJson<ListResponse<WordEntry>>(`/word-library/words${defaultListQuery}`),
};

function normalizeListenRepeatAttemptBody(body: JsonRecord): JsonRecord {
  const output = { ...body };
  if (output.textMatchRate === null || output.textMatchRate === undefined || output.textMatchRate === "") {
    delete output.textMatchRate;
  }
  return output;
}

export const adminApi = {
  accounts: () => requestJson<ListResponse<JsonRecord>>(`/admin/accounts${defaultListQuery}`, { requireAdmin: true }),
  auditLogs: () => requestJson<ListResponse<JsonRecord>>(`/admin/audit-logs${defaultListQuery}`, { requireAdmin: true }),
  courseReports: () => requestJson<ListResponse<JsonRecord>>(`/admin/course-reports${defaultListQuery}`, { requireAdmin: true }),
  contentBatchStatus: (body: JsonRecord) =>
    requestJson<JsonRecord>("/admin/content/status/batch", { body, method: "POST", requireAdmin: true }),
  contentConfirmImport: (body: JsonRecord) =>
    requestJson<JsonRecord>("/admin/content/imports/confirm", { body, method: "POST", requireAdmin: true }),
  contentCourses: (query?: Record<string, QueryValue>) =>
    requestJson<ListResponse<JsonRecord>>(withQuery("/admin/content/courses", { limit: 100, offset: 0, ...query }), { requireAdmin: true }),
  contentCreateCourse: (body: JsonRecord) =>
    requestJson<JsonRecord>("/admin/content/courses", { body, method: "POST", requireAdmin: true }),
  contentCreateScene: (body: JsonRecord) =>
    requestJson<JsonRecord>("/admin/content/scenes", { body, method: "POST", requireAdmin: true }),
  contentCreateSentence: (body: JsonRecord) =>
    requestJson<JsonRecord>("/admin/content/sentences", { body, method: "POST", requireAdmin: true }),
  contentDefaultAudio: () => requestJson<JsonRecord>("/admin/content/audio/default", { requireAdmin: true }),
  contentPublish: (body: JsonRecord) =>
    requestJson<JsonRecord>("/admin/content/publishing/publish", { body, method: "POST", requireAdmin: true }),
  contentPublishingValidation: () => requestJson<JsonRecord>("/admin/content/publishing/validation", { requireAdmin: true }),
  contentSaveComposition: (courseId: string, body: JsonRecord) =>
    requestJson<JsonRecord>(`/admin/content/courses/${courseId}/composition`, { body, method: "POST", requireAdmin: true }),
  contentScenes: (query?: Record<string, QueryValue>) =>
    requestJson<ListResponse<JsonRecord>>(withQuery("/admin/content/scenes", { limit: 100, offset: 0, ...query }), { requireAdmin: true }),
  contentSentences: (query?: Record<string, QueryValue>) =>
    requestJson<ListResponse<JsonRecord>>(withQuery("/admin/content/sentences", { limit: 100, offset: 0, ...query }), {
      requireAdmin: true,
    }),
  contentSummary: () => requestJson<JsonRecord>("/admin/content/summary", { requireAdmin: true }),
  contentUpdateCourse: (courseId: string, body: JsonRecord) =>
    requestJson<JsonRecord>(`/admin/content/courses/${courseId}`, { body, method: "PATCH", requireAdmin: true }),
  contentUpdateDefaultAudio: (body: JsonRecord) =>
    requestJson<JsonRecord>("/admin/content/audio/default", { body, method: "PUT", requireAdmin: true }),
  contentUpdateScene: (sceneId: string, body: JsonRecord) =>
    requestJson<JsonRecord>(`/admin/content/scenes/${sceneId}`, { body, method: "PATCH", requireAdmin: true }),
  contentUpdateSentence: (sentenceId: string, body: JsonRecord) =>
    requestJson<JsonRecord>(`/admin/content/sentences/${sentenceId}`, { body, method: "PATCH", requireAdmin: true }),
  contentValidateImport: (body: JsonRecord) =>
    requestJson<JsonRecord>("/admin/content/imports/validate", { body, method: "POST", requireAdmin: true }),
  courses: () => requestJson<ListResponse<Course>>(`/admin/corpus/courses${defaultListQuery}`, { requireAdmin: true }),
  createAccount: (body: JsonRecord) => requestJson<JsonRecord>("/admin/accounts", { body, method: "POST", requireAdmin: true }),
  createAnnotationTask: (body: JsonRecord) =>
    requestJson<JsonRecord>("/admin/annotations/tasks", { body, method: "POST", requireAdmin: true }),
  createAssessmentConfig: (body: JsonRecord) =>
    requestJson<JsonRecord>("/admin/assessment/configs", { body, method: "POST", requireAdmin: true }),
  createCourse: (body: JsonRecord) => requestJson<Course>("/admin/corpus/courses", { body, method: "POST", requireAdmin: true }),
  createDailyTaskStrategy: (body: JsonRecord) =>
    requestJson<JsonRecord>("/admin/daily-tasks/strategies", { body, method: "POST", requireAdmin: true }),
  createPracticeRule: (body: JsonRecord) =>
    requestJson<JsonRecord>("/admin/practice/rules", { body, method: "POST", requireAdmin: true }),
  createScene: (body: JsonRecord) => requestJson<Scene>("/admin/corpus/scenes", { body, method: "POST", requireAdmin: true }),
  createSentence: (body: JsonRecord) => requestJson<Sentence>("/admin/corpus/sentences", { body, method: "POST", requireAdmin: true }),
  createWord: (body: JsonRecord) => requestJson<WordEntry>("/admin/word-library/words", { body, method: "POST", requireAdmin: true }),
  createWordsFromSubtlexus: (body: JsonRecord) =>
    requestJson<CreateWordsFromSubtlexusResult>("/admin/word-library/words/from-subtlexus", { body, method: "POST", requireAdmin: true }),
  dailyTaskStrategies: () => requestJson<ListResponse<JsonRecord>>(`/admin/daily-tasks/strategies${defaultListQuery}`, { requireAdmin: true }),
  listenRepeatAttempts: () => requestJson<ListResponse<JsonRecord>>(`/admin/listen-repeat/attempts${defaultListQuery}`, { requireAdmin: true }),
  login: (loginName: string, password: string) =>
    requestJson<AdminSession>("/admin/auth/login", { body: { loginName, password }, method: "POST" }),
  logout: () => requestJson<null>("/admin/auth/logout", { method: "POST", requireAdmin: true }),
  me: () => requestJson<AdminSession>("/admin/auth/me", { requireAdmin: true }),
  practiceRules: () => requestJson<ListResponse<JsonRecord>>(`/admin/practice/rules${defaultListQuery}`, { requireAdmin: true }),
  scenes: () => requestJson<ListResponse<Scene>>(`/admin/corpus/scenes${defaultListQuery}`, { requireAdmin: true }),
  sentences: () => requestJson<ListResponse<Sentence>>(`/admin/corpus/sentences${defaultListQuery}`, { requireAdmin: true }),
  updateWordPublish: (wordId: string, publishStatus: string, reason: string) =>
    requestJson<WordEntry>(`/admin/word-library/words/${wordId}/publish`, {
      body: { publishStatus, reason },
      method: "POST",
      requireAdmin: true,
    }),
  importSubtlexus: (file: File, query: { dryRun?: boolean; limit?: number | null; reason?: string }) => {
    const params = new URLSearchParams();
    if (query.dryRun === true) params.set("dryRun", "true");
    if (query.limit) params.set("limit", String(query.limit));
    if (query.reason) params.set("reason", query.reason);
    const body = new FormData();
    body.append("file", file);
    const path = `/admin/word-library/imports/subtlexus${params.toString() ? `?${params.toString()}` : ""}`;
    return requestFormData<SubtlexusImportResult>(path, {
      body,
      method: "POST",
      requireAdmin: true,
    });
  },
  subtlexusWords: (query?: Record<string, QueryValue>) =>
    requestJson<ListResponse<SubtlexusWord>>(withQuery("/admin/word-library/subtlexus-words", { limit: 10, offset: 0, ...query }), {
      requireAdmin: true,
    }),
  wordMeta: (query?: Record<string, QueryValue>) =>
    requestJson<ListResponse<WordMeta>>(withQuery("/admin/word-library/word-meta", { limit: 10, offset: 0, ...query }), {
      requireAdmin: true,
    }),
  applyWordMeta: (wordMetaId: string, body: JsonRecord) =>
    requestJson<WordEntry>(`/admin/word-library/word-meta/${wordMetaId}/apply`, { body, method: "POST", requireAdmin: true }),
  updateWord: (wordId: string, body: JsonRecord) =>
    requestJson<WordEntry>(`/admin/word-library/words/${wordId}`, { body, method: "PATCH", requireAdmin: true }),
  userVocabulary: () => requestJson<ListResponse<JsonRecord>>(`/admin/user-vocabulary/words${defaultListQuery}`, { requireAdmin: true }),
  words: (query?: Record<string, QueryValue>) =>
    requestJson<ListResponse<WordEntry>>(withQuery("/admin/word-library/words", { limit: 10, offset: 0, ...query }), { requireAdmin: true }),
};
