import { buildApp } from "../app.js";
import { AppConfig } from "../config/AppConfig.js";
import { Database } from "../infrastructure/database/Database.js";

const databaseUrl = process.env.DATABASE_URL ?? "postgres://postgres:postgres@192.168.12.195:5435/echo-english";

const config = AppConfig.fromEnv({
  ...process.env,
  DATABASE_URL: databaseUrl,
  NODE_ENV: "test",
});
const database = new Database(config.databaseUrl);
const app = await buildApp({ config, database });

try {
  const health = await app.inject({ method: "GET", url: "/health" });
  if (health.statusCode !== 200) {
    throw new Error(`health check failed: ${health.statusCode}`);
  }

  const login = await app.inject({
    method: "POST",
    url: "/auth/login",
    payload: {
      destination: `smoke-${Date.now()}@example.com`,
      otpCode: "123456",
    },
  });
  if (login.statusCode !== 200) {
    throw new Error(`login failed: ${login.statusCode} ${login.body}`);
  }
  const session = login.json<{ sessionId: string; userId: string }>();
  if (!session.sessionId || !session.userId) {
    throw new Error("login response missing ids");
  }

  const home = await app.inject({
    method: "GET",
    url: "/home",
    headers: {
      "x-session-id": session.sessionId,
    },
  });
  if (home.statusCode !== 200) {
    throw new Error(`home failed: ${home.statusCode} ${home.body}`);
  }

  console.log("smoke database test passed");
} finally {
  await app.close();
  await database.close();
}
