import { describe, expect, it } from "vitest";
import { AppError } from "../domain/AppError.js";
import { ContentService } from "./ContentService.js";

describe("ContentService", () => {
  it("requires sourceUrl for imported content", async () => {
    const service = new ContentService({} as never, {} as never, {} as never);

    await expect(
      service.createDraft({
        title: "Unit",
        expression: "same page",
        expressionMeaning: "意见一致",
        difficulty: "intermediate",
        sceneTags: [],
        estimatedMinutes: 5,
        sourceType: "bbc_url_import",
      }),
    ).rejects.toBeInstanceOf(AppError);
  });

  it("creates BBC imports as internal review drafts", async () => {
    const createdInputs: unknown[] = [];
    const service = new ContentService(
      {
        async createImportJob() {
          return 7001n;
        },
        async createDraft(input: unknown) {
          createdInputs.push(input);
          return 3001n;
        },
        async completeImportJob() {},
      } as never,
      {
        async importFromUrl() {
          return { title: "BBC draft", transcriptText: "hello" };
        },
      } as never,
      {} as never,
    );

    const result = await service.importBbcUrl("https://www.bbc.co.uk/learningenglish/example");

    expect(result).toEqual({ jobId: "7001", unitId: "3001" });
    expect(createdInputs[0]).toMatchObject({
      sourceType: "bbc_url_import",
      licenseStatus: "internal_review",
    });
  });
});
