import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";

function mockFetch(): void {
  const contentScenes = [
    {
      courseCount: 1,
      description: "会议、汇报和跨团队沟通常用表达",
      name: "职场沟通",
      publishedCourseCount: 1,
      sceneId: "1001",
      slug: "workplace-communication",
      sortOrder: 10,
      status: "published",
      updatedAt: "2026-05-04T09:20:00.000Z",
    },
  ];
  const contentCourses = [
    {
      courseId: "2001",
      description: "会议中表达观点、追问细节和确认行动项",
      level: 3,
      maxSentenceCount: 8,
      minSentenceCount: 1,
      needsRevalidation: false,
      sceneId: "1001",
      sentenceCount: 1,
      slug: "meeting-essentials",
      sortOrder: 10,
      status: "published",
      title: "会议沟通基础",
      updatedAt: "2026-05-04T10:10:00.000Z",
      validation: { issues: [], valid: true },
    },
  ];
  const contentSentences = [
    {
      audioStatus: "ready",
      courseId: "2001",
      difficultyLevel: 3,
      normalAudioUrl: null,
      phraseChunks: ["walk me through", "the report"],
      sceneId: "1001",
      sceneTags: ["workplace"],
      sentenceId: "3001",
      slowAudioUrl: null,
      sortOrder: 1,
      status: "published",
      targetWords: ["walk through"],
      sentenceText: "Could you walk me through the report?",
      updatedAt: "2026-05-04T10:11:00.000Z",
    },
    {
      audioStatus: "missing",
      courseId: null,
      difficultyLevel: 2,
      normalAudioUrl: null,
      phraseChunks: ["set off", "before sunrise"],
      sceneId: null,
      sceneTags: ["travel"],
      sentenceId: "3002",
      slowAudioUrl: null,
      sortOrder: 0,
      status: "draft",
      targetWords: ["set off"],
      sentenceText: "We should set off before sunrise.",
      updatedAt: "2026-05-03T19:10:00.000Z",
    },
  ];
  const auditLogs = [
    {
      actionType: "content_scene_update",
      actor: "Super Admin",
      auditId: "audit-1",
      createdAt: "2026-05-04T10:00:00.000Z",
      objectId: "1001",
      objectType: "scene",
      summary: "保存场景 职场沟通",
    },
  ];
  const wordMeta = [
    {
      createdAt: "2026-05-04T12:00:00.000Z",
      derivedFields: { meaningEn: "to guide someone through details", partOfSpeech: "verb", phonetic: "/wɔːk/" },
      importBatchId: "dict-batch-1",
      licenseName: "CC BY-SA",
      licenseUrl: "https://example.com/license",
      meanings: [{ definitions: [{ definition: "to guide someone through a process", example: "I can walk you through the setup.", synonyms: ["guide"], antonyms: ["confuse"] }, { definition: "to move on foot", synonyms: [], antonyms: [] }], partOfSpeech: "verb", synonyms: ["lead"], antonyms: [] }],
      normalizedWord: "walk",
      phonetics: [{ audio: "https://example.com/walk.mp3", text: "/wɔːk/" }],
      rawPayload: [{
        license: { name: "CC BY-SA 3.0", url: "https://creativecommons.org/licenses/by-sa/3.0" },
        meanings: [{ definitions: [{ definition: "to guide someone through a process", example: "I can walk you through the setup.", synonyms: ["guide"], antonyms: ["confuse"] }, { definition: "to move on foot", synonyms: [], antonyms: [] }], partOfSpeech: "verb", synonyms: ["lead"], antonyms: [] }],
        phonetic: "/wɔːk/",
        phonetics: [{ audio: "https://example.com/walk.mp3", text: "/wɔːk/" }],
        sourceUrls: ["https://en.wiktionary.org/wiki/walk"],
        word: "walk",
      }],
      source: "dictionaryapi",
      sourceUrl: "https://api.dictionaryapi.dev/api/v2/entries/en/walk",
      updatedAt: "2026-05-04T12:00:00.000Z",
      word: "walk",
      wordId: "word-1",
      wordMetaId: "meta-1",
    },
  ];

  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("/admin/content/scenes") && init?.method === "POST") {
        const body = parseBody(init.body);
        contentScenes.push({
          courseCount: 0,
          description: String(body.description ?? ""),
          name: String(body.name ?? "新建场景"),
          publishedCourseCount: 0,
          sceneId: "1002",
          slug: String(body.slug ?? "new-scene"),
          sortOrder: Number(body.sortOrder ?? 20),
          status: "draft",
          updatedAt: "2026-05-04T11:00:00.000Z",
        });
        auditLogs.unshift({
          actionType: "content_scene_create",
          actor: "Super Admin",
          auditId: "audit-2",
          createdAt: "2026-05-04T11:00:00.000Z",
          objectId: "1002",
          objectType: "scene",
          summary: `新建场景 ${String(body.name ?? "新建场景")}`,
        });
        return json(contentScenes[contentScenes.length - 1]);
      }
      if (url.includes("/admin/content/scenes")) return json({ items: contentScenes });
      if (url.includes("/admin/content/courses/") && url.includes("/composition")) return json({ courseId: "2001", sentenceCount: 1, validation: { issues: [], valid: true } });
      if (url.includes("/admin/content/courses")) return json({ items: contentCourses });
      if (url.includes("/admin/content/sentences")) {
        const params = new URL(url, "http://localhost").searchParams;
        const assigned = params.get("assigned");
        const sceneId = params.get("sceneId");
        const limit = Number(params.get("limit") ?? 10);
        const offset = Number(params.get("offset") ?? 0);
        const filtered = contentSentences.filter((sentence) => {
          if (assigned === "true" && !sentence.courseId) return false;
          if (assigned === "false" && sentence.courseId) return false;
          if (sceneId) return sentence.sceneId === sceneId;
          return true;
        });
        return json({ items: filtered.slice(offset, offset + limit) });
      }
      if (url.includes("/admin/content/audio/default")) return json({ configured: true, normalAudioUrl: null, slowAudioUrl: null });
      if (url.includes("/admin/content/publishing/validation")) return json({ issues: [] });
      if (url.includes("/admin/content/status/batch")) return json({ failed: 0, failures: [], skipped: 0, succeeded: 1 });
      if (url.includes("/admin/audit-logs")) return json({ items: auditLogs });
      if (url.includes("/word-library/word-meta")) return json({ items: wordMeta });
      if (url.includes("/word-library/words")) return json({ items: [] });
      if (url.includes("/learning/courses")) return json({ items: [] });
      if (url.includes("/learning/sentences")) return json({ items: [] });
      if (url.includes("/learning/assessment/active")) return json({ assessmentConfigId: null, selfDescriptionQuestions: [] });
      return json({ items: [] });
    }),
  );
}

function parseBody(body: BodyInit | null | undefined): Record<string, unknown> {
  return typeof body === "string" ? JSON.parse(body) as Record<string, unknown> : {};
}

describe("App v1.0 shell", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.location.hash = "#/";
    mockFetch();
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("renders learning activation tabs", async () => {
    render(<App />);

    expect(await screen.findByRole("button", { name: /学习端/ })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /今日任务/ })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /水平评估/ })).toBeInTheDocument();
  });

  it("routes to admin dashboard without polling admin APIs before login", async () => {
    render(<App />);

    const adminButtons = screen.getAllByRole("button", { name: /管理后台/ });
    expect(adminButtons.length).toBeGreaterThan(0);
    const firstAdminButton = adminButtons[0];
    if (!firstAdminButton) throw new Error("Admin button missing");
    await userEvent.click(firstAdminButton);

    expect(await screen.findByText("管理员登录")).toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalledWith(expect.stringContaining("/admin/auth/me"), expect.anything());
  });

  it("renders content admin console for an existing super admin session", async () => {
    seedSuperAdminSession();
    window.location.hash = "#/admin/scenes";

    render(<App />);

    expect(await screen.findByText("职场沟通")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "发布" }).some((button) => button.hasAttribute("disabled"))).toBe(true);
  });

  it("keeps word frequency and word management in admin navigation", async () => {
    seedSuperAdminSession();
    window.location.hash = "#/admin/word-library";

    render(<App />);

    expect(await screen.findByRole("button", { name: /词频 \/ 单词/ })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /SUBTLEXus 词频/ })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /单词管理/ })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Word Meta/ })).toBeInTheDocument();
  });

  it("queries word meta from the learning dictionary", async () => {
    seedSuperAdminSession();
    render(<App />);

    await userEvent.click(await screen.findByRole("tab", { name: /词典/ }));
    await userEvent.type(screen.getByLabelText("查询单词"), "walk");
    await userEvent.click(screen.getByRole("button", { name: "查询" }));

    expect(await screen.findByText("to guide someone through a process")).toBeInTheDocument();
    expect(screen.queryByText("to move on foot")).not.toBeInTheDocument();
    expect(screen.getByText(/I can walk you through the setup/)).toBeInTheDocument();
    expect(screen.getByText("guide")).toBeInTheDocument();
    expect(screen.getByText("confuse")).toBeInTheDocument();
    expect(screen.getAllByLabelText("发音播放器").length).toBeGreaterThan(0);
    expect(fetch).toHaveBeenCalledWith(expect.stringMatching(/\/word-library\/word-meta\?.*keyword=walk/), expect.anything());
  });

  it("omits empty text match rate from listen-repeat attempts", async () => {
    window.localStorage.setItem("learning-activation-user-session", JSON.stringify({ sessionId: "local-demo-user-test" }));
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes("/learning/listen-repeat/attempts")) return json({ listenRepeatAttemptId: "repeat-1", vocabularyUpdates: [] });
        if (url.includes("/learning/sentences")) {
          return json({
            items: [
              {
                audioStatus: "ready",
                courseId: "2001",
                difficultyLevel: 1,
                normalAudioUrl: null,
                phraseChunks: [],
                sceneId: null,
                sceneTags: [],
                sentenceId: "3001",
                sentenceText: "Let's try!",
                slowAudioUrl: null,
                sortOrder: 1,
                targetWords: ["try"],
                translationCn: null,
              },
            ],
          });
        }
        if (url.includes("/learning/assessment/active")) return json({ assessmentConfigId: null, selfDescriptionQuestions: [] });
        if (url.includes("/learning/vocabulary")) return json({ activationRate: 0, green: 0, red: 0, total: 0, yellow: 0 });
        if (url.includes("/learning/courses")) return json({ items: [] });
        return json({ items: [] });
      }),
    );

    render(<App />);

    await userEvent.click(await screen.findByRole("tab", { name: /听读/ }));
    await userEvent.click(await screen.findByRole("button", { name: "提交跟读" }));

    const listenRepeatCall = vi.mocked(fetch).mock.calls.find(([input]) => String(input).includes("/learning/listen-repeat/attempts"));
    const body = parseBody(listenRepeatCall?.[1]?.body);
    expect(body).toMatchObject({ mode: "A", sentenceId: "3001", targetWordHits: ["try"] });
    expect(body).not.toHaveProperty("textMatchRate");
  });

  it("keeps locked courses disabled in the learning course list", async () => {
    const course = {
      courseId: "2001",
      description: "会议中表达观点、追问细节和确认行动项",
      level: 3,
      lockReason: "previous_course_required",
      publishStatus: "published",
      sceneId: "1001",
      sentenceCount: 1,
      title: "会议沟通基础",
      unlocked: false,
    };
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes("/learning/courses")) return json({ items: [course] });
        if (url.includes("/learning/assessment/active")) return json({ assessmentConfigId: null, selfDescriptionQuestions: [] });
        if (url.includes("/learning/vocabulary")) return json({ activationRate: 0, green: 0, red: 0, total: 0, yellow: 0 });
        if (url.includes("/word-library/words")) return json({ items: [] });
        return json({ items: [] });
      }),
    );

    render(<App />);

    await userEvent.click(await screen.findByRole("tab", { name: /课程/ }));

    expect(await screen.findByRole("button", { name: "未解锁" })).toBeDisabled();
    expect(screen.getByText(/previous_course_required/)).toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalledWith(expect.stringMatching(/\/learning\/sentences\?courseId=2001/), expect.anything());
  });

  it("starts an unlocked course task and saves a course report", async () => {
    const course = {
      courseId: "2001",
      description: "会议中表达观点、追问细节和确认行动项",
      level: 3,
      publishStatus: "published",
      sceneId: "1001",
      sentenceCount: 1,
      title: "会议沟通基础",
      unlocked: true,
    };
    const courseSentence = {
      courseId: "2001",
      difficultyLevel: 3,
      normalAudioUrl: "https://example.com/normal.mp3",
      sceneId: "1001",
      sentenceId: "3001",
      sentenceText: "Could you walk me through the report?",
      slowAudioUrl: "https://example.com/slow.mp3",
      targetWords: ["walk through"],
      translationCn: "你能带我过一下这份报告吗？",
    };
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url.includes("/learning/course-reports")) {
          const body = parseBody(init?.body);
          return json({
            activatedWordIds: [],
            averageAccuracy: String(body.averageAccuracy ?? "1"),
            averageSpeedRatio: String(body.averageSpeedRatio ?? "1"),
            bestSentenceId: body.bestSentenceId,
            courseId: body.courseId,
            courseReportId: "report-1",
            createdAt: "2026-05-05T00:00:00.000Z",
            practicedSentenceCount: body.practicedSentenceCount,
            reportPayload: body.reportPayload ?? {},
            userId: "local-demo-user-test",
            weakSentenceIds: [],
          });
        }
        if (url.includes("/learning/listen-repeat/attempts")) return json({ listenRepeatAttemptId: "repeat-1", vocabularyUpdates: [] });
        if (url.includes("/learning/courses")) return json({ items: [course] });
        if (url.includes("/learning/sentences")) return json({ items: [courseSentence] });
        if (url.includes("/learning/assessment/active")) return json({ assessmentConfigId: null, selfDescriptionQuestions: [] });
        if (url.includes("/learning/vocabulary")) return json({ activationRate: 0, green: 0, red: 0, total: 0, yellow: 0 });
        if (url.includes("/word-library/words")) return json({ items: [] });
        return json({ items: [] });
      }),
    );

    render(<App />);

    await userEvent.click(await screen.findByRole("tab", { name: /课程/ }));
    await userEvent.click(await screen.findByRole("button", { name: "开始学习" }));

    expect(await screen.findByText("Could you walk me through the report?")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "完成本句" }));

    expect(await screen.findByText("课程报告")).toBeInTheDocument();
    expect(screen.getByText("本课已完成，课程报告已保存。")).toBeInTheDocument();
    const listenRepeatCall = vi.mocked(fetch).mock.calls.find(([input]) => String(input).includes("/learning/listen-repeat/attempts"));
    expect(JSON.parse(String(listenRepeatCall?.[1]?.body))).toMatchObject({ mode: "A", sentenceId: "3001" });
    expect(fetch).toHaveBeenCalledWith(expect.stringMatching(/\/learning\/sentences\?courseId=2001/), expect.anything());
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining("/learning/course-reports"), expect.anything());
  });

  it("hydrates daily task word details from user vocabulary by word id", async () => {
    window.localStorage.setItem("learning-activation-user-session", JSON.stringify({ sessionId: "local-demo-user-test" }));
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes("/learning/vocabulary/words")) {
          return json({
            items: [
              {
                audioUrl: "https://example.com/anchor.mp3",
                difficultyLevel: 2,
                meaningCn: "锚点",
                phonetic: "/ˈæŋkər/",
                senses: [{
                  antonyms: [],
                  definition: "a point that keeps something in place",
                  definitionIndex: 0,
                  example: null,
                  partOfSpeech: "noun",
                  rawDefinition: {},
                  senseIndex: 0,
                  source: "dictionaryapi",
                  synonyms: [],
                  wordId: "word-99",
                  wordMetaId: null,
                  wordSenseId: "sense-99",
                }],
                word: "anchor",
                wordId: "word-99",
              },
            ],
          });
        }
        if (url.includes("/learning/vocabulary")) return json({ activationRate: 0, green: 0, red: 1, total: 1, yellow: 0 });
        if (url.includes("/learning/daily-task")) {
          return json({
            dailyTaskId: "task-1",
            items: [{ dailyTaskItemId: "task-item-1", itemType: "audio_meaning", status: "pending", wordId: "word-99" }],
            strategyVersion: "default",
            summary: { estimatedMinutes: 1 },
          });
        }
        if (url.includes("/word-library/words")) return json({ items: [] });
        if (url.includes("/learning/courses")) return json({ items: [] });
        if (url.includes("/learning/sentences")) return json({ items: [] });
        if (url.includes("/learning/assessment/active")) return json({ assessmentConfigId: null, selfDescriptionQuestions: [] });
        return json({ items: [] });
      }),
    );

    render(<App />);

    expect(await screen.findByText("anchor")).toBeInTheDocument();
    expect(screen.getByText("a point that keeps something in place")).toBeInTheDocument();
    expect(screen.queryByText(/缺少词条详情/)).not.toBeInTheDocument();
    expect(fetch).toHaveBeenCalledWith(expect.stringMatching(/\/learning\/vocabulary\/words\?.*wordId=word-99/), expect.anything());
  });

  it("allows skipping a daily word task when the word has no meaning", async () => {
    window.localStorage.setItem("learning-activation-user-session", JSON.stringify({ sessionId: "local-demo-user-test" }));
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes("/learning/practice/activation-attempts")) return json({ activationAttemptId: "attempt-1" });
        if (url.includes("/learning/vocabulary/words")) {
          return json({
            items: [
              {
                audioUrl: null,
                difficultyLevel: 2,
                meaningCn: null,
                phonetic: "/ˈæŋkər/",
                senses: [],
                word: "anchor",
                wordId: "word-99",
              },
            ],
          });
        }
        if (url.includes("/learning/vocabulary")) return json({ activationRate: 0, green: 0, red: 1, total: 1, yellow: 0 });
        if (url.includes("/learning/daily-task")) {
          return json({
            dailyTaskId: "task-1",
            items: [{ dailyTaskItemId: "task-item-1", itemType: "audio_meaning", status: "pending", wordId: "word-99" }],
            strategyVersion: "default",
            summary: { estimatedMinutes: 1 },
          });
        }
        if (url.includes("/word-library/words")) return json({ items: [] });
        if (url.includes("/learning/courses")) return json({ items: [] });
        if (url.includes("/learning/sentences")) return json({ items: [] });
        if (url.includes("/learning/assessment/active")) return json({ assessmentConfigId: null, selfDescriptionQuestions: [] });
        return json({ items: [] });
      }),
    );

    render(<App />);

    expect(await screen.findByText(/该词缺少释义/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "跳过该任务" }));

    await waitFor(() => expect(fetch).toHaveBeenCalledWith(expect.stringContaining("/learning/practice/activation-attempts"), expect.anything()));
    const activationCall = vi.mocked(fetch).mock.calls.find(([input]) => String(input).includes("/learning/practice/activation-attempts"));
    expect(JSON.parse(String(activationCall?.[1]?.body))).toMatchObject({ correctAnswer: null, isCorrect: false, selectedAnswer: null, wordId: "word-99" });
  });

  it("loads continue-learning batches after daily tasks are completed", async () => {
    window.localStorage.setItem("learning-activation-user-session", JSON.stringify({ sessionId: "local-demo-user-test" }));
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes("/learning/practice/activation-attempts")) return json({ activationAttemptId: "attempt-continue" });
        if (url.includes("/learning/continue-learning")) {
          return json({
            emptyReasons: [],
            hasMore: true,
            items: [
              {
                audioUrl: "https://example.com/continue.mp3",
                difficultyLevel: 2,
                meaningCn: "继续",
                phonetic: "/kənˈtɪnjuː/",
                practiceType: "audio_meaning",
                prioritySource: "red_activation",
                senses: [{
                  antonyms: [],
                  definition: "to keep going",
                  definitionIndex: 0,
                  example: null,
                  partOfSpeech: "verb",
                  rawDefinition: {},
                  senseIndex: 0,
                  source: "dictionaryapi",
                  synonyms: [],
                  wordId: "word-continue",
                  wordMetaId: null,
                  wordSenseId: "sense-continue",
                }],
                word: "continue",
                wordId: "word-continue",
              },
            ],
            limit: 6,
          });
        }
        if (url.includes("/learning/vocabulary")) return json({ activationRate: 0.4, green: 1, red: 1, total: 2, yellow: 0 });
        if (url.includes("/learning/daily-task")) {
          return json({
            dailyTaskId: "task-1",
            items: [{ dailyTaskItemId: "task-item-1", itemType: "audio_meaning", status: "completed", wordId: "word-done" }],
            strategyVersion: "default",
            summary: { estimatedMinutes: 1 },
          });
        }
        if (url.includes("/word-library/words")) return json({ items: [] });
        if (url.includes("/learning/courses")) return json({ items: [] });
        if (url.includes("/learning/sentences")) return json({ items: [] });
        if (url.includes("/learning/assessment/active")) return json({ assessmentConfigId: null, selfDescriptionQuestions: [] });
        return json({ items: [] });
      }),
    );

    render(<App />);

    expect(await screen.findByRole("button", { name: "继续学习" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "继续学习" }));

    expect(await screen.findByText("continue")).toBeInTheDocument();
    expect(screen.getByText("待激活词")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "继续" }));

    await waitFor(() => expect(fetch).toHaveBeenCalledWith(expect.stringContaining("/learning/practice/activation-attempts"), expect.anything()));
    const activationCall = vi.mocked(fetch).mock.calls.find(([input]) => String(input).includes("/learning/practice/activation-attempts"));
    expect(JSON.parse(String(activationCall?.[1]?.body))).toMatchObject({
      practiceType: "audio_meaning",
      result: { prioritySource: "red_activation", source: "continue_learning" },
      wordId: "word-continue",
    });
  });

  it("supports content admin creation and audit visibility", async () => {
    seedSuperAdminSession();
    window.location.hash = "#/admin/overview";

    render(<App />);

    expect(await screen.findByText("最近审计")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /场景 \/ 课程/ }));
    await userEvent.click(await screen.findByRole("button", { name: "新建" }));

    expect(await screen.findByRole("heading", { name: "新建场景" })).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText("场景名称"), "新建场景");
    await userEvent.click(screen.getByRole("button", { name: "保存" }));
    await waitFor(() => expect(screen.queryByRole("heading", { name: "新建场景" })).not.toBeInTheDocument());

    await userEvent.click(screen.getByRole("button", { name: /内容概览/ }));
    expect((await screen.findAllByText(/新建场景/)).length).toBeGreaterThan(0);
  });

  it("filters and bulk assigns content admin sentences", async () => {
    seedSuperAdminSession();
    window.location.hash = "#/admin/sentences";

    render(<App />);

    expect(await screen.findByRole("button", { name: "We should set off before sunrise." })).toBeInTheDocument();

    await userEvent.click(screen.getByLabelText("分配状态"));
    await userEvent.click(screen.getByRole("option", { name: "未分配课程" }));

    expect(screen.getByRole("button", { name: "We should set off before sunrise." })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Could you walk me through the report?" })).not.toBeInTheDocument();
    expect(fetch).toHaveBeenCalledWith(expect.stringMatching(/\/admin\/content\/sentences\?.*limit=10/), expect.anything());
    expect(fetch).toHaveBeenCalledWith(expect.stringMatching(/\/admin\/content\/sentences\?.*assigned=false/), expect.anything());

    await userEvent.click(screen.getAllByRole("checkbox")[0] as HTMLElement);
    await userEvent.click(screen.getByRole("button", { name: "批量分配" }));

    expect(await screen.findByText(/成功 1，失败 0，跳过 0/)).toBeInTheDocument();
  });

  it("shows composition CRUD controls", async () => {
    seedSuperAdminSession();
    window.location.hash = "#/admin/composition";

    render(<App />);

    expect((await screen.findAllByText("课程编排")).length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: /课程编排/ })).not.toBeInTheDocument();
    expect(await screen.findByText("We should set off before sunrise.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "新建课程" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "编辑课程" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "归档课程" })).toBeInTheDocument();
    expect(screen.getByText("课程列表")).toBeInTheDocument();
    expect(screen.getAllByText("会议沟通基础").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "编排" })).toBeInTheDocument();
    expect(screen.getByLabelText("查询句子 / 目标词")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "添加" })).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledWith(expect.stringMatching(/\/admin\/content\/sentences\?.*assigned=false/), expect.anything());
    expect(fetch).not.toHaveBeenCalledWith(expect.stringMatching(/\/admin\/content\/sentences\?.*assigned=false.*sceneId=/), expect.anything());
    expect(screen.getAllByRole("button", { name: "编辑" }).length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "移除" })).toBeInTheDocument();
  });

  it("keeps learning shell usable when optional learning feeds fail", async () => {
    window.localStorage.setItem("learning-activation-user-session", JSON.stringify({ sessionId: "local-demo-user-test" }));
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes("/learning/courses")) return jsonStatus({ error: "internal_server_error", message: "Internal server error" }, 500);
        if (url.includes("/learning/sentences")) return jsonStatus({ error: "internal_server_error", message: "Internal server error" }, 500);
        if (url.includes("/learning/daily-task")) return jsonStatus({ error: "internal_server_error", message: "Internal server error" }, 500);
        if (url.includes("/learning/vocabulary")) return json({ activationRate: 0, green: 0, red: 10, total: 10, yellow: 0 });
        if (url.includes("/word-library/words")) return json({ items: [] });
        if (url.includes("/learning/assessment/active")) return json({ assessmentConfigId: null, selfDescriptionQuestions: [] });
        return json({ items: [] });
      }),
    );

    render(<App />);

    expect(await screen.findByRole("tab", { name: /今日任务/ })).toBeInTheDocument();
    expect(await screen.findByText(/课程列表接口暂不可用/)).toBeInTheDocument();
    expect(screen.getByText(/句子列表接口暂不可用/)).toBeInTheDocument();
    expect(screen.getByText(/今日任务接口暂不可用/)).toBeInTheDocument();
  });
});

function seedSuperAdminSession(): void {
  window.localStorage.setItem(
    "learning-activation-admin-session",
    JSON.stringify({
      adminRole: "super_admin",
      adminSessionId: "admin-session-test",
      adminUserId: "admin-test",
      displayName: "Super Admin",
      loginName: "admin",
      permissionKeys: ["content:admin"],
    }),
  );
}

function json(body: unknown): Response {
  return jsonStatus(body, 200);
}

function jsonStatus(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    status,
  });
}
