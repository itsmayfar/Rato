import { ContactForm } from "@/components/marketing/contact-form";
import { Card, PageHeader } from "@/components/ui/primitives";
import { requireUser } from "@/lib/auth";

export const metadata = { title: "Add contact" };

export default async function NewContact({ searchParams }: { searchParams: Promise<{ team?: string; category?: string }> }) {
  await requireUser();
  const sp = await searchParams;
  return (
    <div className="max-w-4xl">
      <PageHeader eyebrow="Contacts & Networking" title="Add contact" />
      <Card>
        <ContactForm values={{ category: sp.category ?? (sp.team ? "Producer" : "Other"), pipelineStatus: sp.team ? "confirmed" : "potential", isTeamMember: sp.team === "1" }} />
      </Card>
    </div>
  );
}
