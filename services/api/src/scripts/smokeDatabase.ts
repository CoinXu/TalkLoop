import { buildApp } from "../app.js";
import { AppConfig } from "../config/AppConfig.js";
import { loadServiceEnv } from "../config/loadServiceEnv.js";
import { Database } from "../infrastructure/database/Database.js";
import fs from "node:fs/promises";
import path from "node:path";

loadServiceEnv();

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

  const openapi = await app.inject({ method: "GET", url: "/openapi/json" });
  if (openapi.statusCode !== 200) {
    throw new Error(`openapi failed: ${openapi.statusCode}`);
  }

  const unauthenticatedAdmin = await app.inject({ method: "GET", url: "/admin/auth/me" });
  if (unauthenticatedAdmin.statusCode !== 401) {
    throw new Error(`admin auth guard failed: ${unauthenticatedAdmin.statusCode} ${unauthenticatedAdmin.body}`);
  }

  if (process.env.ADMIN_BOOTSTRAP_LOGIN && process.env.ADMIN_BOOTSTRAP_PASSWORD) {
    const login = await app.inject({
      method: "POST",
      url: "/admin/auth/login",
      payload: {
        loginName: process.env.ADMIN_BOOTSTRAP_LOGIN,
        password: process.env.ADMIN_BOOTSTRAP_PASSWORD,
      },
    });
    if (login.statusCode !== 200) {
      throw new Error(`admin login failed: ${login.statusCode} ${login.body}`);
    }

    const session = login.json<{ adminSessionId: string }>();
    const me = await app.inject({
      method: "GET",
      url: "/admin/auth/me",
      headers: { "x-admin-session-id": session.adminSessionId },
    });
    if (me.statusCode !== 200) {
      throw new Error(`admin me failed: ${me.statusCode} ${me.body}`);
    }

    const adminWords = await app.inject({
      method: "GET",
      url: "/admin/word-library/words",
      headers: { "x-admin-session-id": session.adminSessionId },
    });
    if (adminWords.statusCode !== 200) {
      throw new Error(`admin word library failed: ${adminWords.statusCode} ${adminWords.body}`);
    }

    const subtlexPath = path.resolve(process.cwd(), "../vocabulary/resource/SUBTLEXusfrequencyabove1.xls");
    const subtlexBuffer = await fs.readFile(subtlexPath);
    const boundary = "----learning-activation-smoke";
    const multipartPayload = Buffer.concat([
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="SUBTLEXusfrequencyabove1.xls"\r\nContent-Type: application/vnd.ms-excel\r\n\r\n`),
      subtlexBuffer,
      Buffer.from(`\r\n--${boundary}--\r\n`),
    ]);
    const subtlexDryRun = await app.inject({
      method: "POST",
      url: "/admin/word-library/imports/subtlexus?dryRun=true&limit=5",
      headers: {
        "content-type": `multipart/form-data; boundary=${boundary}`,
        "x-admin-session-id": session.adminSessionId,
      },
      payload: multipartPayload,
    });
    if (subtlexDryRun.statusCode !== 200) {
      throw new Error(`admin SUBTLEXus import dry run failed: ${subtlexDryRun.statusCode} ${subtlexDryRun.body}`);
    }

    const adminCorpus = await app.inject({
      method: "GET",
      url: "/admin/corpus/courses",
      headers: { "x-admin-session-id": session.adminSessionId },
    });
    if (adminCorpus.statusCode !== 200) {
      throw new Error(`admin corpus failed: ${adminCorpus.statusCode} ${adminCorpus.body}`);
    }

    const adminAnnotations = await app.inject({
      method: "GET",
      url: "/admin/annotations/tasks",
      headers: { "x-admin-session-id": session.adminSessionId },
    });
    if (adminAnnotations.statusCode !== 200) {
      throw new Error(`admin annotations failed: ${adminAnnotations.statusCode} ${adminAnnotations.body}`);
    }

    const adminAssessment = await app.inject({
      method: "GET",
      url: "/admin/assessment/configs",
      headers: { "x-admin-session-id": session.adminSessionId },
    });
    if (adminAssessment.statusCode !== 200) {
      throw new Error(`admin assessment failed: ${adminAssessment.statusCode} ${adminAssessment.body}`);
    }

    const adminPractice = await app.inject({
      method: "GET",
      url: "/admin/practice/rules",
      headers: { "x-admin-session-id": session.adminSessionId },
    });
    if (adminPractice.statusCode !== 200) {
      throw new Error(`admin practice failed: ${adminPractice.statusCode} ${adminPractice.body}`);
    }

    const adminTasks = await app.inject({
      method: "GET",
      url: "/admin/daily-tasks/strategies",
      headers: { "x-admin-session-id": session.adminSessionId },
    });
    if (adminTasks.statusCode !== 200) {
      throw new Error(`admin daily task strategy failed: ${adminTasks.statusCode} ${adminTasks.body}`);
    }

    const adminListenRepeat = await app.inject({
      method: "GET",
      url: "/admin/listen-repeat/attempts",
      headers: { "x-admin-session-id": session.adminSessionId },
    });
    if (adminListenRepeat.statusCode !== 200) {
      throw new Error(`admin listen-repeat failed: ${adminListenRepeat.statusCode} ${adminListenRepeat.body}`);
    }

    const adminReports = await app.inject({
      method: "GET",
      url: "/admin/course-reports",
      headers: { "x-admin-session-id": session.adminSessionId },
    });
    if (adminReports.statusCode !== 200) {
      throw new Error(`admin course reports failed: ${adminReports.statusCode} ${adminReports.body}`);
    }
  }

  const publicWords = await app.inject({ method: "GET", url: "/word-library/words" });
  if (publicWords.statusCode !== 200) {
    throw new Error(`public word library failed: ${publicWords.statusCode} ${publicWords.body}`);
  }

  const publicCourses = await app.inject({ method: "GET", url: "/learning/courses", headers: { "x-session-id": "smoke-user" } });
  if (publicCourses.statusCode !== 200) {
    throw new Error(`public courses failed: ${publicCourses.statusCode} ${publicCourses.body}`);
  }

  const dailyTask = await app.inject({ method: "GET", url: "/learning/daily-task?taskDate=2026-05-03", headers: { "x-session-id": "smoke-user" } });
  if (dailyTask.statusCode !== 200) {
    throw new Error(`daily task failed: ${dailyTask.statusCode} ${dailyTask.body}`);
  }

  console.log("learning activation v1 smoke test passed");
} finally {
  await app.close();
  await database.close();
}
