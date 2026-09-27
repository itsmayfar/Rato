import { afterAll, beforeAll, describe, expect, it } from "vitest";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import * as s from "@/lib/db/schema";
import { createUser, hasDb } from "./helpers";

type Req = { body: Record<string, unknown>; headers: http.IncomingHttpHeaders };
const requests: Req[] = [];
let script: Record<string, unknown>[] = [];
let server: http.Server;

function msg(content: unknown[], stop_reason: string) {
  return { id: `msg_${requests.length}`, type: "message", role: "assistant", model: "claude-opus-5", content, stop_reason, stop_sequence: null, usage: { input_tokens: 100, output_tokens: 20 } };
}

beforeAll(async () => {
  server = http.createServer((req, res) => {
    let data = "";
    req.on("data", (c) => (data += c));
    req.on("end", () => {
      requests.push({ body: JSON.parse(data), headers: req.headers });
      const next = script.shift() ?? msg([{ type: "text", text: "done" }], "end_turn");
      res.writeHead(200, { "content-type": "application/json", "request-id": "req_test" });
      res.end(JSON.stringify(next));
    });
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  process.env.ANTHROPIC_BASE_URL = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  process.env.ANTHROPIC_API_KEY = "test-key";
  process.env.AI_MODEL = "claude-opus-5";
});

const users: string[] = [];
afterAll(async () => {
  server?.close();
  for (const id of users) await db.delete(s.users).where(eq(s.users.id, id));
});

describe.skipIf(!hasDb)("AI assistant tool loop", () => {
  it("reads stored data, rejects invalid proposals, records valid ones as pending, and applies only on approval", async () => {
    const { runAssistant } = await import("@/lib/ai/assistant");
    const { applyProposal } = await import("@/lib/ai/apply");
    const uid = await createUser();
    users.push(uid);
    const [t] = await db.insert(s.tracks).values({ userId: uid, title: "Nightfall", projectCode: "MF-1" }).returning();
    const [conv] = await db.insert(s.aiConversations).values({ userId: uid }).returning();

    script = [
      msg([{ type: "tool_use", id: "tu_1", name: "get_business_overview", input: {} }], "tool_use"),
      msg([{ type: "tool_use", id: "tu_2", name: "propose_tasks", input: { summary: "bad", tasks: [{ title: "x", track_id: "00000000-0000-4000-8000-000000000000" }] } }], "tool_use"),
      msg([{ type: "tool_use", id: "tu_3", name: "propose_tasks", input: { summary: "Mixing plan", tasks: [{ title: "Bounce stems for Nightfall", track_id: t.id, due_date: "2026-10-10", priority: "high" }] } }], "tool_use"),
      msg([{ type: "text", text: "I proposed one task. It awaits your approval." }], "end_turn"),
    ];
    const result = await runAssistant(uid, conv.id, [{ role: "user", content: "Plan my mixing" }]);

    expect(result.text).toContain("awaits your approval");
    expect(result.toolLog.map((l) => l.name)).toEqual(["get_business_overview", "propose_tasks", "propose_tasks"]);
    expect(result.toolLog[1].summary).toMatch(/error/);

    // Request shape
    const first = requests[0].body;
    expect(first.model).toBe("claude-opus-5");
    expect(first.thinking).toEqual({ type: "adaptive" });
    expect(first.fallbacks).toBe("default");
    expect(String(requests[0].headers["anthropic-beta"])).toContain("server-side-fallback-2026-07-01");
    expect((first.tools as { name: string }[]).map((x) => x.name)).toContain("propose_tasks");
    // The overview tool result carried real data back
    const second = requests[1].body.messages as { role: string; content: { type: string; content?: string }[] }[];
    const toolResult = second[second.length - 1].content[0];
    expect(toolResult.type).toBe("tool_result");
    expect(toolResult.content).toContain('"tracks":1');

    // Nothing was written yet — only a pending proposal
    expect(await db.select().from(s.tasks).where(eq(s.tasks.userId, uid))).toHaveLength(0);
    const proposals = await db.select().from(s.aiProposedActions).where(eq(s.aiProposedActions.userId, uid));
    expect(proposals).toHaveLength(1);
    expect(proposals[0].status).toBe("pending");

    const note = await applyProposal(uid, proposals[0].id, proposals[0].kind, proposals[0].payload);
    expect(note).toMatch(/1 task/);
    const tasks = await db.select().from(s.tasks).where(eq(s.tasks.userId, uid));
    expect(tasks[0]).toMatchObject({ title: "Bounce stems for Nightfall", trackId: t.id, priority: "high", source: "assistant" });
  });

  it("handles refusals without leaking content", async () => {
    const { runAssistant } = await import("@/lib/ai/assistant");
    const uid = await createUser();
    users.push(uid);
    const [conv] = await db.insert(s.aiConversations).values({ userId: uid }).returning();
    script = [{ ...msg([], "refusal"), stop_details: { type: "refusal", category: null, explanation: null } }];
    const r = await runAssistant(uid, conv.id, [{ role: "user", content: "..." }]);
    expect(r.refused).toBe(true);
    expect(r.text).toMatch(/can’t help/);
  });

  it("refuses to save information for fields that must be entered by the artist", async () => {
    const { recordProposal } = await import("@/lib/ai/tools");
    const { loadContextUncached } = await import("@/lib/context");
    const uid = await createUser();
    users.push(uid);
    const [conv] = await db.insert(s.aiConversations).values({ userId: uid }).returning();
    const ctx = await loadContextUncached(uid);
    const res = (await recordProposal(ctx, conv.id, "propose_information", { summary: "x", fields: [{ entity: "profile", key: "legalName", value: "Jane Doe" }] })) as { error?: string };
    expect(res.error).toMatch(/legal name/);
  });
});

describe("offline assistant", () => {
  it("answers from stored data only", async () => {
    const { offlineAnswer } = await import("@/lib/ai/offline");
    const { makeContext } = await import("../fixtures");
    const ctx = makeContext();
    expect(offlineAnswer(ctx, "What should I do next?")).toMatch(/priorities/);
    expect(offlineAnswer(ctx, "Tell me a poem")).toMatch(/offline mode/);
    expect(offlineAnswer(ctx, "how are my finances")).toMatch(/Income: €0\.00/);
  });
});
