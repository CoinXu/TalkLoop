import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const serviceRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

function parseEnvFile(filePath: string): Record<string, string> {
  if (!existsSync(filePath)) {
    return {};
  }

  const values: Record<string, string> = {};
  const content = readFileSync(filePath, "utf8");

  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const match = /^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(trimmed);
    if (!match) {
      continue;
    }

    const key = match[1];
    const rawValue = match[2];
    if (key === undefined || rawValue === undefined) {
      continue;
    }

    values[key] = normalizeEnvValue(rawValue);
  }

  return values;
}

function normalizeEnvValue(value: string): string {
  const trimmed = value.trim();
  const quote = trimmed[0];
  if ((quote === "\"" || quote === "'") && trimmed.endsWith(quote)) {
    return trimmed.slice(1, -1);
  }

  const commentStart = trimmed.indexOf(" #");
  return commentStart === -1 ? trimmed : trimmed.slice(0, commentStart).trimEnd();
}

export function loadServiceEnv(env: NodeJS.ProcessEnv = process.env): void {
  const fileValues = Object.assign(
    {},
    parseEnvFile(resolve(serviceRoot, ".env.example")),
    parseEnvFile(resolve(serviceRoot, ".env")),
    parseEnvFile(resolve(serviceRoot, ".env.local")),
  );

  for (const [key, value] of Object.entries(fileValues)) {
    if (env[key] === undefined) {
      env[key] = value;
    }
  }
}
