"use client";

import { createContext, use, useActionState, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { AlertTriangle, Check, Loader2, X } from "lucide-react";
import type { ActionState } from "@/lib/action-state";
import { optionLabel, optionValue, toInputValue, type FieldDef } from "@/lib/fields";
import { cn } from "@/lib/utils";
import { buttonClass } from "./primitives";

export const inputClass =
  "w-full rounded-md border border-line bg-surface-2 px-3 py-2 text-sm text-fg placeholder:text-faint transition-colors hover:border-line-strong focus:border-accent focus:outline-none disabled:opacity-50";

type Action = (prev: ActionState, formData: FormData) => Promise<ActionState>;

/** Form bound to a server action with inline errors and success feedback. */
export function ActionForm({
  action,
  children,
  className,
  resetOnSuccess,
  onSuccess,
  id,
}: {
  action: Action;
  children: ReactNode | ((state: ActionState) => ReactNode);
  className?: string;
  resetOnSuccess?: boolean;
  onSuccess?: (state: ActionState) => void;
  id?: string;
}) {
  const [state, formAction] = useActionState(action, {} as ActionState);
  const ref = useRef<HTMLFormElement>(null);
  const lastHandled = useRef<ActionState | null>(null);
  useEffect(() => {
    if (state.ok && lastHandled.current !== state) {
      lastHandled.current = state;
      if (resetOnSuccess) ref.current?.reset();
      onSuccess?.(state);
    }
  }, [state, resetOnSuccess, onSuccess]);
  return (
    <form ref={ref} action={formAction} className={className} id={id} noValidate>
      <FormErrorsContext value={state.errors ?? {}}>
        {typeof children === "function" ? children(state) : children}
      </FormErrorsContext>
      <FormMessage state={state} />
    </form>
  );
}

const ErrorsCtx = createContext<Record<string, string>>({});
function FormErrorsContext({ value, children }: { value: Record<string, string>; children: ReactNode }) {
  return <ErrorsCtx value={value}>{children}</ErrorsCtx>;
}
export function useFieldError(name: string) {
  return use(ErrorsCtx)[name];
}

export function FormMessage({ state }: { state: ActionState }) {
  if (!state.message) return null;
  return (
    <div
      role={state.ok ? "status" : "alert"}
      className={cn(
        "animate-fade-in mt-4 flex items-start gap-2 rounded-md border px-3 py-2 text-sm",
        state.ok ? "border-success/40 bg-success/10 text-success" : "border-danger/40 bg-danger/10 text-danger",
      )}
    >
      {state.ok ? <Check className="mt-0.5 h-4 w-4 shrink-0" /> : <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />}
      <span>{state.message}</span>
    </div>
  );
}

export function SubmitButton({
  children,
  variant = "primary",
  size = "md",
  className,
  name,
  value,
  formNoValidate,
}: {
  children: ReactNode;
  variant?: "primary" | "secondary" | "ghost" | "danger" | "outline";
  size?: "sm" | "md" | "lg";
  className?: string;
  name?: string;
  value?: string;
  formNoValidate?: boolean;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      name={name}
      value={value}
      formNoValidate={formNoValidate}
      disabled={pending}
      className={buttonClass(variant, size, className)}
      aria-busy={pending}
    >
      {pending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
      {children}
    </button>
  );
}

export function Label({ htmlFor, children, required }: { htmlFor?: string; children: ReactNode; required?: boolean }) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 flex items-center gap-1.5 text-xs uppercase tracking-[0.12em] text-muted">
      {children}
      {required ? (
        <span className="text-accent-strong" aria-label="required">
          *
        </span>
      ) : (
        <span className="normal-case tracking-normal text-faint">optional</span>
      )}
    </label>
  );
}

/** Renders the right input for a field definition. */
export function FieldInput({
  def,
  value,
  error: errorProp,
  name,
  className,
  hideLabel,
}: {
  def: FieldDef;
  value?: unknown;
  error?: string;
  name?: string;
  className?: string;
  hideLabel?: boolean;
}) {
  const uid = useId();
  const inputId = `${uid}-${def.key}`;
  const fieldName = name ?? def.key;
  const ctxError = useFieldError(fieldName);
  const error = errorProp ?? ctxError;
  const describedBy = error ? `${inputId}-err` : def.help ? `${inputId}-help` : undefined;
  const common = {
    id: inputId,
    name: fieldName,
    "aria-invalid": error ? true : undefined,
    "aria-describedby": describedBy,
    "aria-required": def.required || undefined,
  } as const;
  const strValue = toInputValue(def, value);

  let control: ReactNode;
  switch (def.type) {
    case "textarea":
      control = <textarea {...common} defaultValue={strValue} rows={4} placeholder={def.placeholder} className={inputClass} />;
      break;
    case "boolean":
      control = (
        <label className="flex cursor-pointer items-center gap-2 text-sm text-fg">
          <input type="hidden" name={fieldName} value="false" />
          <input {...common} type="checkbox" value="true" defaultChecked={Boolean(value)} className="h-4 w-4 accent-[var(--accent)]" />
          {def.placeholder ?? def.label}
        </label>
      );
      break;
    case "tristate":
      control = (
        <select {...common} defaultValue={strValue || "unknown"} className={inputClass}>
          <option value="unknown">Unknown / not decided</option>
          <option value="yes">Yes</option>
          <option value="no">No</option>
        </select>
      );
      break;
    case "select":
      control = def.allowCustom ? (
        <>
          <input {...common} list={`${inputId}-list`} defaultValue={strValue} placeholder={def.placeholder} className={inputClass} />
          <datalist id={`${inputId}-list`}>
            {def.options?.map((o) => (
              <option key={optionValue(o)} value={optionValue(o)}>
                {optionLabel(o)}
              </option>
            ))}
          </datalist>
        </>
      ) : (
        <select {...common} defaultValue={strValue} className={inputClass}>
          <option value="">{def.required ? "Select…" : "— Not set —"}</option>
          {def.options?.map((o) => (
            <option key={optionValue(o)} value={optionValue(o)}>
              {optionLabel(o)}
            </option>
          ))}
        </select>
      );
      break;
    case "multiselect": {
      const selected = new Set(Array.isArray(value) ? (value as string[]) : []);
      control = (
        <div className="flex flex-wrap gap-2" role="group" aria-labelledby={`${inputId}-lbl`}>
          {def.options?.map((o) => (
            <label
              key={optionValue(o)}
              className="flex cursor-pointer items-center gap-1.5 rounded-full border border-line px-3 py-1 text-xs text-muted has-[:checked]:border-accent has-[:checked]:bg-accent-soft has-[:checked]:text-fg"
            >
              <input
                type="checkbox"
                name={fieldName}
                value={optionValue(o)}
                defaultChecked={selected.has(optionValue(o))}
                className="sr-only"
              />
              {optionLabel(o)}
            </label>
          ))}
        </div>
      );
      break;
    }
    default: {
      const type =
        def.type === "date"
          ? "date"
          : def.type === "email"
            ? "email"
            : def.type === "url"
              ? "url"
              : def.type === "number" || def.type === "money" || def.type === "percent"
                ? "text"
                : "text";
      control = (
        <div className="relative">
          <input
            {...common}
            type={type}
            inputMode={def.type === "number" || def.type === "money" || def.type === "percent" ? "decimal" : undefined}
            defaultValue={strValue}
            placeholder={def.placeholder ?? (def.type === "tags" ? "Comma separated" : def.type === "duration" ? "3:45" : undefined)}
            className={cn(inputClass, (def.type === "percent" || def.type === "money") && "pr-10")}
          />
          {def.type === "percent" && <span className="pointer-events-none absolute right-3 top-2 text-sm text-faint">%</span>}
        </div>
      );
    }
  }

  return (
    <div className={cn("min-w-0", className)}>
      {!hideLabel && def.type !== "boolean" && (
        <span id={`${inputId}-lbl`}>
          <Label htmlFor={def.type === "multiselect" ? undefined : inputId} required={def.required}>
            {def.label}
          </Label>
        </span>
      )}
      {control}
      {error ? (
        <p id={`${inputId}-err`} className="mt-1 text-xs text-danger">
          {error}
        </p>
      ) : def.help ? (
        <p id={`${inputId}-help`} className="mt-1 text-xs text-faint">
          {def.help}
        </p>
      ) : null}
    </div>
  );
}

/** Grid of fields for a definition list. */
export function FieldGrid({
  defs,
  values,
  columns = 2,
  wide = [],
}: {
  defs: readonly FieldDef[];
  values?: Record<string, unknown>;
  columns?: 1 | 2 | 3;
  wide?: string[];
}) {
  return (
    <div className={cn("grid grid-cols-1 gap-4", columns >= 2 && "md:grid-cols-2", columns === 3 && "lg:grid-cols-3")}>
      {defs.map((d) => (
        <FieldInput
          key={d.key}
          def={d}
          value={values?.[d.key]}
          className={cn((d.type === "textarea" || d.type === "multiselect" || wide.includes(d.key)) && "md:col-span-2 lg:col-span-full")}
        />
      ))}
    </div>
  );
}

// ─── Modal & confirmation ───────────────────────────────────────────────────

export function Modal({
  open,
  onClose,
  title,
  children,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      className={cn(
        "m-auto w-[calc(100%-2rem)] rounded-lg border border-line bg-surface p-0 text-fg shadow-2xl",
        wide ? "max-w-3xl" : "max-w-lg",
      )}
    >
      {open && (
        <div className="animate-fade-in p-6">
          <div className="mb-4 flex items-start justify-between gap-4">
            <h2 className="text-lg font-light">{title}</h2>
            <button type="button" onClick={onClose} className={buttonClass("ghost", "icon")} aria-label="Close">
              <X className="h-4 w-4" />
            </button>
          </div>
          {children}
        </div>
      )}
    </dialog>
  );
}

/** Button that opens a modal containing arbitrary content (e.g. a form). */
export function ModalButton({
  label,
  title,
  children,
  variant = "secondary",
  size = "md",
  wide,
  icon,
}: {
  label: ReactNode;
  title: ReactNode;
  children: ReactNode | ((close: () => void) => ReactNode);
  variant?: "primary" | "secondary" | "ghost" | "danger" | "outline";
  size?: "sm" | "md" | "lg";
  wide?: boolean;
  icon?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);
  return (
    <>
      <button type="button" className={buttonClass(variant, size)} onClick={() => setOpen(true)}>
        {icon}
        {label}
      </button>
      <Modal open={open} onClose={close} title={title} wide={wide}>
        {typeof children === "function" ? children(close) : children}
      </Modal>
    </>
  );
}

/**
 * Submits a server action only after the user confirms. Use for destructive
 * actions and for confirming that an external action really happened.
 */
export function ConfirmAction({
  action,
  fields,
  label,
  title,
  message,
  confirmLabel = "Confirm",
  variant = "danger",
  size = "sm",
  icon,
}: {
  action: Action;
  fields: Record<string, string>;
  label: ReactNode;
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  variant?: "primary" | "secondary" | "ghost" | "danger" | "outline";
  size?: "sm" | "md" | "lg" | "icon";
  icon?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className={buttonClass(variant, size)} onClick={() => setOpen(true)} aria-label={typeof label === "string" ? label : title}>
        {icon}
        {size !== "icon" && label}
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title={title}>
        <div className="text-sm text-muted">{message}</div>
        <ActionForm action={action} onSuccess={() => setOpen(false)} className="mt-6">
          {Object.entries(fields).map(([k, v]) => (
            <input key={k} type="hidden" name={k} value={v} />
          ))}
          <div className="flex justify-end gap-2">
            <button type="button" className={buttonClass("ghost")} onClick={() => setOpen(false)}>
              Cancel
            </button>
            <SubmitButton variant={variant === "danger" ? "danger" : "primary"}>{confirmLabel}</SubmitButton>
          </div>
        </ActionForm>
      </Modal>
    </>
  );
}

/** A tiny form that fires a server action with hidden fields (harmless actions). */
export function InlineAction({
  action,
  fields,
  children,
  variant = "ghost",
  size = "sm",
  className,
  title,
}: {
  action: Action;
  fields: Record<string, string>;
  children: ReactNode;
  variant?: "primary" | "secondary" | "ghost" | "danger" | "outline";
  size?: "sm" | "md" | "lg" | "icon";
  className?: string;
  title?: string;
}) {
  const [state, formAction, pending] = useActionState(action, {} as ActionState);
  return (
    <form action={formAction} className={cn("inline-flex", className)}>
      {Object.entries(fields).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <button
        type="submit"
        disabled={pending}
        title={state.ok === false ? state.message : title}
        aria-label={title}
        className={cn(buttonClass(variant, size), state.ok === false && "text-danger")}
      >
        {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : children}
      </button>
    </form>
  );
}
