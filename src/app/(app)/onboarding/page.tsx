import Link from "next/link";
import { Check, Minus } from "lucide-react";
import { QuestionFlow } from "@/components/info/question-flow";
import { Card, LinkButton, Notice, PageHeader, Progress } from "@/components/ui/primitives";
import { requireUser } from "@/lib/auth";
import { completeOnboarding, skipOnboardingStep } from "@/lib/actions/workflow";
import { DEFAULT_BRAND } from "@/lib/constants";
import { loadContext } from "@/lib/context";
import { evaluateProfile, summarize } from "@/lib/info/engine";
import { toQuestions } from "@/lib/info/questions";
import { GROUP_LABELS, ONBOARDING_STEPS, type OnboardingStep } from "@/lib/info/registry";
import { buttonClass } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";

export const metadata = { title: "Onboarding" };

const WHY: Record<OnboardingStep, string> = {
  identity: "Your identity is reused everywhere: release metadata, credits, press kits and outreach drafts.",
  goals: "Goals let the system rank what matters most and turn ambitions into measurable targets.",
  music: "Your sound and audience shape metadata defaults, campaign targeting and content ideas.",
  catalog: "Knowing what exists lets us plan releases and spot missing rights information.",
  platforms: "Links power pre-saves, pitching and analytics. Connections with credentials are set up separately in Integrations.",
  business: "Optional. A basic budget lets campaign plans be checked against what you can actually spend.",
  team: "Collaborators affect credits, splits and agreements.",
  tools: "Your tools and availability shape reminders and planning periods.",
};

export default async function OnboardingPage({ searchParams }: { searchParams: Promise<{ step?: string }> }) {
  const user = await requireUser();
  const ctx = await loadContext(user.id);
  const sp = await searchParams;
  const firstOpen =
    ONBOARDING_STEPS.find((s) => !ctx.profile.onboardingSteps?.[s] && summarize(evaluateProfile(ctx, [s])).missingRequired > 0) ??
    ONBOARDING_STEPS[0];
  const step = (sp.step === "finish" ? "finish" : (ONBOARDING_STEPS as readonly string[]).includes(sp.step ?? "") ? sp.step : firstOpen) as
    | OnboardingStep
    | "finish";

  const stepInfo = ONBOARDING_STEPS.map((s) => {
    const sum = summarize(evaluateProfile(ctx, [s]));
    const state = ctx.profile.onboardingSteps?.[s];
    return { key: s, sum, state, done: state === "saved" && sum.missingRequired === 0 };
  });
  const doneCount = stepInfo.filter((s) => s.done || s.state === "skipped").length;
  const idx = step === "finish" ? ONBOARDING_STEPS.length : ONBOARDING_STEPS.indexOf(step);
  const nextStep = ONBOARDING_STEPS[idx + 1];

  return (
    <div>
      <PageHeader
        eyebrow={ctx.profile.onboardingCompletedAt ? "Edit your setup" : "Welcome"}
        title="Set up your artist business"
        purpose="Eight short steps. Answer what you can, skip what doesn’t apply — everything can be edited later and nothing is asked twice."
        actions={<LinkButton href="/dashboard" variant="ghost">Continue later</LinkButton>}
      />
      <div className="grid gap-8 lg:grid-cols-[260px_1fr]">
        <nav aria-label="Onboarding steps" className="lg:sticky lg:top-24 lg:self-start">
          <Progress value={doneCount} max={ONBOARDING_STEPS.length} className="mb-4" label="Onboarding progress" />
          <ol className="space-y-1">
            {stepInfo.map((s, i) => (
              <li key={s.key}>
                <Link
                  href={`/onboarding?step=${s.key}`}
                  aria-current={s.key === step ? "step" : undefined}
                  className={cn(
                    "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                    s.key === step ? "bg-surface-3 text-fg" : "text-muted hover:bg-surface-2 hover:text-fg",
                  )}
                >
                  <span
                    className={cn(
                      "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[11px]",
                      s.done ? "border-success/50 text-success" : s.state === "skipped" ? "border-line text-faint" : s.key === step ? "border-accent-strong text-accent-strong" : "border-line-strong",
                    )}
                  >
                    {s.done ? <Check className="h-3 w-3" /> : s.state === "skipped" ? <Minus className="h-3 w-3" /> : i + 1}
                  </span>
                  <span className="min-w-0 flex-1 truncate">{GROUP_LABELS[s.key].title}</span>
                  {s.sum.missingRequired > 0 && s.state !== "skipped" && <span className="text-[11px] text-faint">{s.sum.missingRequired}</span>}
                </Link>
              </li>
            ))}
            <li>
              <Link
                href="/onboarding?step=finish"
                className={cn("flex items-center gap-3 rounded-md px-3 py-2 text-sm", step === "finish" ? "bg-surface-3 text-fg" : "text-muted hover:text-fg")}
              >
                <span className="flex h-6 w-6 items-center justify-center rounded-full border border-line-strong text-[11px]">✓</span>
                Finish
              </Link>
            </li>
          </ol>
        </nav>

        <div className="min-w-0 animate-fade-in" key={step}>
          {step === "finish" ? (
            <Card>
              <h2 className="text-xl font-extralight">Ready to generate your business dashboard</h2>
              <p className="mt-2 text-sm text-muted">
                Finishing starts <strong className="text-fg">Phase 1 — Artist Foundation</strong>, creates your first recommended tasks and shows a
                summary of what’s complete and what’s still missing. You can return here at any time.
              </p>
              {stepInfo.some((s) => s.sum.missingRequired > 0) && (
                <Notice tone="warning" className="mt-4" title="Some required information is still missing">
                  {stepInfo
                    .filter((s) => s.sum.missingRequired > 0)
                    .map((s) => `${GROUP_LABELS[s.key].title} (${s.sum.missingRequired})`)
                    .join(" · ")}
                  . You can finish now — missing items will appear as recommendations.
                </Notice>
              )}
              <form action={completeOnboarding} className="mt-6">
                <button type="submit" className={buttonClass("primary", "lg")}>
                  Finish onboarding
                </button>
              </form>
            </Card>
          ) : (
            <>
              <div className="mb-6">
                <div className="text-xs uppercase tracking-[0.2em] text-accent-strong">
                  Step {idx + 1} of {ONBOARDING_STEPS.length}
                </div>
                <h2 className="mt-1 text-2xl font-extralight">{GROUP_LABELS[step].title}</h2>
                <p className="mt-1 max-w-2xl text-sm text-muted">{WHY[step]}</p>
              </div>
              {step === "team" && (
                <Notice className="mb-6" title="Add people individually">
                  Collaborators you add in{" "}
                  <Link href="/contacts/new?team=1" className="text-fg underline decoration-accent underline-offset-2">
                    Contacts
                  </Link>{" "}
                  (marked as team) are reused for credits, splits and outreach. {ctx.contacts.filter((c) => c.isTeamMember).length} team member(s) saved.
                </Notice>
              )}
              {step === "catalog" && (
                <Notice className="mb-6" title="Import your catalog">
                  You can add tracks one by one or{" "}
                  <Link href="/import/tracks" className="text-fg underline decoration-accent underline-offset-2">
                    import a CSV
                  </Link>
                  .
                </Notice>
              )}
              <QuestionFlow
                key={step}
                {...toQuestions(evaluateProfile(ctx, [step]), { defaults: step === "identity" ? { ...DEFAULT_BRAND } : undefined })}
                next={`/onboarding?step=${nextStep ?? "finish"}`}
                submitLabel={nextStep ? "Save & continue" : "Save & review"}
                skipAction={
                  <button type="submit" formAction={skipOnboardingStep} formNoValidate className={buttonClass("ghost")}>
                    Skip this step
                  </button>
                }
                extraHidden={{ __step: step }}
                initiallyShowAll={stepInfo[idx].sum.missingRequired === 0}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
