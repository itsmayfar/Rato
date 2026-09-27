"use client";

import { useFieldError } from "@/components/ui/form";

function Pw({ name, label, auto }: { name: string; label: string; auto: string }) {
  const error = useFieldError(name);
  return (
    <div>
      <label htmlFor={`pw-${name}`} className="mb-1.5 block text-xs uppercase tracking-[0.12em] text-muted">{label}</label>
      <input id={`pw-${name}`} name={name} type="password" autoComplete={auto} aria-invalid={error ? true : undefined} className="w-full rounded-md border border-line bg-surface-2 px-3 py-2 text-sm focus:border-accent focus:outline-none" />
      {error && <p className="mt-1 text-xs text-danger">{error}</p>}
    </div>
  );
}

export function PasswordFields() {
  return (
    <>
      <Pw name="current" label="Current password" auto="current-password" />
      <Pw name="next" label="New password (min. 10 characters)" auto="new-password" />
      <Pw name="confirm" label="Confirm new password" auto="new-password" />
    </>
  );
}
