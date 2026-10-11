"use client";

import { useActionState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useFormStatus } from "react-dom";
import { ArrowUp, Loader2 } from "lucide-react";
import { buttonClass } from "@/components/ui/primitives";
import { sendAssistantMessage } from "@/lib/actions/assistant";
import type { ActionState } from "@/lib/action-state";

function Send() {
  const { pending } = useFormStatus();
  return (
    <>
      {pending && <span className="absolute -top-7 left-0 flex items-center gap-2 text-xs text-muted"><Loader2 className="h-3 w-3 animate-spin" /> Checking your business data…</span>}
      <button type="submit" disabled={pending} className={buttonClass("primary", "icon", "h-10 w-10 shrink-0")} aria-label="Send">
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUp className="h-4 w-4" />}
      </button>
    </>
  );
}

export function Composer({ conversationId, initial, suggestions, commands = [] }: { conversationId?: string; initial?: string; suggestions: string[]; commands?: { command: string; label: string }[] }) {
  const [state, action] = useActionState(sendAssistantMessage, {} as ActionState);
  const router = useRouter();
  const ref = useRef<HTMLFormElement>(null);
  const area = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (state.ok) {
      ref.current?.reset();
      const id = state.data?.conversationId as string | undefined;
      if (id && id !== conversationId) router.replace(`/assistant?c=${id}`);
    }
  }, [state, conversationId, router]);
  const fill = (text: string) => {
    if (!area.current) return;
    area.current.value = text;
    area.current.focus();
    area.current.setSelectionRange(text.length, text.length);
  };
  return (
    <div>
      {commands.length > 0 && (
        <div className="mb-2 flex flex-wrap items-center gap-2" aria-label="Manager commands">
          <span className="text-[10px] uppercase tracking-[0.2em] text-faint">Manager</span>
          {commands.map((c) => (
            <button key={c.command} type="button" title={c.label} onClick={() => fill(`${c.command} `)} className="rounded-full border border-line px-2.5 py-0.5 font-mono text-xs text-muted hover:border-accent hover:text-fg">
              {c.command}
            </button>
          ))}
        </div>
      )}
      {!conversationId && (
        <div className="mb-3 flex flex-wrap gap-2">
          {suggestions.map((s) => (
            <button key={s} type="button" onClick={() => fill(s)} className="rounded-full border border-line px-3 py-1 text-xs text-muted hover:border-accent hover:text-fg">
              {s}
            </button>
          ))}
        </div>
      )}
      <form ref={ref} action={action} className="relative flex items-end gap-2 rounded-lg border border-line bg-surface p-2 focus-within:border-accent">
        {conversationId && <input type="hidden" name="conversationId" value={conversationId} />}
        <textarea
          ref={area}
          name="message"
          defaultValue={initial}
          rows={2}
          aria-label="Message the assistant"
          placeholder="Ask about your releases, tasks, finances… or use a command like /release La Noche."
          className="max-h-48 min-h-12 flex-1 resize-y bg-transparent px-2 py-1.5 text-sm text-fg placeholder:text-faint focus:outline-none"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              ref.current?.requestSubmit();
            }
          }}
        />
        <Send />
      </form>
      {state.ok === false && <p className="mt-2 text-xs text-danger">{state.message}</p>}
    </div>
  );
}
