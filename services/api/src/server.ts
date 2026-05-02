import { buildApp } from "./app.js";
import { AppConfig } from "./config/AppConfig.js";
import { loadServiceEnv } from "./config/loadServiceEnv.js";
import { Database } from "./infrastructure/database/Database.js";

loadServiceEnv();

const config = AppConfig.fromEnv(process.env);
const database = new Database(config.databaseUrl);
const app = await buildApp({ config, database });

try {
  await app.listen({ host: config.host, port: config.port });
} catch (error) {
  app.log.error({ error }, "failed to start api");
  await database.close();
  process.exit(1);
}

process.on("SIGTERM", async () => {
  await app.close();
  await database.close();
});
