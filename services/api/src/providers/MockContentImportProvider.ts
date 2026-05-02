import { AppError } from "../domain/AppError.js";
import type { ContentImportProvider, ImportedContentPreview } from "./ContentImportProvider.js";

export class MockContentImportProvider implements ContentImportProvider {
  async importFromUrl(sourceUrl: string): Promise<ImportedContentPreview> {
    if (!sourceUrl.includes("bbc")) {
      throw new AppError("bad_request", "Only BBC URL import is supported in V1 mock provider");
    }

    return {
      title: "Imported BBC draft",
      transcriptText: "Mock transcript preview. Operators must review and edit before publishing.",
    };
  }
}
