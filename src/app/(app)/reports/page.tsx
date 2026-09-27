import Link from "next/link";
import { FileText } from "lucide-react";
import { Card, PageHeader } from "@/components/ui/primitives";
import { requireUser } from "@/lib/auth";
import { REPORTS } from "@/lib/reports";

export const metadata = { title: "Reports" };

export default async function ReportsPage() {
  await requireUser();
  return (
    <div>
      <PageHeader eyebrow="Reports" title="Reports & business reviews" purpose="Generated from your stored records only. Missing data is labelled as missing and estimates as estimates. Export to CSV or print / save as PDF." />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {REPORTS.map((r) => (
          <Link key={r.key} href={`/reports/${r.key}`} className="group">
            <Card className="h-full transition-colors group-hover:border-accent/50">
              <FileText className="mb-3 h-5 w-5 text-accent-strong" />
              <h2 className="text-sm">{r.title}</h2>
              <p className="mt-1 text-xs text-muted">{r.description}</p>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
