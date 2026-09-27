import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq, inArray } from "drizzle-orm";
import { Check, ExternalLink, FileAudio, Pencil, Plus, Trash2 } from "lucide-react";
import { StageTimeline } from "@/components/catalog/stage-timeline";
import { TrackForm } from "@/components/catalog/track-form";
import { UploadField } from "@/components/documents/upload-field";
import { QuestionFlow } from "@/components/info/question-flow";
import { ConfirmAction, InlineAction } from "@/components/ui/form";
import { FormModal } from "@/components/ui/form-modal";
import { EntityForm } from "@/components/ui/entity-form";
import { Badge, buttonClass, Card, CardHeader, DemoBadge, EmptyState, KeyValue, LinkButton, LinkTabs, Notice, PageHeader, StatusBadge, Table, Td, Th } from "@/components/ui/primitives";
import {
  addCollaborator,
  addFeedback,
  addVersion,
  deleteSplit,
  deleteTrack,
  deleteVersion,
  removeCollaborator,
  saveRights,
  saveSplit,
  setVersionApproval,
  toggleFeedback,
} from "@/lib/actions/catalog";
import { requireUser } from "@/lib/auth";
import { OPEN_TASK_STATUSES, RIGHTS_STATUS_OPTIONS, TRACK_STATUSES, TRACK_WORKFLOW, VERSION_KINDS } from "@/lib/constants";
import { loadContext } from "@/lib/context";
import { db } from "@/lib/db";
import { analyticsRecords, documents } from "@/lib/db/schema";
import { profitability } from "@/lib/finance";
import { COLLABORATOR_FIELDS, FEEDBACK_FIELDS, RIGHTS_FIELDS, SPLIT_FIELDS, TRACK_FIELDS, VERSION_FIELDS, withOptions } from "@/lib/forms";
import { evaluateTrack, summarize } from "@/lib/info/engine";
import { toQuestions } from "@/lib/info/questions";
import { summarizeSplits, splitsByType } from "@/lib/rights";
import { formatDate, formatDateTime, formatDuration, formatMoney, formatNumber, titleCase } from "@/lib/utils";

const TABS = ["overview", "assets", "credits", "rights", "feedback", "connections"] as const;

export default async function TrackPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const { tab: t } = await searchParams;
  const ctx = await loadContext(user.id);
  const track = ctx.tracks.find((x) => x.id === id);
  if (!track) notFound();
  const tab = (TABS as readonly string[]).includes(t ?? "") ? (t as (typeof TABS)[number]) : "overview";
  const items = evaluateTrack(ctx, track, { forRelease: track.releaseIds.length > 0 });
  const sum = summarize(items);
  const workflow = ctx.settings.trackWorkflow.length ? ctx.settings.trackWorkflow : TRACK_WORKFLOW;
  const contactOptions = ctx.contacts.map((c) => ({ value: c.id, label: `${c.name}${c.role ? ` (${c.role})` : ""}` }));
  const docIds = track.versions.map((v) => v.documentId).filter(Boolean) as string[];
  const docs = docIds.length ? await db.select().from(documents).where(and(eq(documents.userId, user.id), inArray(documents.id, docIds))) : [];
  const trackDocs = ctx.documents.filter((d) => d.trackId === track.id);
  const agreementOptions = trackDocs.filter((d) => ["contract", "split_sheet", "license"].includes(d.category)).map((d) => ({ value: d.id, label: d.title }));

  const tabs = TABS.map((k) => ({
    key: k,
    href: `/catalog/${track.id}?tab=${k}`,
    label:
      k === "rights" ? (
        <span className="flex items-center gap-2">
          Rights {items.filter((i) => i.group === "rights" && i.required && i.status !== "complete" && i.status !== "not_applicable").length > 0 && <Badge tone="warning">!</Badge>}
        </span>
      ) : (
        titleCase(k)
      ),
  }));

  return (
    <div>
      <PageHeader
        eyebrow={
          <span className="flex items-center gap-2">
            <Link href="/catalog" className="hover:text-fg">Music Catalog</Link> / {track.projectCode} {track.isDemo && <DemoBadge />}
          </span>
        }
        title={track.title}
        purpose={[track.primaryArtist, track.featuredArtists.length ? `feat. ${track.featuredArtists.join(", ")}` : "", track.genre, track.bpm ? `${track.bpm} BPM` : "", track.musicalKey, formatDuration(track.durationSec)].filter((x) => x && x !== "—").join(" · ")}
        actions={
          <>
            <StatusBadge status={track.status} tone={track.status === "Finished" ? "success" : "accent"} />
            {!track.releaseIds.length && <LinkButton href={`/releases/new?track=${track.id}`} variant="outline">Plan release</LinkButton>}
            <ConfirmAction
              action={deleteTrack}
              fields={{ id: track.id }}
              label="Delete"
              title="Delete this track?"
              message="The track, its versions, credits, splits, rights record and feedback will be deleted. Linked releases, campaigns and documents are kept. This cannot be undone."
              confirmLabel="Delete track"
              size="md"
              icon={<Trash2 className="h-4 w-4" />}
            />
          </>
        }
      />
      <Card className="mb-6">
        <StageTimeline trackId={track.id} stages={workflow} current={track.workflowStage} />
      </Card>
      <LinkTabs tabs={tabs} active={tab} />

      {tab === "overview" && (
        <div className="grid gap-6 xl:grid-cols-3">
          <div className="space-y-6 xl:col-span-2">
            {sum.missingRequired > 0 && (
              <Card>
                <CardHeader title="Missing information" description={`${sum.missingRequired} required item(s) — only what’s missing is asked.`} />
                <QuestionFlow {...toQuestions(items)} submitLabel="Save answers" />
              </Card>
            )}
            <Card>
              <CardHeader title="Track details" />
              <TrackForm
                id={track.id}
                defs={withOptions(TRACK_FIELDS, { status: [...TRACK_STATUSES, ...(ctx.settings.customStatuses.track ?? [])] })}
                values={track as unknown as Record<string, unknown>}
              />
            </Card>
          </div>
          <div className="space-y-6">
            <Card>
              <CardHeader title="Readiness" description={sum.missingRequired ? `${sum.requiredComplete}/${sum.requiredTotal} required items` : "All required information complete"} />
              <ul className="space-y-2 text-sm">
                {items
                  .filter((i) => i.required || i.status !== "missing")
                  .filter((i) => !i.editable)
                  .map((i) => (
                    <li key={i.uid} className="flex items-center justify-between gap-3">
                      <Link href={i.href} className="min-w-0 truncate text-muted hover:text-fg" title={i.message}>{i.label}</Link>
                      <StatusBadge status={i.status} />
                    </li>
                  ))}
              </ul>
            </Card>
            <Card>
              <CardHeader title="Record" />
              <KeyValue
                items={[
                  { label: "Created", value: formatDateTime(track.createdAt) },
                  { label: "Updated", value: formatDateTime(track.updatedAt) },
                  { label: "Planned release", value: formatDate(track.plannedReleaseDate) },
                  { label: "Actual release", value: formatDate(track.actualReleaseDate) },
                ]}
              />
            </Card>
          </div>
        </div>
      )}

      {tab === "assets" && (
        <Card>
          <CardHeader
            title="Audio & creative assets"
            description="Demos, project files, stems, mixes, masters, artwork and clips. Large files are stored securely; you can also link to cloud storage."
            action={
              <FormModal
                label="Add version"
                title="Add a version or asset"
                action={addVersion}
                defs={VERSION_FIELDS}
                hidden={{ trackId: track.id }}
                values={{ kind: "mix" }}
                variant="primary"
                icon={<Plus className="h-4 w-4" />}
                before={<UploadField params={{ trackId: track.id, category: "audio" }} label="Upload file" />}
              />
            }
          />
          {track.versions.length ? (
            <div className="space-y-6">
              {VERSION_KINDS.filter((k) => track.versions.some((v) => v.kind === k.value)).map((k) => (
                <div key={k.value}>
                  <h3 className="mb-2 text-[11px] uppercase tracking-[0.16em] text-faint">{k.label}</h3>
                  <ul className="divide-y divide-line rounded-lg border border-line">
                    {track.versions
                      .filter((v) => v.kind === k.value)
                      .map((v) => {
                        const doc = docs.find((d) => d.id === v.documentId);
                        return (
                          <li key={v.id} className="flex flex-col gap-3 p-3 md:flex-row md:items-center">
                            <FileAudio className="hidden h-4 w-4 shrink-0 text-faint md:block" />
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2 text-sm">
                                {v.label}
                                {v.approved && <Badge tone="success"><Check className="h-3 w-3" /> Approved {formatDate(v.approvedAt?.toISOString())}</Badge>}
                              </div>
                              <div className="text-xs text-faint">
                                {doc ? `${doc.fileName} · ${formatNumber((doc.sizeBytes ?? 0) / 1024 / 1024, 1)} MB · v${doc.version}` : v.externalUrl ? "External link" : "No file"} · added {formatDate(v.createdAt.toISOString())}
                                {v.notes && ` · ${v.notes}`}
                              </div>
                              {doc?.mimeType?.startsWith("audio/") && <audio controls preload="none" src={`/api/files/${doc.id}`} className="mt-2 h-8 w-full max-w-md" />}
                            </div>
                            <div className="flex shrink-0 flex-wrap gap-1">
                              {doc && <a href={`/api/files/${doc.id}?download=1`} className={buttonClass("ghost", "sm")}>Download</a>}
                              {v.externalUrl && (
                                <a href={v.externalUrl} target="_blank" rel="noopener noreferrer" className="inline-flex h-8 items-center gap-1 px-3 text-xs text-muted hover:text-fg">
                                  Open <ExternalLink className="h-3 w-3" />
                                </a>
                              )}
                              {v.approved ? (
                                <InlineAction action={setVersionApproval} fields={{ id: v.id, approve: "0" }}>Remove approval</InlineAction>
                              ) : (
                                <ConfirmAction
                                  action={setVersionApproval}
                                  fields={{ id: v.id, approve: "1" }}
                                  label="Approve"
                                  title={`Approve “${v.label}”?`}
                                  message={v.kind === "master" ? "Approving marks this as the final master used for release. Only approve after you have listened to the final file." : "Mark this version as approved."}
                                  confirmLabel="Approve"
                                  variant="outline"
                                />
                              )}
                              <ConfirmAction action={deleteVersion} fields={{ id: v.id }} label="Remove" title="Remove this version?" message="The version entry is removed. Uploaded files remain in Documents & Assets." size="icon" variant="ghost" icon={<Trash2 className="h-3.5 w-3.5" />} />
                            </div>
                          </li>
                        );
                      })}
                  </ul>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState compact title="No versions yet." description="Upload a demo, mix or master — or link to where it’s stored." />
          )}
        </Card>
      )}

      {tab === "credits" && (
        <Card>
          <CardHeader
            title="Credits & collaborators"
            description={track.hasCollaborators === "no" ? "Marked as a solo work (no collaborators)." : track.hasCollaborators === "unknown" ? "Not yet confirmed whether collaborators were involved." : "Everyone who contributed to this track."}
            action={
              <FormModal
                label="Add collaborator"
                title="Add collaborator"
                action={addCollaborator}
                defs={withOptions(COLLABORATOR_FIELDS, { contactId: contactOptions })}
                hidden={{ trackId: track.id }}
                values={{ credited: true }}
                variant="primary"
                icon={<Plus className="h-4 w-4" />}
              />
            }
          />
          {track.collaborators.length ? (
            <Table>
              <thead><tr><Th>Name</Th><Th>Role</Th><Th>Credited</Th><Th>Notes</Th><Th /></tr></thead>
              <tbody>
                {track.collaborators.map((c) => (
                  <tr key={c.id}>
                    <Td>{c.contactId ? <Link href={`/contacts/${c.contactId}`} className="hover:text-accent-strong">{c.name}</Link> : c.name}</Td>
                    <Td>{c.role}</Td>
                    <Td>{c.credited ? "Yes" : "No"}</Td>
                    <Td className="text-xs text-muted">{c.notes}</Td>
                    <Td className="text-right"><ConfirmAction action={removeCollaborator} fields={{ id: c.id }} label="Remove" title={`Remove ${c.name}?`} message="This removes the credit from the track. Ownership splits are not changed." size="icon" variant="ghost" icon={<Trash2 className="h-3.5 w-3.5" />} /></Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          ) : (
            <EmptyState compact title="No collaborators recorded." description="If you made this track alone, set “Collaborators involved?” to No in the track details." />
          )}
        </Card>
      )}

      {tab === "rights" && (
        <div className="space-y-6">
          <Notice title="Ownership is documented, never assumed">
            Producing a track does not automatically mean owning all rights. Record who owns the composition and the master, and attach split sheets or agreements. This app organises information — it does not provide legal advice or register anything on your behalf.
          </Notice>
          {(["composition", "master"] as const).map((type) => {
            const list = splitsByType(track.splits)[type];
            const s = summarizeSplits(list);
            return (
              <Card key={type}>
                <CardHeader
                  title={type === "composition" ? "Composition (publishing) ownership" : "Master recording ownership"}
                  description={
                    <span className="flex flex-wrap items-center gap-2">
                      Total <strong className={s.total === 100 ? "text-success" : "text-warning"}>{s.total}%</strong>
                      <StatusBadge status={s.status === "complete" ? "complete" : s.status === "missing" ? "missing" : s.status === "unconfirmed" ? "needs_confirmation" : "invalid"} />
                    </span>
                  }
                  action={
                    <FormModal
                      label="Add rights holder"
                      title={`Add ${type} rights holder`}
                      action={saveSplit}
                      defs={withOptions(SPLIT_FIELDS, { contactId: contactOptions, agreementDocumentId: agreementOptions })}
                      hidden={{ trackId: track.id }}
                      values={{ rightType: type, percentage: list.length ? Math.max(0, Math.round((100 - s.total) * 1000) / 1000) : 100, holderName: list.length ? "" : (ctx.profile.legalName ?? ctx.profile.artistName ?? "") }}
                      variant="outline"
                      size="sm"
                      icon={<Plus className="h-3.5 w-3.5" />}
                    />
                  }
                />
                {s.issues.length > 0 && <Notice tone="warning" className="mb-4" title="Needs attention">{s.issues.join(" ")}</Notice>}
                {list.length ? (
                  <Table>
                    <thead><tr><Th>Rights holder</Th><Th>Role</Th><Th>Share</Th><Th>Confirmed</Th><Th>Agreement</Th><Th /></tr></thead>
                    <tbody>
                      {list.map((sp) => (
                        <tr key={sp.id}>
                          <Td>{sp.holderName}</Td>
                          <Td className="text-muted">{sp.role ?? "—"}</Td>
                          <Td>{sp.percentage}%</Td>
                          <Td>{sp.confirmed ? <Badge tone="success">Confirmed</Badge> : <Badge tone="warning">Unconfirmed</Badge>}</Td>
                          <Td className="text-xs">{sp.agreementDocumentId ? <a href={`/api/files/${sp.agreementDocumentId}`} className="hover:text-accent-strong">{trackDocs.find((d) => d.id === sp.agreementDocumentId)?.title ?? "Document"}</a> : <span className="text-faint">None</span>}</Td>
                          <Td className="whitespace-nowrap text-right">
                            <FormModal
                              label="Edit"
                              title="Edit share"
                              action={saveSplit}
                              defs={withOptions(SPLIT_FIELDS, { contactId: contactOptions, agreementDocumentId: agreementOptions })}
                              hidden={{ trackId: track.id, id: sp.id }}
                              values={sp as unknown as Record<string, unknown>}
                              variant="ghost"
                              size="icon"
                              icon={<Pencil className="h-3.5 w-3.5" />}
                            />
                            <ConfirmAction action={deleteSplit} fields={{ id: sp.id }} label="Remove" title={`Remove ${sp.holderName}’s share?`} message="Removing a share changes the ownership record. This is logged in the audit trail." size="icon" variant="ghost" icon={<Trash2 className="h-3.5 w-3.5" />} />
                          </Td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                ) : (
                  <EmptyState compact title="No rights holders recorded." description="Add every owner and their share — the total must equal 100%." />
                )}
              </Card>
            );
          })}
          <Card>
            <CardHeader
              title="Samples, agreements & registrations"
              description={`Registration status: copyright ${RIGHTS_STATUS_OPTIONS.registration.find((o) => o.value === track.rights?.copyrightRegistration)?.label ?? "Not started"} · PRO ${RIGHTS_STATUS_OPTIONS.registration.find((o) => o.value === track.rights?.proRegistration)?.label ?? "Not started"}`}
            />
            <EntityForm action={saveRights} defs={RIGHTS_FIELDS} values={(track.rights ?? {}) as Record<string, unknown>} hidden={{ trackId: track.id }} submitLabel="Save rights information" />
          </Card>
          <Card>
            <CardHeader title="Rights documents" description="Contracts, split sheets and licences linked to this track." action={<LinkButton href={`/documents?upload=1&trackId=${track.id}&category=split_sheet`} size="sm" variant="outline">Upload document</LinkButton>} />
            {trackDocs.filter((d) => ["contract", "split_sheet", "license"].includes(d.category)).length ? (
              <ul className="space-y-1.5 text-sm">
                {trackDocs.filter((d) => ["contract", "split_sheet", "license"].includes(d.category)).map((d) => (
                  <li key={d.id}><Link href={`/documents?doc=${d.id}`} className="hover:text-accent-strong">{d.title}</Link> <span className="text-xs text-faint">· {titleCase(d.category)}</span></li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted">No rights documents yet.</p>
            )}
          </Card>
        </div>
      )}

      {tab === "feedback" && (
        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader title="Feedback" description={`${track.feedback.filter((f) => !f.resolved).length} open`} />
            {track.feedback.length ? (
              <ul className="divide-y divide-line">
                {track.feedback.map((f) => (
                  <li key={f.id} className="flex items-start gap-3 py-3">
                    <InlineAction action={toggleFeedback} fields={{ id: f.id }} size="icon" title={f.resolved ? "Reopen" : "Mark resolved"}>
                      {f.resolved ? <Check className="h-4 w-4 text-success" /> : <span className="h-3.5 w-3.5 rounded-full border border-faint" />}
                    </InlineAction>
                    <div className={f.resolved ? "text-faint line-through" : ""}>
                      <p className="whitespace-pre-line text-sm">{f.note}</p>
                      <p className="mt-0.5 text-xs text-faint">{f.source} · {formatDate(f.createdAt.toISOString())}</p>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState compact title="No feedback yet." />
            )}
          </Card>
          <Card>
            <CardHeader title="Add feedback" />
            <EntityForm action={addFeedback} defs={FEEDBACK_FIELDS} hidden={{ trackId: track.id }} columns={1} resetOnSuccess submitLabel="Add" />
          </Card>
        </div>
      )}

      {tab === "connections" && <Connections trackId={track.id} userId={user.id} />}
    </div>
  );
}

async function Connections({ trackId, userId }: { trackId: string; userId: string }) {
  const ctx = await loadContext(userId);
  const track = ctx.tracks.find((t) => t.id === trackId)!;
  const rels = ctx.releases.filter((r) => track.releaseIds.includes(r.id));
  const camps = ctx.campaigns.filter((c) => c.trackId === trackId || (c.releaseId && track.releaseIds.includes(c.releaseId)));
  const content = ctx.content.filter((c) => c.trackId === trackId);
  const tasks = ctx.tasks.filter((t) => t.trackId === trackId);
  const docs = ctx.documents.filter((d) => d.trackId === trackId);
  const fin = profitability(ctx.transactions, ctx.settings.currency, "trackId", trackId);
  const metrics = await db.select().from(analyticsRecords).where(and(eq(analyticsRecords.userId, userId), eq(analyticsRecords.trackId, trackId)));
  const block = (title: string, count: number, children: React.ReactNode, href?: string) => (
    <Card>
      <CardHeader title={`${title} (${count})`} action={href ? <LinkButton href={href} size="sm" variant="ghost">Add</LinkButton> : undefined} />
      {count ? children : <p className="text-sm text-muted">None linked.</p>}
    </Card>
  );
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {block("Releases", rels.length, <ul className="space-y-1.5 text-sm">{rels.map((r) => <li key={r.id}><Link href={`/releases/${r.id}`} className="hover:text-accent-strong">{r.title}</Link> <span className="text-xs text-faint">· {r.status} · {formatDate(r.releaseDate)}</span></li>)}</ul>, `/releases/new?track=${trackId}`)}
      {block("Campaigns", camps.length, <ul className="space-y-1.5 text-sm">{camps.map((c) => <li key={c.id}><Link href={`/marketing/${c.id}`} className="hover:text-accent-strong">{c.name}</Link> <span className="text-xs text-faint">· {c.status}</span></li>)}</ul>, `/marketing/new?track=${trackId}`)}
      {block("Content", content.length, <ul className="space-y-1.5 text-sm">{content.map((c) => <li key={c.id}><Link href={`/content/${c.id}`} className="hover:text-accent-strong">{c.title}</Link> <span className="text-xs text-faint">· {c.platform} · {c.stage}</span></li>)}</ul>, `/content/new?track=${trackId}`)}
      {block("Tasks", tasks.length, <ul className="space-y-1.5 text-sm">{tasks.map((t) => <li key={t.id}><Link href={`/tasks/${t.id}`} className={OPEN_TASK_STATUSES.includes(t.status) ? "hover:text-accent-strong" : "text-faint line-through"}>{t.title}</Link></li>)}</ul>, `/tasks/new?track=${trackId}`)}
      {block("Documents", docs.length, <ul className="space-y-1.5 text-sm">{docs.map((d) => <li key={d.id}><Link href={`/documents?doc=${d.id}`} className="hover:text-accent-strong">{d.title}</Link> <span className="text-xs text-faint">· {titleCase(d.category)}</span></li>)}</ul>, `/documents?upload=1&trackId=${trackId}`)}
      {block(
        "Financial records",
        fin.count,
        <KeyValue items={[{ label: "Income (actual)", value: formatMoney(fin.income, ctx.settings.currency) }, { label: "Expenses (actual)", value: formatMoney(fin.expenses, ctx.settings.currency) }, { label: "Net", value: formatMoney(fin.net, ctx.settings.currency) }]} />,
        `/finances/new?trackId=${trackId}`,
      )}
      {block("Performance records", metrics.length, <ul className="space-y-1.5 text-sm">{metrics.slice(0, 10).map((m) => <li key={m.id}>{titleCase(m.metric)}: {formatNumber(m.value, 2)} <span className="text-xs text-faint">· {m.platform} · {formatDate(m.periodEnd)} · {m.verification}</span></li>)}</ul>, `/analytics?add=1&trackId=${trackId}`)}
    </div>
  );
}
