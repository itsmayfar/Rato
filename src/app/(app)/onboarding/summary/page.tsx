import Link from "next/link";
import { ArrowRight, CheckCircle2, CircleDashed } from "lucide-react";
import { Badge, Card, CardHeader, LinkButton, PageHeader, Progress } from "@/components/ui/primitives";
import { requireUser } from "@/lib/auth";
import { loadContext } from "@/lib/context";
import { evaluateProfile, summarize } from "@/lib/info/engine";
import { GROUP_LABELS, ONBOARDING_STEPS } from "@/lib/info/registry";
import { buildRecommendations } from "@/lib/recommendations";
import { recommendedPhase } from "@/lib/workflow/phases";
import { OPEN_TASK_STATUSES } from "@/lib/constants";

export const metadata = { title: "Your business status" };

export default async function OnboardingSummary() {
  const user = await requireUser();
  const ctx = await loadContext(user.id);
  const phase = recommendedPhase(ctx);
  const recs = buildRecommendations(ctx, 4);
  const firstTasks = ctx.tasks.filter((t) => t.source === "template" && OPEN_TASK_STATUSES.includes(t.status)).slice(0, 6);
  const steps = ONBOARDING_STEPS.map((s) => ({ s, sum: summarize(evaluateProfile(ctx, [s])) }));
  const all = summarize(evaluateProfile(ctx));

  return (
    <div>
      <PageHeader
        eyebrow="Onboarding complete"
        title={`${ctx.profile.artistName ?? "Your"} business at a glance`}
        purpose="Here is what the system knows, what is still missing, and where to start."
        actions={<LinkButton href="/dashboard" variant="primary">Open dashboard <ArrowRight className="h-4 w-4" /></LinkButton>}
      />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Information status" description={`${all.requiredComplete} of ${all.requiredTotal} required items complete`} />
          <Progress value={all.percent} className="mb-5" />
          <ul className="space-y-2.5">
            {steps.map(({ s, sum }) => (
              <li key={s} className="flex items-center justify-between gap-3 text-sm">
                <span className="flex items-center gap-2">
                  {sum.missingRequired ? <CircleDashed className="h-4 w-4 text-warning" /> : <CheckCircle2 className="h-4 w-4 text-success" />}
                  {GROUP_LABELS[s].title}
                </span>
                {sum.missingRequired ? (
                  <Link href={`/onboarding?step=${s}`} className="text-xs text-warning hover:underline">
                    {sum.missingRequired} missing
                  </Link>
                ) : (
                  <Badge tone="success">Complete</Badge>
                )}
              </li>
            ))}
          </ul>
        </Card>
        <Card>
          <CardHeader title="Recommended next phase" />
          <div className="text-xs uppercase tracking-[0.2em] text-accent-strong">Phase {phase.number}</div>
          <h3 className="mt-1 text-xl font-extralight">{phase.title}</h3>
          <p className="mt-2 text-sm text-muted">{phase.objective}</p>
          <LinkButton href={phase.href} variant="outline" className="mt-4">
            Open phase
          </LinkButton>
          <h4 className="mb-2 mt-6 text-xs uppercase tracking-[0.16em] text-faint">First tasks created</h4>
          <ul className="space-y-1.5 text-sm">
            {firstTasks.map((t) => (
              <li key={t.id}>
                <Link href={`/tasks/${t.id}`} className="text-muted hover:text-fg">
                  • {t.title}
                </Link>
              </li>
            ))}
          </ul>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader title="What should I do next?" />
          <ol className="grid gap-4 md:grid-cols-2">
            {recs.map((r, i) => (
              <li key={r.id} className="rounded-md border border-line bg-surface-2 p-4">
                <div className="text-xs text-accent-strong">0{i + 1}</div>
                <div className="mt-1 text-sm text-fg">{r.title}</div>
                <p className="mt-1 text-xs text-muted">{r.why}</p>
                <LinkButton href={r.href} size="sm" variant="outline" className="mt-3">
                  {r.actionLabel}
                </LinkButton>
              </li>
            ))}
          </ol>
        </Card>
      </div>
    </div>
  );
}
