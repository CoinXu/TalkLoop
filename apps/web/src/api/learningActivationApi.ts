import { requestFormData, requestJson } from "./client";
import type {
  AdminSession,
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
  courses: () => requestJson<ListResponse<Course>>("/learning/courses"),
  dailyTask: () => requestJson<DailyTask>("/learning/daily-task", { requireSession: true }),
  resetDailyTask: (taskDate?: string) =>
    requestJson<DailyTask>(withQuery("/learning/daily-task/reset", { taskDate }), { method: "POST", requireSession: true }),
  listenRepeatAttempt: (body: JsonRecord) =>
    requestJson<JsonRecord>("/learning/listen-repeat/attempts", { body, method: "POST", requireSession: true }),
  scenes: () => requestJson<ListResponse<Scene>>("/learning/scenes"),
  sentences: (courseId?: string) =>
    requestJson<ListResponse<Sentence>>(courseId ? `/learning/sentences?courseId=${encodeURIComponent(courseId)}` : "/learning/sentences"),
  submitAssessment: (body: JsonRecord) =>
    requestJson<JsonRecord>("/learning/assessment/self-description", { body, method: "POST", requireSession: true }),
  vocabulary: () => requestJson<VocabularyOverview>("/learning/vocabulary", { requireSession: true }),
  vocabularyWords: (status?: string) =>
    requestJson<ListResponse<JsonRecord>>(`/learning/vocabulary/words${status ? `?status=${encodeURIComponent(status)}` : ""}`, {
      requireSession: true,
    }),
  words: () => requestJson<ListResponse<WordEntry>>(`/word-library/words${defaultListQuery}`),
};

export const adminApi = {
  accounts: () => requestJson<ListResponse<JsonRecord>>(`/admin/accounts${defaultListQuery}`, { requireAdmin: true }),
  auditLogs: () => requestJson<ListResponse<JsonRecord>>(`/admin/audit-logs${defaultListQuery}`, { requireAdmin: true }),
  courseReports: () => requestJson<ListResponse<JsonRecord>>(`/admin/course-reports${defaultListQuery}`, { requireAdmin: true }),
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
  updateWord: (wordId: string, body: JsonRecord) =>
    requestJson<WordEntry>(`/admin/word-library/words/${wordId}`, { body, method: "PATCH", requireAdmin: true }),
  userVocabulary: () => requestJson<ListResponse<JsonRecord>>(`/admin/user-vocabulary/words${defaultListQuery}`, { requireAdmin: true }),
  words: (query?: Record<string, QueryValue>) =>
    requestJson<ListResponse<WordEntry>>(withQuery("/admin/word-library/words", { limit: 10, offset: 0, ...query }), { requireAdmin: true }),
};
