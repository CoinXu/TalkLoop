import { randomUUID } from "node:crypto";
import type { ObjectStorageProvider, StoreRecordingInput } from "./ObjectStorageProvider.js";

export class MockObjectStorageProvider implements ObjectStorageProvider {
  constructor(private readonly publicBaseUrl: string) {}

  async storeRecording(input: StoreRecordingInput): Promise<string> {
    const extension = input.mimeType.includes("webm") ? "webm" : "wav";
    return `${this.publicBaseUrl}/recordings/${input.userId}/${input.unitId}/${randomUUID()}.${extension}`;
  }
}
