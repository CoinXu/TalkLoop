import fs from "node:fs/promises";
import path from "node:path";
import pg from "pg";

const databaseName = process.env.PROVISION_DATABASE_NAME ?? "echo-english";
const host = process.env.PROVISION_DATABASE_HOST ?? "192.168.12.195";
const port = Number(process.env.PROVISION_DATABASE_PORT ?? "5435");
const user = process.env.PROVISION_DATABASE_USER ?? "postgres";
const password = process.env.PROVISION_DATABASE_PASSWORD ?? "postgres";

function quoteIdentifier(identifier: string): string {
  return `"${identifier.replaceAll('"', '""')}"`;
}

async function createDatabaseIfMissing(): Promise<void> {
  const client = new pg.Client({
    host,
    port,
    user,
    password,
    database: "postgres",
  });
  await client.connect();
  try {
    const result = await client.query("SELECT 1 FROM pg_database WHERE datname = $1", [databaseName]);
    if (result.rowCount === 0) {
      await client.query(`CREATE DATABASE ${quoteIdentifier(databaseName)}`);
      console.log(`created database ${databaseName}`);
      return;
    }
    console.log(`database ${databaseName} already exists`);
  } finally {
    await client.end();
  }
}

async function runMigration(): Promise<void> {
  const client = new pg.Client({
    host,
    port,
    user,
    password,
    database: databaseName,
  });
  await client.connect();
  try {
    const result = await client.query("SELECT to_regclass('public.users') AS users_table");
    if (result.rows[0]?.users_table === "users") {
      console.log("schema already exists; skipped migration");
      return;
    }

    const migrationPath = path.resolve(process.cwd(), "../../migrations/0001_listening_speaking_v1.sql");
    const sql = await fs.readFile(migrationPath, "utf8");
    await client.query(sql);
    console.log("applied migration 0001_listening_speaking_v1.sql");
  } finally {
    await client.end();
  }
}

await createDatabaseIfMissing();
await runMigration();
