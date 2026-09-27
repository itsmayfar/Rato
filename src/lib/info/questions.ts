import type { DerivedCheck, QuestionItem } from "@/components/info/question-flow";
import type { InfoItem } from "./engine";
import { GROUP_LABELS, getRequirement } from "./registry";

/** Split engine items into editable questions and derived checks for the QuestionFlow. */
export function toQuestions(items: InfoItem[], opts: { defaults?: Record<string, unknown> } = {}) {
  const questions: QuestionItem[] = [];
  const derived: DerivedCheck[] = [];
  for (const i of items) {
    if (!i.editable) {
      derived.push({ uid: i.uid, label: i.label, status: i.status, href: i.href, message: i.message, entityLabel: i.entityLabel, why: i.why });
      continue;
    }
    const req = getRequirement(i.requirementId!);
    if (!req) continue;
    const { id: _id, entity: _e, path: _p, group: _g, staleAfterDays: _s, unknownIsMissing: _u, ...def } = req;
    const fallback = i.status === "missing" ? opts.defaults?.[i.key] : undefined;
    questions.push({
      name: `${i.entityType}__${i.entityId}__${i.key}`,
      entityType: i.entityType,
      entityLabel: i.entityLabel,
      key: i.key,
      def: { ...def, why: i.why ?? def.why },
      value: fallback ?? i.value,
      status: i.status,
      message: i.message,
      required: i.required,
      group: i.group,
      groupTitle: GROUP_LABELS[i.group]?.title ?? i.group,
      groupDescription: GROUP_LABELS[i.group]?.description,
    });
  }
  return { items: questions, derived };
}
