"use client";

import { EntityForm } from "@/components/ui/entity-form";
import { saveContact } from "@/lib/actions/contacts";
import { CONTACT_FIELDS } from "@/lib/forms";

export function ContactForm({ values, id }: { values?: Record<string, unknown>; id?: string }) {
  return <EntityForm action={saveContact} defs={CONTACT_FIELDS} values={values} hidden={{ id }} submitLabel={id ? "Save contact" : "Add contact"} />;
}
