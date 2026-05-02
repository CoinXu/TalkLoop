export interface ImportedContentPreview {
  title: string;
  transcriptText: string;
  audioUrl?: string;
  publishedAt?: Date;
}

export interface ContentImportProvider {
  importFromUrl(sourceUrl: string): Promise<ImportedContentPreview>;
}
