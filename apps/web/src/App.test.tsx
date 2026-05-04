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
      sceneId: "1001",
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
      meanings: [{ definitions: [{ definition: "to guide someone through a process", example: "I can walk you through the setup.", synonyms: ["guide"], antonyms: ["confuse"] }], partOfSpeech: "verb", synonyms: ["lead"], antonyms: [] }],
      normalizedWord: "walk",
      phonetics: [{ audio: "https://example.com/walk.mp3", text: "/wɔːk/" }],
      rawPayload: [{
        license: { name: "CC BY-SA 3.0", url: "https://creativecommons.org/licenses/by-sa/3.0" },
        meanings: [{ definitions: [{ definition: "to guide someone through a process", example: "I can walk you through the setup.", synonyms: ["guide"], antonyms: ["confuse"] }], partOfSpeech: "verb", synonyms: ["lead"], antonyms: [] }],
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
        const limit = Number(params.get("limit") ?? 10);
        const offset = Number(params.get("offset") ?? 0);
        const filtered = contentSentences.filter((sentence) => {
          if (assigned === "true") return Boolean(sentence.courseId);
          if (assigned === "false") return !sentence.courseId;
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
    expect(screen.getByText(/I can walk you through the setup/)).toBeInTheDocument();
    expect(screen.getByText("guide")).toBeInTheDocument();
    expect(screen.getByText("confuse")).toBeInTheDocument();
    expect(screen.getAllByLabelText("发音播放器").length).toBeGreaterThan(0);
    expect(fetch).toHaveBeenCalledWith(expect.stringMatching(/\/word-library\/word-meta\?.*keyword=walk/), expect.anything());
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
    expect(await screen.findByText("We should set off before sunrise.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "新建课程" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "编辑课程" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "归档课程" })).toBeInTheDocument();
    expect(screen.getByLabelText("查询课程")).toBeInTheDocument();
    expect(screen.getByLabelText("查询句子 / 目标词")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "添加" })).toBeInTheDocument();
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
