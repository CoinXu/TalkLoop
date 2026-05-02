import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import type { FastifyInstance, FastifyReply } from "fastify";
import { AppError } from "../../domain/AppError.js";

const contentTypes = new Map([
  [".mp3", "audio/mpeg"],
  [".pdf", "application/pdf"],
  [".json", "application/json; charset=utf-8"],
]);

export class StaticAssetRoutes {
  constructor(private readonly importsRoot: string = path.resolve(process.cwd(), ".data/imports")) {}

  async register(app: FastifyInstance): Promise<void> {
    app.get("/static/imports/*", async (request, reply) => {
      const assetPath = this.resolveAssetPath((request.params as Record<string, string>)["*"] ?? "");
      const stat = await fsp.stat(assetPath).catch(() => undefined);
      if (!stat?.isFile()) {
        throw new AppError("not_found", "Static asset not found");
      }

      this.sendFile(reply, assetPath, stat.size, this.readRangeHeader(request.headers));
      return reply;
    });
  }

  private resolveAssetPath(rawPath: string): string {
    const relativePath = decodeURIComponent(rawPath);
    const assetPath = path.resolve(this.importsRoot, relativePath);
    const rootRelativePath = path.relative(this.importsRoot, assetPath);
    if (rootRelativePath.startsWith("..") || path.isAbsolute(rootRelativePath)) {
      throw new AppError("forbidden", "Static asset path is outside import root");
    }

    return assetPath;
  }

  private readRangeHeader(headers: { [key: string]: unknown }): string | undefined {
    const range = headers.range;
    if (Array.isArray(range)) {
      return range[0];
    }
    return typeof range === "string" ? range : undefined;
  }

  private sendFile(reply: FastifyReply, assetPath: string, size: number, rangeHeader?: string): void {
    const contentType = contentTypes.get(path.extname(assetPath).toLowerCase()) ?? "application/octet-stream";
    reply.header("content-type", contentType);
    reply.header("accept-ranges", "bytes");

    const range = this.parseRange(rangeHeader, size);
    if (!range) {
      reply.header("content-length", String(size));
      reply.send(fs.createReadStream(assetPath));
      return;
    }

    reply.status(206);
    reply.header("content-range", `bytes ${range.start}-${range.end}/${size}`);
    reply.header("content-length", String(range.end - range.start + 1));
    reply.send(fs.createReadStream(assetPath, range));
  }

  private parseRange(rangeHeader: string | undefined, size: number): { start: number; end: number } | undefined {
    const match = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader ?? "");
    if (!match) {
      return undefined;
    }

    const rawStart = match[1];
    const rawEnd = match[2];
    const start = rawStart ? Number(rawStart) : 0;
    const end = rawEnd ? Number(rawEnd) : size - 1;
    if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end < start || end >= size) {
      return undefined;
    }

    return { start, end };
  }
}
