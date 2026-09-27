import Link from "next/link";
import { notFound } from "next/navigation";
import { Trash2 } from "lucide-react";
import { TransactionForm } from "@/components/finance/tx-form";
import { ConfirmAction } from "@/components/ui/form";
import { Card, PageHeader } from "@/components/ui/primitives";
import { deleteTransaction } from "@/lib/actions/finance";
import { requireUser } from "@/lib/auth";
import { loadContext } from "@/lib/context";
import { TRANSACTION_FIELDS, withOptions } from "@/lib/forms";
import { relationOptions } from "@/lib/task-options";

export default async function TxPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const ctx = await loadContext(user.id);
  const t = ctx.transactions.find((x) => x.id === id);
  if (!t) notFound();
  return (
    <div className="max-w-4xl">
      <PageHeader
        eyebrow={<Link href="/finances?tab=ledger" className="hover:text-fg">Finances</Link>}
        title={t.description}
        purpose="Changes to financial records are logged in the audit trail."
        actions={<ConfirmAction action={deleteTransaction} fields={{ id }} label="Delete" title="Delete this financial record?" message="Deleting changes your financial reports. The deletion is recorded in the audit log." size="md" icon={<Trash2 className="h-4 w-4" />} />}
      />
      <Card>
        <TransactionForm id={id} defs={withOptions(TRANSACTION_FIELDS, relationOptions(ctx)).map((d) => (d.key === "category" ? { ...d, allowCustom: true } : d))} values={t as unknown as Record<string, unknown>} />
        {t.documentId && <p className="mt-4 text-sm"><a href={`/api/files/${t.documentId}`} className="text-accent-strong hover:underline">Open attached receipt / invoice</a></p>}
      </Card>
    </div>
  );
}
