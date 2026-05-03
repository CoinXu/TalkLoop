import pg from "pg";
import { loadServiceEnv } from "../config/loadServiceEnv.js";

loadServiceEnv();

const allowReset = process.env.LEARNING_ACTIVATION_ALLOW_LOCAL_RESET === "1";
const nodeEnv = process.env.NODE_ENV ?? "development";
const databaseUrl = process.env.DATABASE_URL;

if (!allowReset) {
  throw new Error("Refusing to reset database without LEARNING_ACTIVATION_ALLOW_LOCAL_RESET=1");
}

if (nodeEnv === "production") {
  throw new Error("Refusing to reset database when NODE_ENV=production");
}

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required");
}

const client = new pg.Client({ connectionString: databaseUrl });
await client.connect();

try {
  await client.query("DROP SCHEMA public CASCADE");
  await client.query("CREATE SCHEMA public");
  await client.query("GRANT ALL ON SCHEMA public TO public");
  console.log("local database schema reset complete");
} finally {
  await client.end();
}
