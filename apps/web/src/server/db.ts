import { createDb } from "@moltbot/db";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set");
}

export const db = createDb(process.env.DATABASE_URL);
