"use client";

import { ActionForm, SubmitButton, useFieldError } from "@/components/ui/form";
import { signup } from "@/lib/actions/auth";

function Input({ name, label, type = "text", auto }: { name: string; label: string; type?: string; auto?: string }) {
  const error = useFieldError(name);
  return (
    <div>
      <label htmlFor={name} className="mb-1.5 block text-xs uppercase tracking-[0.12em] text-muted">
        {label}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        autoComplete={auto}
        aria-invalid={error ? true : undefined}
        className="w-full rounded-md border border-line bg-surface-2 px-3 py-2 text-sm focus:border-accent focus:outline-none"
      />
      {error && <p className="mt-1 text-xs text-danger">{error}</p>}
    </div>
  );
}

export function SignupForm() {
  return (
    <ActionForm action={signup} className="space-y-4">
      <Input name="name" label="Your name" auto="name" />
      <Input name="email" label="Email" type="email" auto="email" />
      <Input name="password" label="Password (min. 10 characters)" type="password" auto="new-password" />
      <Input name="confirm" label="Confirm password" type="password" auto="new-password" />
      <SubmitButton className="w-full">Create account</SubmitButton>
    </ActionForm>
  );
}
