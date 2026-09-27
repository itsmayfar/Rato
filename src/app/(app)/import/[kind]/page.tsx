import { notFound } from "next/navigation";
import { ImportPanel } from "@/components/import/import-panel";
import { Card, CardHeader, LinkButton, PageHeader, Table, Td, Th } from "@/components/ui/primitives";
import { requireUser } from "@/lib/auth";
import { optionValue } from "@/lib/fields";
import { IMPORT_KINDS, type ImportKind } from "@/lib/import-kinds";

export const metadata = { title: "Import CSV" };

export default async function ImportPage({ params }: { params: Promise<{ kind: string }> }) {
  await requireUser();
  const { kind } = await params;
  const cfg = IMPORT_KINDS[kind as ImportKind];
  if (!cfg) notFound();
  return (
    <div className="max-w-5xl">
      <PageHeader eyebrow="CSV import" title={cfg.title} purpose={`${cfg.description} Every row is validated first — nothing is imported unless the whole file is valid.`} actions={<LinkButton href={cfg.back} variant="ghost">Back</LinkButton>} />
      <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
        <Card>
          <CardHeader title="Upload" description="Comma or semicolon separated, first row = column names." />
          <ImportPanel kind={kind} back={cfg.back} />
        </Card>
        <Card>
          <CardHeader title="Columns" description="Use the column key or its label as header. Unknown columns are ignored." />
          <Table>
            <thead><tr><Th>Column</Th><Th>Format</Th></tr></thead>
            <tbody>
              {cfg.defs.map((d) => (
                <tr key={d.key}>
                  <Td className="text-xs"><code className="text-fg">{d.key}</code>{d.required && <span className="text-accent-strong"> *</span>}<div className="text-faint">{d.label}</div></Td>
                  <Td className="text-xs text-muted">
                    {d.type === "date" ? "YYYY-MM-DD" : d.type === "duration" ? "m:ss" : d.type === "tags" ? "comma separated" : d.type === "tristate" ? "yes / no / unknown" : d.type === "boolean" ? "yes / no" : d.options?.length ? d.options.slice(0, 6).map(optionValue).join(" · ") + (d.options.length > 6 ? " …" : "") : d.type}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
      </div>
    </div>
  );
}
