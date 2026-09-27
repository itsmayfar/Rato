import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import { artistProfiles, userSettings, users } from "@/lib/db/schema";

export const hasDb = Boolean(process.env.TEST_DATABASE_URL);

export async function createUser(name = "Test Artist") {
  const email = `test-${randomUUID()}@example.test`;
  const [u] = await db.insert(users).values({ email, name, passwordHash: "x" }).returning({ id: users.id });
  await db.insert(userSettings).values({ userId: u.id });
  await db.insert(artistProfiles).values({ userId: u.id });
  return u.id;
}
