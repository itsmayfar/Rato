"use client";

import { ActionForm, FieldInput, SubmitButton } from "@/components/ui/form";
import { login } from "@/lib/actions/auth";

export function LoginForm({ next }: { next: string }) {
  return (
    <ActionForm action={login} className="space-y-4">
      <input type="hidden" name="next" value={next} />
      <FieldInput def={{ key: "email", label: "Email", type: "email", required: true }} />
      <div>
        <label htmlFor="password" className="mb-1.5 block text-xs uppercase tracking-[0.12em] text-muted">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          className="w-full rounded-md border border-line bg-surface-2 px-3 py-2 text-sm focus:border-accent focus:outline-none"
        />
      </div>
      <SubmitButton className="w-full">Sign in</SubmitButton>
    </ActionForm>
  );
}
