import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "staging", "production"])
    .default("development"),
  PORT: z.coerce.number().default(4000),

  DB_HOST: z.string().default("localhost"),
  DB_PORT: z.coerce.number().default(5432),
  DB_NAME: z.string().default("alharistech"),
  DB_USER: z.string().default("postgres"),
  DB_PASSWORD: z.string().default("postgres"),

  REDIS_HOST: z.string().default("localhost"),
  REDIS_PORT: z.coerce.number().default(6379),
  REDIS_PASSWORD: z.string().optional(),

  JWT_SECRET: z.string().default("dev-secret-change-in-production"),
  JWT_REFRESH_SECRET: z
    .string()
    .default("dev-refresh-secret-change-in-production"),
  JWT_EXPIRES_IN: z.string().default("15m"),
  JWT_REFRESH_EXPIRES_IN: z.string().default("7d"),

  CORS_ORIGIN: z.string().default("http://localhost:3000"),
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(): Env {
  return envSchema.parse(process.env);
}
