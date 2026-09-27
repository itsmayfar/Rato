import Link from "next/link";
import { Pencil } from "lucide-react";
import { Badge, Card, CardHeader, LinkButton, PageHeader, Progress } from "@/components/ui/primitives";
import { requireUser } from "@/lib/auth";
import { loadContext } from "@/lib/context";
import { displayValue } from "@/lib/fields";
import { evaluateProfile, STATUS_LABEL, summarize } from "@/lib/info/engine";
import { GROUP_LABELS, ONBOARDING_STEPS, getRequirement } from "@/lib/info/registry";
import { toneFor, formatDateTime } from "@/lib/utils";

export const metadata = { title: "My Artist Profile" };

export default async function ProfilePage() {
  const user = await requireUser();
  const ctx = await loadContext(user.id);
  const p = ctx.profile;
  const all = summarize(evaluateProfile(ctx));

  return (
    <div>
      <PageHeader
        eyebrow="My Artist Profile"
        title={p.artistName ?? "Your artist profile"}
        purpose="Everything the system knows about you as an artist. Saved once, reused everywhere — in releases, credits, campaigns, outreach and the assistant."
        actions={<LinkButton href="/onboarding" variant="primary"><Pencil className="h-4 w-4" /> Edit profile</LinkButton>}
      />
      <div className="mb-6 grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <div className="flex flex-col gap-6 md:flex-row">
            {p.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={p.imageUrl} alt={`${p.artistName ?? "Artist"} portrait`} className="h-32 w-32 shrink-0 rounded-lg border border-line object-cover" />
            ) : (
              <div className="flex h-32 w-32 shrink-0 items-center justify-center rounded-lg border border-dashed border-line text-xs text-faint">No image</div>
            )}
            <div className="min-w-0">
              <div className="text-xs uppercase tracking-[0.2em] text-accent-strong">{p.brandConcept ?? "Brand concept not set"}</div>
              <h2 className="mt-1 text-2xl font-extralight">{p.brandPhrase ?? "—"}</h2>
              <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-muted">{p.bio ?? "No biography yet."}</p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {p.genres.map((g) => (
                  <Badge key={g}>{g}</Badge>
                ))}
              </div>
            </div>
          </div>
        </Card>
        <Card>
          <CardHeader title="Profile completeness" description={`${all.requiredComplete} of ${all.requiredTotal} required items`} />
          <Progress value={all.percent} className="mb-4" />
          <ul className="space-y-2 text-sm">
            {(["missing", "needs_confirmation", "outdated", "invalid"] as const).map((s) =>
              all.counts[s] ? (
                <li key={s} className="flex justify-between">
                  <Link href={`/information?status=${s}&entity=profile`} className="text-muted hover:text-fg">
                    {STATUS_LABEL[s]}
                  </Link>
                  <Badge tone={toneFor(s)}>{all.counts[s]}</Badge>
                </li>
              ) : null,
            )}
          </ul>
          <p className="mt-4 text-xs text-faint">Last updated {formatDateTime(p.updatedAt)}</p>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {ONBOARDING_STEPS.map((step) => {
          const items = evaluateProfile(ctx, [step]);
          const s = summarize(items);
          return (
            <Card key={step}>
              <CardHeader
                title={GROUP_LABELS[step].title}
                description={s.missingRequired ? `${s.missingRequired} required item(s) missing` : "Complete"}
                action={<LinkButton href={`/onboarding?step=${step}`} size="sm" variant="ghost"><Pencil className="h-3.5 w-3.5" /> Edit</LinkButton>}
              />
              <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
                {items
                  .filter((i) => i.status !== "missing" || i.required)
                  .map((i) => {
                    const req = getRequirement(i.requirementId!)!;
                    return (
                      <div key={i.uid} className="min-w-0">
                        <dt className="flex items-center gap-2 text-[11px] uppercase tracking-[0.12em] text-faint">
                          {i.label}
                          {i.status !== "complete" && <Badge tone={toneFor(i.status)}>{STATUS_LABEL[i.status]}</Badge>}
                        </dt>
                        <dd className="mt-0.5 line-clamp-3 break-words text-sm">
                          {req.type === "url" && i.value ? (
                            <a href={String(i.value)} target="_blank" rel="noopener noreferrer" className="text-fg underline decoration-line-strong underline-offset-2 hover:decoration-accent">
                              {String(i.value).replace(/^https?:\/\//, "")}
                            </a>
                          ) : (
                            displayValue(req, i.value)
                          )}
                        </dd>
                      </div>
                    );
                  })}
              </dl>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
