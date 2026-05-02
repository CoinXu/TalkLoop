import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema.js";

export type AppDatabase = NodePgDatabase<typeof schema>;

export class Database {
  private readonly pool: pg.Pool;
  private readonly database: AppDatabase;

  constructor(databaseUrl: string) {
    this.pool = new pg.Pool({ connectionString: databaseUrl });
    this.database = drizzle(this.pool, { schema });
  }

  get db(): AppDatabase {
    return this.database;
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}
