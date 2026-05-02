import { describe, expect, it } from "vitest";
import { MockObjectStorageProvider } from "./MockObjectStorageProvider.js";

describe("MockObjectStorageProvider", () => {
  it("builds a recording URL without relying on global crypto", async () => {
    const provider = new MockObjectStorageProvider("http://storage.local");

    const url = await provider.storeRecording({
      userId: 1001n,
      unitId: 2001n,
      mimeType: "audio/webm",
      buffer: Buffer.from("audio"),
    });

    expect(url).toMatch(/^http:\/\/storage\.local\/recordings\/1001\/2001\/[0-9a-f-]+\.webm$/);
  });
});
