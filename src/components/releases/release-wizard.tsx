"use client";

import { useState } from "react";
import { ActionForm, FieldInput, SubmitButton, useFieldError } from "@/components/ui/form";
import { createRelease } from "@/lib/actions/releases";
import { DISTRIBUTORS, RELEASE_TYPES } from "@/lib/constants";
import { PREFERENCE_LABELS } from "@/lib/releases/checklist";
import { cn } from "@/lib/utils";

type TrackOpt = { id: string; title: string; status: string; hasMaster: boolean; released: boolean };

function Step({ n, title, hint, children }: { n: number; title: string; hint?: string; children: React.ReactNode }) {
  return (
    <fieldset className="rounded-lg border border-line bg-surface p-5">
      <legend className="flex items-center gap-2 px-2 text-sm">
        <span className="flex h-6 w-6 items-center justify-center rounded-full border border-accent-strong text-xs text-accent-strong">{n}</span>
        {title}
      </legend>
      {hint && <p className="-mt-1 mb-4 text-xs text-faint">{hint}</p>}
      {children}
    </fieldset>
  );
}

function TrackPicker({ tracks, preselected, onTitle }: { tracks: TrackOpt[]; preselected?: string; onTitle: (t: string) => void }) {
  const error = useFieldError("trackIds");
  return (
    <div>
      {tracks.length > 0 ? (
        <ul className="grid gap-2 md:grid-cols-2">
          {tracks.map((t) => (
            <li key={t.id}>
              <label className="flex cursor-pointer items-center gap-3 rounded-md border border-line px-3 py-2 text-sm has-[:checked]:border-accent has-[:checked]:bg-accent-soft">
                <input type="checkbox" name="trackIds" value={t.id} defaultChecked={t.id === preselected} className="accent-[var(--accent)]" onChange={(e) => e.target.checked && onTitle(t.title)} />
                <span className="min-w-0 flex-1 truncate">{t.title}</span>
                <span className={cn("text-[11px]", t.hasMaster ? "text-success" : "text-faint")}>{t.hasMaster ? "master ✓" : t.status}</span>
              </label>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted">Your catalog is empty — name the new track below.</p>
      )}
      <div className="mt-4 max-w-md">
        <FieldInput def={{ key: "newTrackTitle", label: "…or create a new track", type: "text", placeholder: "Track title" }} />
      </div>
      {error && <p className="mt-1 text-xs text-danger">Choose a track or name a new one.</p>}
    </div>
  );
}

export function ReleaseWizard({ tracks, preselected, defaults }: { tracks: TrackOpt[]; preselected?: string; defaults: { artist: string; distributor: string; releaseDate: string } }) {
  const pre = tracks.find((t) => t.id === preselected);
  const [title, setTitle] = useState(pre?.title ?? "");
  return (
    <ActionForm action={createRelease} className="space-y-6">
      <Step n={1} title="Associated tracks" hint="Choose from your catalog — metadata already saved there is reused.">
        <TrackPicker tracks={tracks} preselected={preselected} onTitle={(t) => !title && setTitle(t)} />
      </Step>
      <Step n={2} title="Release basics">
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label htmlFor="rel-title" className="mb-1.5 block text-xs uppercase tracking-[0.12em] text-muted">Release title <span className="text-accent-strong">*</span></label>
            <input id="rel-title" name="title" value={title} onChange={(e) => setTitle(e.target.value)} className="w-full rounded-md border border-line bg-surface-2 px-3 py-2 text-sm focus:border-accent focus:outline-none" />
          </div>
          <FieldInput def={{ key: "releaseType", label: "Release type", type: "select", options: RELEASE_TYPES, required: true }} value="single" />
        </div>
      </Step>
      <Step n={3} title="Artist credits" hint="Defaults to your artist profile.">
        <div className="grid gap-4 md:grid-cols-2">
          <FieldInput def={{ key: "primaryArtist", label: "Primary artist", type: "text" }} value={defaults.artist} />
          <FieldInput def={{ key: "featuredArtists", label: "Featured artists", type: "tags" }} />
        </div>
      </Step>
      <Step n={4} title="Planned release date" hint="Leave empty if not decided yet — you’ll be asked later. Aim for at least 4 weeks ahead to allow editorial pitching.">
        <div className="max-w-xs"><FieldInput def={{ key: "releaseDate", label: "Release date", type: "date" }} value={defaults.releaseDate} /></div>
      </Step>
      <Step n={5} title="Release strategy">
        <FieldInput def={{ key: "strategy", label: "What is the story and goal of this release?", type: "textarea" }} />
      </Step>
      <Step n={6} title="Distributor">
        <div className="max-w-md"><FieldInput def={{ key: "distributor", label: "Distributor", type: "select", options: DISTRIBUTORS, allowCustom: true }} value={defaults.distributor} /></div>
      </Step>
      <Step n={7} title="Assets & campaign preferences" hint="Only the steps you choose are added to the checklist.">
        <div className="grid gap-2 md:grid-cols-2">
          {(Object.keys(PREFERENCE_LABELS) as (keyof typeof PREFERENCE_LABELS)[]).map((k) => (
            <label key={k} className="flex cursor-pointer items-center gap-2 text-sm">
              <input type="checkbox" name={`pref_${k}`} defaultChecked={k === "campaign" || k === "pitching"} className="accent-[var(--accent)]" />
              {PREFERENCE_LABELS[k]}
            </label>
          ))}
        </div>
      </Step>
      <div className="flex items-center gap-3">
        <SubmitButton size="lg">Create release & check requirements</SubmitButton>
        <span className="text-xs text-faint">Next, you’ll only be asked for the information that is still missing.</span>
      </div>
    </ActionForm>
  );
}
