import "dotenv/config";
import { eq } from "drizzle-orm";

/** Usage: npm run demo:seed -- user@example.com   |   npm run demo:remove -- user@example.com */
async function main() {
  const [mode, email] = process.argv.slice(2);
  if (!email || !["seed", "remove"].includes(mode)) throw new Error("Usage: demo.ts <seed|remove> <user email>");
  const { db } = await import("../src/lib/db");
  const { users } = await import("../src/lib/db/schema");
  const { seedDemoData, removeDemoData } = await import("../src/lib/demo");
  const [user] = await db.select().from(users).where(eq(users.email, email.toLowerCase()));
  if (!user) throw new Error(`No user with email ${email}`);
  if (mode === "seed") console.log((await seedDemoData(user.id)) ? "Demo data created." : "Demo data already present.");
  else console.log(`Removed ${await removeDemoData(user.id)} demo records.`);
  process.exit(0);
}
main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
