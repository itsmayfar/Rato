import Link from "next/link";
import { and, asc, desc, eq } from "drizzle-orm";
import { Bot, Check, Plus, Trash2, User, Wrench, X } from "lucide-react";
import { Composer } from "@/components/assistant/composer";
import { Markdown } from "@/components/assistant/markdown";
import { ConfirmAction, InlineAction } from "@/components/ui/form";
import { Badge, LinkButton, Notice, PageHeader, buttonClass } from "@/components/ui/primitives";
import { decideProposal, deleteConversation } from "@/lib/actions/assistant";
import { aiConfig } from "@/lib/ai/config";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { aiConversations, aiMessages, aiProposedActions } from "@/lib/db/schema";
import { cn, formatDateTime } from "@/lib/utils";

export const metadata = { title: "AI Assistant" };

const SUGGESTIONS = [
  "What should I do today?",
  "I want to release a new track.",
  "What information is missing for my next release?",
  "Draft an Instagram caption for my next release.",
  "Summarise my finances this month.",
  "Plan the next 4 weeks of promotion.",
];

const KIND_LABEL: Record<string, string> = {
  create_tasks: "Create tasks",
  create_release: "Create release",
  save_info: "Save information",
  create_content: "Add content drafts",
  draft_outreach: "Save outreach draft",
  create_campaign: "Create campaign",
};

function ProposalDetails({ kind, payload }: { kind: string; payload: Record<string, unknown> }) {
  const p = payload as Record<string, never>;
  if (kind === "create_tasks") return <ul className="mt-2 list-disc pl-5 text-xs text-muted">{(p.tasks as { title: string; due_date?: string }[]).map((t, i) => <li key={i}>{t.title}{t.due_date && ` — due ${t.due_date}`}</li>)}</ul>;
  if (kind === "save_info") return <ul className="mt-2 list-disc pl-5 text-xs text-muted">{(p.fields as { entity: string; key: string; value: string }[]).map((f, i) => <li key={i}>{f.entity}.{f.key} → “{f.value}”</li>)}</ul>;
  if (kind === "create_content") return <ul className="mt-2 list-disc pl-5 text-xs text-muted">{(p.items as { title: string; platform?: string; caption?: string }[]).map((c, i) => <li key={i}><span className="text-fg">{c.title}</span>{c.platform && ` (${c.platform})`}{c.caption && <span className="block whitespace-pre-line text-faint">{c.caption}</span>}</li>)}</ul>;
  if (kind === "draft_outreach") return <div className="mt-2 text-xs text-muted"><div className="text-fg">{p.subject}</div><p className="mt-1 whitespace-pre-line">{p.message}</p></div>;
  if (kind === "create_release") return <p className="mt-2 text-xs text-muted">{p.title} · {p.release_type}{p.release_date && ` · ${p.release_date}`}</p>;
  if (kind === "create_campaign") return <p className="mt-2 text-xs text-muted">{p.name}{p.objective && ` · ${p.objective}`}</p>;
  return null;
}

export default async function AssistantPage({ searchParams }: { searchParams: Promise<{ c?: string; q?: string }> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const cfg = aiConfig();
  const conversations = await db.select().from(aiConversations).where(eq(aiConversations.userId, user.id)).orderBy(desc(aiConversations.updatedAt)).limit(40);
  const current = sp.c ? conversations.find((c) => c.id === sp.c) : undefined;
  const messages = current ? await db.select().from(aiMessages).where(eq(aiMessages.conversationId, current.id)).orderBy(asc(aiMessages.createdAt)) : [];
  const proposals = current ? await db.select().from(aiProposedActions).where(and(eq(aiProposedActions.conversationId, current.id), eq(aiProposedActions.userId, user.id))).orderBy(asc(aiProposedActions.createdAt)) : [];

  return (
    <div>
      <PageHeader
        eyebrow="AI Assistant"
        title="Your business manager"
        purpose="Answers from your saved data, finds what’s missing, and drafts plans, tasks, captions and emails. Anything that would change your data is shown as a proposal for you to approve."
        actions={
          <>
            <Badge tone={cfg.configured ? "success" : "warning"}>{cfg.configured ? `AI: ${cfg.model}` : "Offline mode"}</Badge>
            <LinkButton href="/assistant" variant="outline"><Plus className="h-4 w-4" /> New conversation</LinkButton>
          </>
        }
      />
      {!cfg.configured && (
        <Notice tone="warning" className="mb-6" title="No AI provider configured">
          The assistant answers common questions from your stored data (priorities, missing information, releases, tasks, finances). Set <code>ANTHROPIC_API_KEY</code> on the server to enable drafting and planning. <Link href="/settings/ai" className="text-fg underline">Settings → AI</Link>
        </Notice>
      )}
      <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <h2 className="mb-2 text-[11px] uppercase tracking-[0.16em] text-faint">Conversations</h2>
          <ul className="max-h-[60vh] space-y-0.5 overflow-y-auto">
            {conversations.map((c) => (
              <li key={c.id} className="group flex items-center">
                <Link href={`/assistant?c=${c.id}`} className={cn("min-w-0 flex-1 truncate rounded-md px-3 py-2 text-sm", c.id === current?.id ? "bg-surface-3 text-fg" : "text-muted hover:bg-surface-2 hover:text-fg")}>
                  {c.title}
                </Link>
                <span className="opacity-0 group-hover:opacity-100">
                  <ConfirmAction action={deleteConversation} fields={{ id: c.id }} label="Delete" title="Delete this conversation?" message="Messages are deleted. Anything you approved stays." size="icon" variant="ghost" icon={<Trash2 className="h-3 w-3" />} />
                </span>
              </li>
            ))}
            {!conversations.length && <li className="px-3 text-xs text-faint">No conversations yet.</li>}
          </ul>
        </aside>
        <section className="flex min-h-[60vh] min-w-0 flex-col">
          <div className="flex-1 space-y-5 pb-6">
            {!current && (
              <div className="rounded-lg border border-dashed border-line p-8 text-center">
                <Bot className="mx-auto mb-3 h-8 w-8 text-accent-strong" />
                <p className="text-sm">Ask anything about your artist business.</p>
                <p className="mt-1 text-xs text-muted">I use only what’s saved in the app and will tell you when something is missing.</p>
              </div>
            )}
            {messages.map((m) => {
              const mine = proposals.filter((p) => p.messageId === m.id);
              return (
                <article key={m.id} className={cn("flex gap-3", m.role === "user" && "flex-row-reverse")}>
                  <span className={cn("mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border", m.role === "user" ? "border-line-strong" : "border-accent/60 text-accent-strong")} aria-hidden>
                    {m.role === "user" ? <User className="h-3.5 w-3.5" /> : <Bot className="h-3.5 w-3.5" />}
                  </span>
                  <div className={cn("min-w-0 max-w-[85%] rounded-lg border px-4 py-3", m.role === "user" ? "border-line bg-surface-3" : "border-line bg-surface")}>
                    {m.role === "user" ? <p className="whitespace-pre-line text-sm">{m.content}</p> : <Markdown text={m.content} />}
                    {m.toolLog.length > 0 && (
                      <details className="mt-3 text-[11px] text-faint">
                        <summary className="flex cursor-pointer items-center gap-1"><Wrench className="h-3 w-3" /> Used {m.toolLog.length} data tool(s)</summary>
                        <ul className="mt-1 space-y-0.5 pl-4">{m.toolLog.map((t, i) => <li key={i}>{t.name} — {t.summary}</li>)}</ul>
                      </details>
                    )}
                    {mine.map((p) => (
                      <div key={p.id} className="mt-3 rounded-md border border-accent/40 bg-accent-soft/40 p-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="text-sm"><Badge tone="accent">{KIND_LABEL[p.kind] ?? p.kind}</Badge> <span className="ml-1">{p.summary}</span></div>
                          <Badge tone={p.status === "approved" ? "success" : p.status === "pending" ? "warning" : p.status === "failed" ? "danger" : "inactive"}>{p.status}</Badge>
                        </div>
                        <ProposalDetails kind={p.kind} payload={p.payload} />
                        {p.status === "pending" ? (
                          <div className="mt-3 flex gap-2">
                            <InlineAction action={decideProposal} fields={{ id: p.id, decision: "approve" }} variant="primary"><Check className="h-3.5 w-3.5" /> Approve</InlineAction>
                            <InlineAction action={decideProposal} fields={{ id: p.id, decision: "reject" }} variant="ghost"><X className="h-3.5 w-3.5" /> Reject</InlineAction>
                          </div>
                        ) : p.resultNote ? (
                          <p className="mt-2 text-xs text-muted">
                            {p.resultNote.split("|")[0]}{" "}
                            {p.resultNote.includes("|") && <Link href={p.resultNote.split("|")[1]} className={buttonClass("ghost", "sm", "text-accent-strong")}>Open →</Link>}
                          </p>
                        ) : null}
                      </div>
                    ))}
                    <div className="mt-2 text-[10px] text-faint">{formatDateTime(m.createdAt)}{m.role === "assistant" && m.mode === "offline" && " · offline answer from stored data"}</div>
                  </div>
                </article>
              );
            })}
          </div>
          <div className="sticky bottom-0 bg-bg/90 pb-2 pt-3 backdrop-blur">
            <Composer key={current?.id ?? "new"} conversationId={current?.id} initial={sp.q} suggestions={SUGGESTIONS} />
          </div>
        </section>
      </div>
    </div>
  );
}
