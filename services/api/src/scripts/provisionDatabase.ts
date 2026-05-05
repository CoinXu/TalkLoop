import fs from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import pg from "pg";
import { loadServiceEnv } from "../config/loadServiceEnv.js";

loadServiceEnv();

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
    await applyMigrationIfMissing(client, "learning_activation_schema_meta", "0001_learning_activation_v1.sql");
    await applyMigrationIfMissing(client, "admin_users", "0002_learning_activation_v1_admin_foundation.sql");
    await applyMigrationIfMissing(client, "word_entries", "0003_learning_activation_v1_word_library.sql");
    await applyMigrationIfMissing(client, "corpus_scenes", "0004_learning_activation_v1_runtime_modules.sql");
    await applyMigrationIfMissing(client, "subtlexus_words", "0005_subtlexus_source_words.sql");
    await applyMigrationIfMissing(client, "content_admin_settings", "0006_content_admin_console_v1.sql");
    await applyMigrationIfMissing(client, "word_meta", "0007_word_meta_dictionaryapi.sql");
    await applyMigrationIfMissing(client, "word_senses", "0008_word_senses_dictionaryapi.sql");
    await applyMigrationFileOnce(client, "0009_drop_word_entry_summary_meaning_fields.sql");
    await applyMigrationFileOnce(client, "0010_remove_dictionaryapi_summary_derived_fields.sql");
    await seedBootstrapAdminIfRequested(client);
  } finally {
    await client.end();
  }
}

async function applyMigrationFileOnce(client: pg.Client, migrationFileName: string): Promise<void> {
  await client.query(`
    CREATE TABLE IF NOT EXISTS local_migration_files (
      file_name text PRIMARY KEY,
      checksum text NOT NULL,
      applied_at timestamp NOT NULL DEFAULT now()
    )
  `);
  const migrationPath = path.resolve(process.cwd(), "../../migrations", migrationFileName);
  const sql = await fs.readFile(migrationPath, "utf8");
  const checksum = createHash("sha256").update(sql).digest("hex");
  const existing = await client.query("SELECT checksum FROM local_migration_files WHERE file_name = $1", [migrationFileName]);
  if ((existing.rowCount ?? 0) > 0) {
    console.log(`${migrationFileName} already applied; skipped`);
    return;
  }
  await client.query(sql);
  await client.query("INSERT INTO local_migration_files (file_name, checksum) VALUES ($1, $2)", [migrationFileName, checksum]);
  console.log(`applied ${migrationFileName}`);
}

async function applyMigrationIfMissing(client: pg.Client, tableName: string, migrationFileName: string): Promise<void> {
  const result = await client.query("SELECT to_regclass($1) AS table_name", [`public.${tableName}`]);
  if (result.rows[0]?.table_name === tableName) {
    console.log(`${migrationFileName} already applied; skipped`);
    return;
  }

  const migrationPath = path.resolve(process.cwd(), "../../migrations", migrationFileName);
  const sql = await fs.readFile(migrationPath, "utf8");
  await client.query(sql);
  console.log(`applied ${migrationFileName}`);
}

async function seedBootstrapAdminIfRequested(client: pg.Client): Promise<void> {
  const loginName = process.env.ADMIN_BOOTSTRAP_LOGIN;
  const password = process.env.ADMIN_BOOTSTRAP_PASSWORD;
  if (!loginName || !password) {
    console.log("ADMIN_BOOTSTRAP_LOGIN/PASSWORD not set; skipped bootstrap admin seed");
    return;
  }

  const existing = await client.query("SELECT 1 FROM admin_users WHERE login_name = $1", [loginName]);
  if ((existing.rowCount ?? 0) > 0) {
    console.log(`bootstrap admin ${loginName} already exists`);
    return;
  }

  const now = new Date();
  const id = BigInt(Date.now()) * 1000n;
  const passwordHash = createHash("sha256").update(password).digest("hex");
  await client.query(
    `
      INSERT INTO admin_users (id, login_name, password_hash, display_name, role, status, created_at, updated_at)
      VALUES ($1, $2, $3, $4, 'super_admin', 'enabled', $5, $5)
    `,
    [id.toString(), loginName, passwordHash, loginName, now],
  );
  console.log(`created bootstrap admin ${loginName}`);
}

await createDatabaseIfMissing();
await runMigration();
