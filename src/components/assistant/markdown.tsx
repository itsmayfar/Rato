import Link from "next/link";
import { Fragment, type ReactNode } from "react";

/** Minimal, safe markdown: paragraphs, lists, **bold**, _italic_, `code`, and internal links. No HTML is ever injected. */
function inline(text: string, key: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)]+\)|_[^_]+_)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const t = m[0];
    const k = `${key}-${i++}`;
    if (t.startsWith("**")) out.push(<strong key={k} className="font-normal text-fg">{t.slice(2, -2)}</strong>);
    else if (t.startsWith("`")) out.push(<code key={k} className="rounded bg-surface-3 px-1 text-[0.9em]">{t.slice(1, -1)}</code>);
    else if (t.startsWith("_")) out.push(<em key={k}>{t.slice(1, -1)}</em>);
    else {
      const [, label, href] = /\[([^\]]+)\]\(([^)]+)\)/.exec(t)!;
      if (href.startsWith("/") && !href.startsWith("//")) out.push(<Link key={k} href={href} className="text-accent-strong underline underline-offset-2">{label}</Link>);
      else if (/^https?:\/\//.test(href)) out.push(<a key={k} href={href} target="_blank" rel="noopener noreferrer nofollow" className="text-accent-strong underline underline-offset-2">{label}</a>);
      else out.push(label);
    }
    last = m.index + t.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

const LIST = /^\s*([-*•]|\d+[.)])\s+/;

export function Markdown({ text }: { text: string }) {
  // Split into runs of list lines and text lines
  const runs: { list: boolean; ordered: boolean; lines: string[] }[] = [];
  for (const line of text.replace(/\r/g, "").split("\n")) {
    if (!line.trim()) {
      runs.push({ list: false, ordered: false, lines: [] });
      continue;
    }
    const isList = LIST.test(line);
    const last = runs[runs.length - 1];
    if (last && last.list === isList && last.lines.length) last.lines.push(line);
    else runs.push({ list: isList, ordered: isList && /^\s*\d/.test(line), lines: [line] });
  }
  return (
    <div className="space-y-2.5 text-sm leading-relaxed">
      {runs
        .filter((r) => r.lines.length)
        .map((r, ri) => {
          if (r.list) {
            const Tag = r.ordered ? "ol" : "ul";
            return (
              <Tag key={ri} className={r.ordered ? "list-decimal space-y-1 pl-5" : "list-disc space-y-1 pl-5"}>
                {r.lines.map((l, li) => <li key={li}>{inline(l.replace(LIST, ""), `${ri}-${li}`)}</li>)}
              </Tag>
            );
          }
          return (
            <Fragment key={ri}>
              {r.lines.map((l, li) =>
                /^#{1,4}\s/.test(l) ? (
                  <p key={li} className="pt-1 text-xs uppercase tracking-[0.14em] text-muted">{inline(l.replace(/^#+\s/, ""), `${ri}-${li}`)}</p>
                ) : (
                  <p key={li}>{inline(l, `${ri}-${li}`)}</p>
                ),
              )}
            </Fragment>
          );
        })}
    </div>
  );
}
