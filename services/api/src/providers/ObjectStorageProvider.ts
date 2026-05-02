import type { EntityId } from "../domain/EntityId.js";

export interface StoreRecordingInput {
  userId: EntityId;
  unitId: EntityId;
  mimeType: string;
  buffer: Buffer;
}

export interface ObjectStorageProvider {
  storeRecording(input: StoreRecordingInput): Promise<string>;
}
