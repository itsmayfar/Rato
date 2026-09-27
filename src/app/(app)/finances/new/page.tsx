import { TransactionForm } from "@/components/finance/tx-form";
import { Card, Notice, PageHeader } from "@/components/ui/primitives";
import { requireUser } from "@/lib/auth";
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES } from "@/lib/constants";
import { loadContext } from "@/lib/context";
import { TRANSACTION_FIELDS, withOptions } from "@/lib/forms";
import { relationOptions } from "@/lib/task-options";

export const metadata = { title: "Record income or expense" };

export default async function NewTx({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requireUser();
  const ctx = await loadContext(user.id);
  const sp = await searchParams;
  const kind = sp.kind === "income" ? "income" : "expense";
  return (
    <div className="max-w-4xl">
      <PageHeader eyebrow="Finances" title={kind === "income" ? "Record income" : "Record an expense"} purpose="Store the original amount and currency. For foreign currencies, add the exchange rate with its source and date — otherwise the record is kept but not converted." />
      <Notice className="mb-6">This is bookkeeping support, not tax or accounting advice.</Notice>
      <Card>
        <TransactionForm
          defs={withOptions(TRANSACTION_FIELDS, { ...relationOptions(ctx), category: [...(kind === "income" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES)] }).map((d) => (d.key === "category" ? { ...d, allowCustom: true } : d))}
          values={{ kind, currency: ctx.settings.currency, date: ctx.today, nature: "actual", paymentStatus: "paid", category: sp.category ?? "", trackId: sp.trackId, releaseId: sp.releaseId, campaignId: sp.campaignId }}
        />
      </Card>
    </div>
  );
}
