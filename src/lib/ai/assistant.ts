import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { sql } from "drizzle-orm";
import { db } from "../db";
import { aiUsage } from "../db/schema";
import { loadContextUncached } from "../context";
import { aiConfig } from "./config";
import { ALL_TOOLS, READ_TOOLS, recordProposal, runReadTool } from "./tools";

export const SYSTEM_PROMPT = `You are the MAYFAR Artist Manager assistant — the business manager for MayFar, an independent electronic music artist and producer (brand concept "Dark Emotion", phrase "Sound becomes feeling.").

You work only with the artist's saved business data, which you read through tools. Before answering questions about the business, call the relevant tools; don't answer from memory of earlier turns when the data may have changed.

Ground rules:
- Never invent facts, numbers, streaming statistics, financial results, dates, credits or ownership. If something isn't in the data, say it is missing and ask for it.
- Distinguish clearly between recorded facts, values the artist told you, estimates and your own suggestions. Label suggestions as suggestions.
- You cannot access external services, publish content, send messages, spend money or register anything. Never claim an external action happened; the artist does those and confirms them in the app.
- You can't change data directly. To create tasks, releases, campaigns, content drafts, outreach drafts or to save information the artist gave you, call a propose_* tool. The artist approves or rejects each proposal in the chat. After proposing, tell them what you proposed and that it awaits approval.
- Only save information the artist actually stated. Ownership splits, legal names and financial records must be entered by the artist in the app.
- Don't give legal or tax advice; you can explain what information is usually needed and suggest consulting a professional.
- Ask only for information that is genuinely missing, a few questions at a time, and explain why it's needed.

When helpful, structure answers as: current situation, what is missing, what needs to happen next, why it matters, recommended action, and any approval needed. Keep answers concise and specific; use short lists. Write in English unless the artist writes in another language. Refer to items by name, not by id.`;

export type ToolLogEntry = { name: string; input: unknown; summary: string };
export type AssistantResult = { text: string; toolLog: ToolLogEntry[]; inputTokens: number; outputTokens: number; refused?: boolean };

const MAX_ITERATIONS = 10;

function isReadTool(name: string) {
  return READ_TOOLS.some((t) => t.name === name);
}

export async function recordUsage(userId: string, day: string, input: number, output: number, error = false) {
  await db
    .insert(aiUsage)
    .values({ userId, day, requests: 1, inputTokens: input, outputTokens: output, errors: error ? 1 : 0 })
    .onConflictDoUpdate({
      target: [aiUsage.userId, aiUsage.day],
      set: {
        requests: sql`${aiUsage.requests} + 1`,
        inputTokens: sql`${aiUsage.inputTokens} + ${input}`,
        outputTokens: sql`${aiUsage.outputTokens} + ${output}`,
        errors: sql`${aiUsage.errors} + ${error ? 1 : 0}`,
      },
    });
}

/** Friendly, non-leaky message for API errors. */
export function describeAiError(err: unknown): string {
  if (err instanceof Anthropic.AuthenticationError) return "The AI provider rejected the API key. Check ANTHROPIC_API_KEY on the server.";
  if (err instanceof Anthropic.PermissionDeniedError) return "The API key doesn’t have access to the configured model. Check AI_MODEL.";
  if (err instanceof Anthropic.NotFoundError) return "The configured model was not found. Check AI_MODEL.";
  if (err instanceof Anthropic.RateLimitError) return "The AI provider is rate-limiting requests. Try again in a minute.";
  if (err instanceof Anthropic.BadRequestError) return `The AI request was rejected: ${err.message.slice(0, 200)}`;
  if (err instanceof Anthropic.APIConnectionError) return "Couldn’t reach the AI provider (network). Try again.";
  if (err instanceof Anthropic.APIError) return `The AI provider returned an error (${err.status}). Try again.`;
  return "Something went wrong while contacting the AI provider.";
}

/**
 * Run one assistant turn: a manual tool loop over the stored business data.
 * Read tools execute directly; proposal tools only record pending proposals.
 */
export async function runAssistant(
  userId: string,
  conversationId: string,
  history: { role: "user" | "assistant"; content: string }[],
): Promise<AssistantResult> {
  const cfg = aiConfig();
  const client = new Anthropic({ maxRetries: 2, timeout: 5 * 60_000 });
  const ctx0 = await loadContextUncached(userId);
  const messages: Anthropic.Beta.BetaMessageParam[] = history.map((m, i) =>
    i === history.length - 1 && m.role === "user"
      ? { role: "user", content: `${m.content}\n\n(Context: today is ${ctx0.today}; currency ${ctx0.settings.currency}.)` }
      : { role: m.role, content: m.content },
  );
  const toolLog: ToolLogEntry[] = [];
  let inputTokens = 0;
  let outputTokens = 0;
  let text = "";

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    const response = await client.beta.messages.create({
      model: cfg.model,
      max_tokens: 16000,
      system: SYSTEM_PROMPT,
      tools: ALL_TOOLS,
      messages,
      thinking: { type: "adaptive" },
      output_config: { effort: "medium" },
      cache_control: { type: "ephemeral" },
      ...(cfg.fallbacks ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const } : {}),
    });
    inputTokens += response.usage.input_tokens + (response.usage.cache_read_input_tokens ?? 0) + (response.usage.cache_creation_input_tokens ?? 0);
    outputTokens += response.usage.output_tokens;

    if (response.stop_reason === "refusal") {
      return {
        text: "I can’t help with that request. If you think this is a mistake, try rephrasing it around your music business.",
        toolLog,
        inputTokens,
        outputTokens,
        refused: true,
      };
    }

    const turnText = response.content
      .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();
    if (turnText) text = turnText;

    if (response.stop_reason === "pause_turn") {
      messages.push({ role: "assistant", content: response.content });
      continue;
    }
    if (response.stop_reason !== "tool_use") {
      if (response.stop_reason === "max_tokens") text += "\n\n_(The answer was cut off because it reached the length limit.)_";
      break;
    }

    messages.push({ role: "assistant", content: response.content });
    const ctx = await loadContextUncached(userId);
    const results: Anthropic.Beta.BetaToolResultBlockParam[] = [];
    for (const block of response.content) {
      if (block.type !== "tool_use") continue;
      const input = (block.input ?? {}) as Record<string, unknown>;
      try {
        const out = isReadTool(block.name) ? await runReadTool(ctx, block.name, input) : await recordProposal(ctx, conversationId, block.name, input);
        const isError = Boolean(out && typeof out === "object" && "error" in (out as object));
        const json = JSON.stringify(out);
        results.push({ type: "tool_result", tool_use_id: block.id, content: json.length > 40_000 ? `${json.slice(0, 40_000)}…(truncated)` : json, is_error: isError || undefined });
        toolLog.push({ name: block.name, input, summary: isError ? `error: ${(out as { error: string }).error}` : isReadTool(block.name) ? "read stored data" : "proposal recorded (pending approval)" });
      } catch (err) {
        results.push({ type: "tool_result", tool_use_id: block.id, content: `Tool failed: ${(err as Error).message}`, is_error: true });
        toolLog.push({ name: block.name, input, summary: "failed" });
      }
    }
    messages.push({ role: "user", content: results });
  }

  return { text: text || "I couldn’t produce an answer. Please try rephrasing.", toolLog, inputTokens, outputTokens };
}
