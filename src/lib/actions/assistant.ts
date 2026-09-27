"use server";

import { revalidatePath } from "next/cache";
import { and, asc, eq } from "drizzle-orm";
import { requireUser } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { fail, ok, type ActionState } from "@/lib/action-state";
import { applyProposal } from "@/lib/ai/apply";
import { describeAiError, recordUsage, runAssistant } from "@/lib/ai/assistant";
import { aiConfig } from "@/lib/ai/config";
import { offlineAnswer } from "@/lib/ai/offline";
import { loadContextUncached } from "@/lib/context";
import { db } from "@/lib/db";
import { aiConversations, aiMessages, aiProposedActions, aiUsage } from "@/lib/db/schema";
import { todayISO } from "@/lib/utils";

export async function sendAssistantMessage(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser();
  const text = String(form.get("message") ?? "").trim();
  if (!text) return fail("Write a message first.");
  if (text.length > 8000) return fail("Messages are limited to 8,000 characters.");
  let conversationId = String(form.get("conversationId") ?? "");
  if (conversationId) {
    const [c] = await db.select().from(aiConversations).where(and(eq(aiConversations.id, conversationId), eq(aiConversations.userId, user.id)));
    if (!c) return fail("Conversation not found.");
  } else {
    const [c] = await db.insert(aiConversations).values({ userId: user.id, title: text.slice(0, 80) }).returning({ id: aiConversations.id });
    conversationId = c.id;
  }
  await db.insert(aiMessages).values({ userId: user.id, conversationId, role: "user", content: text });

  const cfg = aiConfig();
  const ctx = await loadContextUncached(user.id);
  const day = todayISO(ctx.settings.timezone);

  if (!cfg.configured) {
    await db.insert(aiMessages).values({ userId: user.id, conversationId, role: "assistant", content: offlineAnswer(ctx, text), mode: "offline" });
    await db.update(aiConversations).set({ updatedAt: new Date() }).where(eq(aiConversations.id, conversationId));
    revalidatePath("/assistant");
    return ok(undefined, { conversationId });
  }

  const [usage] = await db.select().from(aiUsage).where(and(eq(aiUsage.userId, user.id), eq(aiUsage.day, day)));
  if (usage && usage.requests >= cfg.dailyLimit) {
    await db.insert(aiMessages).values({ userId: user.id, conversationId, role: "assistant", content: `The daily assistant limit (${cfg.dailyLimit} requests) has been reached. Standard workflows keep working; the limit resets tomorrow.`, mode: "offline" });
    revalidatePath("/assistant");
    return ok(undefined, { conversationId });
  }

  const history = await db.select({ role: aiMessages.role, content: aiMessages.content }).from(aiMessages).where(eq(aiMessages.conversationId, conversationId)).orderBy(asc(aiMessages.createdAt));
  try {
    const result = await runAssistant(user.id, conversationId, history.slice(-30) as { role: "user" | "assistant"; content: string }[]);
    const [msg] = await db
      .insert(aiMessages)
      .values({ userId: user.id, conversationId, role: "assistant", content: result.text, toolLog: result.toolLog, mode: "ai", inputTokens: result.inputTokens, outputTokens: result.outputTokens })
      .returning({ id: aiMessages.id });
    // attach proposals created during this turn to the message
    await db.update(aiProposedActions).set({ messageId: msg.id }).where(and(eq(aiProposedActions.conversationId, conversationId), eq(aiProposedActions.status, "pending")));
    await recordUsage(user.id, day, result.inputTokens, result.outputTokens);
  } catch (err) {
    console.error("assistant error", (err as Error).message);
    await recordUsage(user.id, day, 0, 0, true);
    await db.insert(aiMessages).values({ userId: user.id, conversationId, role: "assistant", content: `⚠ ${describeAiError(err)}`, mode: "offline" });
  }
  await db.update(aiConversations).set({ updatedAt: new Date() }).where(eq(aiConversations.id, conversationId));
  revalidatePath("/assistant");
  return ok(undefined, { conversationId });
}

export async function decideProposal(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser();
  const id = String(form.get("id") ?? "");
  const decision = String(form.get("decision") ?? "");
  const [p] = await db.select().from(aiProposedActions).where(and(eq(aiProposedActions.id, id), eq(aiProposedActions.userId, user.id)));
  if (!p) return fail("Proposal not found.");
  if (p.status !== "pending") return fail("This proposal was already decided.");
  if (decision === "reject") {
    await db.update(aiProposedActions).set({ status: "rejected", decidedAt: new Date() }).where(eq(aiProposedActions.id, id));
    revalidatePath("/assistant");
    return ok("Rejected. Nothing was changed.");
  }
  if (decision !== "approve") return fail("Invalid decision.");
  try {
    const note = await applyProposal(user.id, id, p.kind, p.payload);
    await db.update(aiProposedActions).set({ status: "approved", decidedAt: new Date(), resultNote: note }).where(eq(aiProposedActions.id, id));
    await audit(user.id, "assistant.approve", "ai_proposal", id, `${p.kind}: ${p.summary}`);
    revalidatePath("/", "layout");
    return ok(note.split("|")[0]);
  } catch (err) {
    await db.update(aiProposedActions).set({ status: "failed", decidedAt: new Date(), resultNote: (err as Error).message.slice(0, 300) }).where(eq(aiProposedActions.id, id));
    revalidatePath("/assistant");
    return fail(`Could not apply: ${(err as Error).message}`);
  }
}

export async function deleteConversation(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser();
  const id = String(form.get("id") ?? "");
  await db.delete(aiConversations).where(and(eq(aiConversations.id, id), eq(aiConversations.userId, user.id)));
  revalidatePath("/assistant");
  return ok("Conversation deleted.");
}
