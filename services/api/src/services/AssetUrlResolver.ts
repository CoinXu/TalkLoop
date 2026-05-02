import path from "node:path";
import { fileURLToPath } from "node:url";

export class AssetUrlResolver {
  constructor(
    private readonly publicBaseUrl: string = process.env.STATIC_ASSET_PUBLIC_BASE_URL ?? "http://127.0.0.1:3000",
    private readonly importsRoot: string = path.resolve(process.cwd(), ".data/imports"),
  ) {}

  toPublicUrl(assetUrl: string): string {
    if (!assetUrl.startsWith("file://")) {
      return assetUrl;
    }

    const assetPath = path.resolve(fileURLToPath(assetUrl));
    const relativePath = path.relative(this.importsRoot, assetPath);
    if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
      return assetUrl;
    }

    const encodedPath = relativePath
      .split(path.sep)
      .map((part) => encodeURIComponent(part))
      .join("/");
    return `${this.publicBaseUrl.replace(/\/$/, "")}/static/imports/${encodedPath}`;
  }
}
