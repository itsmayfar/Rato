import { notFound } from "next/navigation";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { QuestionFlow } from "@/components/info/question-flow";
import { Card, LinkButton, Notice, PageHeader, Progress } from "@/components/ui/primitives";
import { requireUser } from "@/lib/auth";
import { loadContext } from "@/lib/context";
import { evaluateRelease, summarize } from "@/lib/info/engine";
import { toQuestions } from "@/lib/info/questions";

export const metadata = { title: "Release information" };

export default async function ReleaseQuestions({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ new?: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const { new: isNew } = await searchParams;
  const ctx = await loadContext(user.id);
  const release = ctx.releases.find((r) => r.id === id);
  if (!release) notFound();
  const items = evaluateRelease(ctx, release);
  const s = summarize(items);
  const q = toQuestions(items);
  const reused = items.filter((i) => i.editable && i.status === "complete").length;
  return (
    <div className="max-w-5xl">
      <PageHeader
        eyebrow={`Release · ${release.title}`}
        title={s.missingRequired ? "A few details are missing" : "All required information is in place"}
        purpose={`${reused} item(s) were reused from your profile, catalog and earlier answers. Only what’s missing is asked below.`}
        actions={<LinkButton href={`/releases/${id}`} variant={s.missingRequired ? "ghost" : "primary"}>Open release <ArrowRight className="h-4 w-4" /></LinkButton>}
      />
      {isNew && <Notice tone="success" className="mb-6" title="Release project created">The checklist was generated for this release type and your preferences.</Notice>}
      <Card className="mb-6">
        <div className="mb-2 flex justify-between text-sm"><span>{s.requiredComplete} of {s.requiredTotal} required items</span><span className="text-muted">{s.percent}%</span></div>
        <Progress value={s.percent} tone={s.missingRequired ? "accent" : "success"} />
        {!s.missingRequired && (
          <p className="mt-4 flex items-center gap-2 text-sm text-success"><CheckCircle2 className="h-4 w-4" /> Next available action: work through the release checklist and submit to your distributor.</p>
        )}
      </Card>
      <QuestionFlow {...q} showEntity submitLabel="Save answers" />
    </div>
  );
}
