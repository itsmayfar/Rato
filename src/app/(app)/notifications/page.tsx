import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { Bell, Check } from "lucide-react";
import { InlineAction } from "@/components/ui/form";
import { Badge, EmptyState, LinkButton, PageHeader } from "@/components/ui/primitives";
import { clearReadNotifications, markAllNotificationsRead, markNotificationRead } from "@/lib/actions/system";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { notifications } from "@/lib/db/schema";
import { cn, formatDateTime, titleCase } from "@/lib/utils";

export const metadata = { title: "Notifications" };

export default async function NotificationsPage() {
  const user = await requireUser();
  const list = await db.select().from(notifications).where(eq(notifications.userId, user.id)).orderBy(desc(notifications.createdAt)).limit(200);
  const unread = list.filter((n) => !n.readAt).length;
  return (
    <div className="max-w-4xl">
      <PageHeader
        eyebrow="Notifications"
        title={unread ? `${unread} unread` : "All caught up"}
        purpose="Reminders and summaries created by your automations. Configure them in Automations."
        actions={
          <>
            <LinkButton href="/automations" variant="ghost">Automations</LinkButton>
            {unread > 0 && <InlineAction action={markAllNotificationsRead} fields={{}} variant="outline" size="md">Mark all read</InlineAction>}
            <InlineAction action={clearReadNotifications} fields={{}} variant="ghost" size="md">Clear read</InlineAction>
          </>
        }
      />
      {list.length ? (
        <ul className="divide-y divide-line rounded-lg border border-line bg-surface">
          {list.map((n) => (
            <li key={n.id} className={cn("flex items-start gap-3 px-4 py-3", !n.readAt && "bg-accent-soft/40")}>
              <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", n.readAt ? "bg-transparent" : "bg-accent-strong")} aria-hidden />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  {n.link ? <Link href={n.link} className="hover:text-accent-strong">{n.title}</Link> : n.title}
                  <Badge>{titleCase(n.kind)}</Badge>
                </div>
                {n.body && <p className="mt-0.5 text-xs text-muted">{n.body}</p>}
                <p className="mt-0.5 text-[11px] text-faint">{formatDateTime(n.createdAt)}</p>
              </div>
              {!n.readAt && <InlineAction action={markNotificationRead} fields={{ id: n.id }} size="icon" title="Mark read"><Check className="h-3.5 w-3.5" /></InlineAction>}
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState icon={<Bell className="h-6 w-6" />} title="No notifications yet." description="Deadline reminders, overdue alerts and summaries will appear here." />
      )}
    </div>
  );
}
