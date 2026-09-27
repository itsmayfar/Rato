import "server-only";
import { db } from "./db";
import { auditLogs } from "./db/schema";

/** Record an important action. Never pass secrets or passwords in `details`. */
export async function audit(
  userId: string,
  action: string,
  entityType: string,
  entityId: string | null,
  summary?: string,
  details?: Record<string, unknown>,
) {
  try {
    await db.insert(auditLogs).values({ userId, action, entityType, entityId, summary, details });
  } catch (err) {
    console.error("audit log failed", (err as Error).message);
  }
}
