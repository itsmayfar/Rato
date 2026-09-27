import Link from "next/link";
import { QuestionFlow } from "@/components/info/question-flow";
import { GoalsManager } from "@/components/business/goals";
import { Badge, Card, CardHeader, LinkButton, LinkTabs, Notice, PageHeader } from "@/components/ui/primitives";
import { requireUser } from "@/lib/auth";
import { loadContext } from "@/lib/context";
import { evaluateProfile, summarize } from "@/lib/info/engine";
import { toQuestions } from "@/lib/info/questions";
import { formatMoney } from "@/lib/utils";

export const metadata = { title: "Business Setup" };

const TABS = [
  { key: "finances", label: "Budget & costs", group: "business" },
  { key: "goals", label: "Goals", group: "goals" },
  { key: "platforms", label: "Platforms & accounts", group: "platforms" },
  { key: "team", label: "Team", group: "team" },
  { key: "tools", label: "Tools & workflow", group: "tools" },
] as const;

export default async function BusinessPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const user = await requireUser();
  const ctx = await loadContext(user.id);
  const { tab: t } = await searchParams;
  const tab = TABS.find((x) => x.key === t) ?? TABS[0];
  const items = evaluateProfile(ctx, [tab.group]);
  const q = toQuestions(items);
  const team = ctx.contacts.filter((c) => c.isTeamMember);
  const b = ctx.profile.business ?? {};

  return (
    <div>
      <PageHeader
        eyebrow="Business Setup"
        title="How your business runs"
        purpose="Budget, goals, platforms, team and tools. This is the operating configuration the planning and recommendation engines work from."
      />
      <LinkTabs
        active={tab.key}
        tabs={TABS.map((x) => {
          const s = summarize(evaluateProfile(ctx, [x.group]));
          return {
            key: x.key,
            href: `/business?tab=${x.key}`,
            label: (
              <span className="flex items-center gap-2">
                {x.label}
                {s.missingRequired > 0 && <Badge tone="warning">{s.missingRequired}</Badge>}
              </span>
            ),
          };
        })}
      />

      {tab.key === "finances" && (
        <div className="mb-6 grid gap-4 md:grid-cols-3">
          <Card>
            <div className="text-[11px] uppercase tracking-[0.16em] text-faint">Monthly budget</div>
            <div className="mt-1 text-2xl font-extralight">{b.monthlyBudget !== undefined && b.monthlyBudget !== null ? formatMoney(b.monthlyBudget) : "—"}</div>
          </Card>
          <Card>
            <div className="text-[11px] uppercase tracking-[0.16em] text-faint">Marketing budget</div>
            <div className="mt-1 text-2xl font-extralight">{b.marketingBudget !== undefined && b.marketingBudget !== null ? formatMoney(b.marketingBudget) : "—"}</div>
          </Card>
          <Card>
            <div className="text-[11px] uppercase tracking-[0.16em] text-faint">Detailed budgets</div>
            <div className="mt-1 text-2xl font-extralight">{ctx.budgets.length}</div>
            <Link href="/finances?tab=budgets" className="text-xs text-muted hover:text-fg">
              Manage release & campaign budgets →
            </Link>
          </Card>
        </div>
      )}

      {tab.key === "goals" && (
        <Card className="mb-6">
          <CardHeader title="Measurable goals" description="Targets with a metric and a deadline. Quarterly and annual goals drive Phase 10." />
          <GoalsManager goals={ctx.goals} today={ctx.today} />
        </Card>
      )}

      {tab.key === "platforms" && (
        <Notice className="mb-6" title="Public links vs. connected accounts">
          Links below are public profile URLs. Authorised connections (API access for statistics) are managed separately in{" "}
          <Link href="/settings/integrations" className="text-fg underline decoration-accent underline-offset-2">
            Integrations
          </Link>
          .
        </Notice>
      )}

      {tab.key === "team" && (
        <Card className="mb-6">
          <CardHeader
            title="Team members"
            description="Contacts marked as part of your team."
            action={<LinkButton href="/contacts/new?team=1" size="sm" variant="outline">Add team member</LinkButton>}
          />
          {team.length ? (
            <ul className="grid gap-3 md:grid-cols-3">
              {team.map((c) => (
                <li key={c.id} className="rounded-md border border-line bg-surface-2 p-3">
                  <Link href={`/contacts/${c.id}`} className="text-sm hover:text-accent-strong">
                    {c.name}
                  </Link>
                  <div className="text-xs text-faint">{[c.role, c.category].filter(Boolean).join(" · ")}</div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">No team members yet.</p>
          )}
        </Card>
      )}

      {q.items.length > 0 && (
        <QuestionFlow key={tab.key} {...q} initiallyShowAll submitLabel="Save" />
      )}
    </div>
  );
}
