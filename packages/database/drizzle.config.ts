import type { Config } from "drizzle-kit";

export default {
  schema: "./src/schema/core.ts",
  out: "./src/migrations",
  dialect: "postgresql",
  dbCredentials: {
    host: process.env.DB_HOST || "localhost",
    port: parseInt(process.env.DB_PORT || "5432"),
    database: process.env.DB_NAME || "alharistech",
    user: process.env.DB_USER || "postgres",
    password: process.env.DB_PASSWORD || "postgres",
  },
} satisfies Config;
