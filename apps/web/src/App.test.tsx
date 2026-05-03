import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";

function mockFetch(): void {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/word-library/words")) return json({ items: [] });
      if (url.includes("/learning/courses")) return json({ items: [] });
      if (url.includes("/learning/sentences")) return json({ items: [] });
      if (url.includes("/learning/assessment/active")) return json({ assessmentConfigId: null, selfDescriptionQuestions: [] });
      return json({ items: [] });
    }),
  );
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
});

function json(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    status: 200,
  });
}
