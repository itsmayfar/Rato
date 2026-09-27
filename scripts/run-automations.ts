import "dotenv/config";

/** Run due automations for every user (use from cron if you don't call the HTTP endpoint). */
async function main() {
  const { db } = await import("../src/lib/db");
  const { users } = await import("../src/lib/db/schema");
  const { runAutomations } = await import("../src/lib/automations/engine");
  for (const u of await db.select({ id: users.id, email: users.email }).from(users)) {
    const results = await runAutomations(u.id);
    console.log(`${u.email}: ${results.length} rule(s) ran, ${results.filter((r) => r.result === "error").length} error(s)`);
  }
  process.exit(0);
}
main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
