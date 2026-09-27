import { cookies } from "next/headers";
import { and, count, eq, isNull } from "drizzle-orm";
import { AppShell } from "@/components/shell/app-shell";
import { requireUser } from "@/lib/auth";
import { logout } from "@/lib/actions/auth";
import { getSettings } from "@/lib/context";
import { db } from "@/lib/db";
import { notifications, tracks, transactions } from "@/lib/db/schema";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const settings = await getSettings(user.id);
  const [[unread], [demoTracks], [demoTx]] = await Promise.all([
    db.select({ n: count() }).from(notifications).where(and(eq(notifications.userId, user.id), isNull(notifications.readAt))),
    db.select({ n: count() }).from(tracks).where(and(eq(tracks.userId, user.id), eq(tracks.isDemo, true))),
    db.select({ n: count() }).from(transactions).where(and(eq(transactions.userId, user.id), eq(transactions.isDemo, true))),
  ]);
  const collapsed = (await cookies()).get("mayfar_sidebar")?.value === "collapsed";
  return (
    <div data-theme={settings.theme === "light" ? "light" : "dark"} className="min-h-dvh bg-bg text-fg">
      <AppShell
        user={{ name: user.name, email: user.email }}
        unread={unread.n}
        initialCollapsed={collapsed}
        logoutAction={logout}
        demoActive={demoTracks.n + demoTx.n > 0}
      >
        {children}
      </AppShell>
    </div>
  );
}
