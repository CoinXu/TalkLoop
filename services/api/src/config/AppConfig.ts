import { z } from "zod";

const configSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  HOST: z.string().default("0.0.0.0"),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url().default("redis://localhost:6379"),
  LOGIN_METHOD: z.enum(["email_otp", "phone_otp"]).default("email_otp"),
  OBJECT_STORAGE_PUBLIC_BASE_URL: z.string().url().default("http://localhost:9000/bbc-learning-english"),
  STATIC_ASSET_PUBLIC_BASE_URL: z.string().url().default("http://127.0.0.1:3000"),
  TRANSCRIPT_SYNC_PROVIDER: z.enum(["basic", "faster_whisper"]).default("basic"),
  WHISPER_BASE_URL: z.string().url().default("http://127.0.0.1:9001"),
  SPEAKING_SCORE_PROVIDER: z.enum(["mock", "faster_whisper"]).default("faster_whisper"),
});

export type AppConfigValues = z.infer<typeof configSchema>;

export class AppConfig {
  private constructor(private readonly values: AppConfigValues) {}

  static fromEnv(env: NodeJS.ProcessEnv): AppConfig {
    return new AppConfig(configSchema.parse(env));
  }

  get nodeEnv(): AppConfigValues["NODE_ENV"] {
    return this.values.NODE_ENV;
  }

  get host(): string {
    return this.values.HOST;
  }

  get port(): number {
    return this.values.PORT;
  }

  get databaseUrl(): string {
    return this.values.DATABASE_URL;
  }

  get redisUrl(): string {
    return this.values.REDIS_URL;
  }

  get loginMethod(): AppConfigValues["LOGIN_METHOD"] {
    return this.values.LOGIN_METHOD;
  }

  get objectStoragePublicBaseUrl(): string {
    return this.values.OBJECT_STORAGE_PUBLIC_BASE_URL;
  }

  get staticAssetPublicBaseUrl(): string {
    return this.values.STATIC_ASSET_PUBLIC_BASE_URL;
  }

  get transcriptSyncProvider(): AppConfigValues["TRANSCRIPT_SYNC_PROVIDER"] {
    return this.values.TRANSCRIPT_SYNC_PROVIDER;
  }

  get whisperBaseUrl(): string {
    return this.values.WHISPER_BASE_URL;
  }

  get speakingScoreProvider(): AppConfigValues["SPEAKING_SCORE_PROVIDER"] {
    return this.values.SPEAKING_SCORE_PROVIDER;
  }
}
