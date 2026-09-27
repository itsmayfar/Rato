"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { requireUser } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { fail, ok, type ActionState } from "@/lib/action-state";
import { assertOwned, getSettings } from "@/lib/context";
import { db } from "@/lib/db";
import { budgets, campaigns, documents, projects, releases, tracks, transactions } from "@/lib/db/schema";
import { parseForm, type FieldValue } from "@/lib/fields";
import { BUDGET_FIELDS, TRANSACTION_FIELDS } from "@/lib/forms";
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES } from "@/lib/constants";

const nn = <T,>(v: T) => (v === "" || v === undefined ? null : v);

async function refs(userId: string, d: Record<string, FieldValue>) {
  await assertOwned(tracks, userId, [d.trackId as string]);
  await assertOwned(releases, userId, [d.releaseId as string]);
  await assertOwned(campaigns, userId, [d.campaignId as string]);
  await assertOwned(projects, userId, [d.projectId as string]);
  await assertOwned(documents, userId, [d.documentId as string]);
}

export async function saveTransaction(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser();
  const id = String(form.get("id") ?? "");
  const parsed = parseForm(TRANSACTION_FIELDS, form);
  if (!parsed.ok) return fail("Check the highlighted fields.", parsed.errors);
  const d = parsed.data;
  const settings = await getSettings(user.id);
  const kind = d.kind as string;
  const category = d.category as string;
  const known = kind === "income" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
  const other = kind === "income" ? EXPENSE_CATEGORIES : INCOME_CATEGORIES;
  if (other.includes(category) && !known.includes(category)) return fail(`“${category}” is an ${kind === "income" ? "expense" : "income"} category.`, { category: "Doesn’t match the type" });
  const currency = d.currency as string;
  const fxRate = nn(d.fxRate) as number | null;
  if (currency !== settings.currency && fxRate && (!d.fxSource || !d.fxDate)) {
    return fail("Record where the exchange rate comes from and its date.", { fxSource: "Required with a rate", fxDate: "Required with a rate" });
  }
  // documentId can also come from an upload field
  const uploaded = nn(String(form.get("uploadedDocumentId") ?? "")) as string | null;
  const documentId = uploaded ?? (nn(d.documentId) as string | null);
  try {
    await refs(user.id, { ...d, documentId });
  } catch {
    return fail("A linked record could not be found.");
  }
  const values = {
    kind,
    category,
    description: d.description as string,
    amount: d.amount as number,
    currency,
    fxRate: currency === settings.currency ? null : fxRate,
    fxSource: currency === settings.currency ? null : (nn(d.fxSource) as string | null),
    fxDate: currency === settings.currency ? null : (nn(d.fxDate) as string | null),
    baseAmount: currency !== settings.currency && fxRate ? Math.round((d.amount as number) * fxRate * 100) / 100 : null,
    date: d.date as string,
    nature: d.nature as string,
    paymentStatus: d.paymentStatus as string,
    counterparty: nn(d.counterparty) as string | null,
    trackId: nn(d.trackId) as string | null,
    releaseId: nn(d.releaseId) as string | null,
    campaignId: nn(d.campaignId) as string | null,
    projectId: nn(d.projectId) as string | null,
    documentId,
    notes: nn(d.notes) as string | null,
  };
  if (id) {
    const [prev] = await db.select().from(transactions).where(and(eq(transactions.id, id), eq(transactions.userId, user.id)));
    if (!prev) return fail("Record not found.");
    await db.update(transactions).set(values).where(eq(transactions.id, id));
    await audit(user.id, "finance.update", "transaction", id, values.description, {
      before: { amount: prev.amount, currency: prev.currency, date: prev.date, nature: prev.nature, paymentStatus: prev.paymentStatus },
      after: { amount: values.amount, currency: values.currency, date: values.date, nature: values.nature, paymentStatus: values.paymentStatus },
    });
    revalidatePath("/", "layout");
    return ok("Record saved.");
  }
  const [row] = await db.insert(transactions).values({ ...values, userId: user.id }).returning({ id: transactions.id });
  await audit(user.id, "finance.create", "transaction", row.id, `${kind} ${values.amount} ${currency}: ${values.description}`);
  revalidatePath("/", "layout");
  if (form.get("__another") === "1") return ok("Saved. Add another.");
  redirect(`/finances?tab=ledger`);
}

export async function deleteTransaction(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser();
  const id = String(form.get("id") ?? "");
  const [t] = await db.delete(transactions).where(and(eq(transactions.id, id), eq(transactions.userId, user.id))).returning();
  if (!t) return fail("Record not found.");
  await audit(user.id, "finance.delete", "transaction", id, `${t.kind} ${t.amount} ${t.currency}: ${t.description}`, { date: t.date, category: t.category });
  revalidatePath("/", "layout");
  redirect("/finances?tab=ledger");
}

export async function saveBudget(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser();
  const id = String(form.get("id") ?? "");
  const parsed = parseForm(BUDGET_FIELDS, form);
  if (!parsed.ok) return fail("Check the highlighted fields.", parsed.errors);
  const d = parsed.data;
  if (d.periodStart && d.periodEnd && (d.periodEnd as string) < (d.periodStart as string)) return fail("Period end is before the start.", { periodEnd: "Before start" });
  try {
    await refs(user.id, d);
  } catch {
    return fail("A linked record could not be found.");
  }
  const values = {
    name: d.name as string,
    scope: d.scope as string,
    amount: d.amount as number,
    currency: d.currency as string,
    category: nn(d.category) as string | null,
    periodStart: nn(d.periodStart) as string | null,
    periodEnd: nn(d.periodEnd) as string | null,
    releaseId: nn(d.releaseId) as string | null,
    campaignId: nn(d.campaignId) as string | null,
    projectId: nn(d.projectId) as string | null,
    notes: nn(d.notes) as string | null,
  };
  if (id) {
    const res = await db.update(budgets).set(values).where(and(eq(budgets.id, id), eq(budgets.userId, user.id))).returning({ id: budgets.id });
    if (!res.length) return fail("Budget not found.");
  } else {
    await db.insert(budgets).values({ ...values, userId: user.id });
  }
  await audit(user.id, id ? "budget.update" : "budget.create", "budget", id || null, `${values.name}: ${values.amount} ${values.currency}`);
  revalidatePath("/", "layout");
  return ok("Budget saved.");
}

export async function deleteBudget(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser();
  const id = String(form.get("id") ?? "");
  const [b] = await db.delete(budgets).where(and(eq(budgets.id, id), eq(budgets.userId, user.id))).returning({ name: budgets.name });
  if (!b) return fail("Budget not found.");
  await audit(user.id, "budget.delete", "budget", id, b.name);
  revalidatePath("/", "layout");
  return ok("Budget deleted.");
}
