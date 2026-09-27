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

export function Composer({ conversationId, initial, suggestions }: { conversationId?: string; initial?: string; suggestions: string[] }) {
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
  return (
    <div>
      {!conversationId && (
        <div className="mb-3 flex flex-wrap gap-2">
          {suggestions.map((s) => (
            <button key={s} type="button" onClick={() => { if (area.current) { area.current.value = s; area.current.focus(); } }} className="rounded-full border border-line px-3 py-1 text-xs text-muted hover:border-accent hover:text-fg">
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
          placeholder="Ask about your releases, tasks, finances… or ask for a plan or draft."
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
