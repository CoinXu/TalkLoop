import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/infrastructure/database/schema.ts",
  out: "../../migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "postgres://postgres:postgres@localhost:5432/bbc_learning_english",
  },
  strict: true,
  verbose: true,
});
