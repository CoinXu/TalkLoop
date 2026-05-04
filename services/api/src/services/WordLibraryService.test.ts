import { describe, expect, it } from "vitest";
import { buildDictionaryApiMetaInput } from "./WordLibraryService.js";

describe("DictionaryAPI word metadata", () => {
  it("derives word entry fields and preserves raw metadata", () => {
    const row = {
      status: "ok",
      word: "the",
      lemma: "the",
      dictionaryApi: [
        {
          word: "the",
          phonetic: "/ði/",
          phonetics: [
            { text: "/ði/", audio: "" },
            { text: "/ði/", audio: "https://api.dictionaryapi.dev/media/pronunciations/en/the-us.mp3" },
          ],
          meanings: [
            {
              partOfSpeech: "adverb",
              definitions: [
                { definition: "Used with a comparative to establish correlation." },
                { definition: "Used with a comparative to indicate a result." },
              ],
            },
          ],
          license: { name: "CC BY-SA 3.0", url: "https://creativecommons.org/licenses/by-sa/3.0" },
          sourceUrls: ["https://en.wiktionary.org/wiki/the"],
        },
      ],
      source: {
        apiUrl: "https://api.dictionaryapi.dev/api/v2/entries/en/the",
      },
    };

    const meta = buildDictionaryApiMetaInput(row, "batch-1");

    expect(meta).toMatchObject({
      importBatchId: "batch-1",
      licenseName: "CC BY-SA 3.0",
      normalizedWord: "the",
      source: "dictionaryapi",
      sourceUrl: "https://api.dictionaryapi.dev/api/v2/entries/en/the",
      word: "the",
    });
    expect(meta?.derivedFields).toEqual({
      audioStatus: "ready",
      audioUrl: "https://api.dictionaryapi.dev/media/pronunciations/en/the-us.mp3",
      lemma: "the",
      meaningEn: "Used with a comparative to establish correlation.\nUsed with a comparative to indicate a result.",
      partOfSpeech: "adverb",
      phonetic: "/ði/",
      word: "the",
    });
    expect(meta?.rawPayload).toBe(row);
    expect(meta?.phonetics).toHaveLength(2);
    expect(meta?.meanings).toHaveLength(1);
  });

  it("skips failed rows", () => {
    expect(buildDictionaryApiMetaInput({ status: "not_found", word: "missing" }, "batch-1")).toBeUndefined();
  });
});
