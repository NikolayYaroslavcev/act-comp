import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getCurrentSession } from "@/features/auth/current-session";
import { SESSION_COOKIE_NAME } from "@/features/auth/session-cookie";
import { getSystemStats } from "@/features/dashboard/system-stats";
import { getDashboardLists, getDeletedDashboardLists } from "@/features/dashboard/dashboard-lists";
import { WelcomeScreen } from "@/widgets/dashboard/welcome-screen";
import { DashboardListsPanel } from "@/widgets/dashboard/dashboard-lists-panel";
import { AppNav } from "@/widgets/settings/app-nav";

export default async function DashboardPage() {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const current = getCurrentSession(sessionId);

  if (!current) {
    return redirect("/login");
  }

  const stats = getSystemStats();
  const lists = getDashboardLists(current.user.id);
  const deletedLists = getDeletedDashboardLists(current.user.id);

  return (
    <div className="flex min-w-0 flex-1 flex-col overflow-x-hidden bg-muted/40">
      <AppNav active="dashboard" />
      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 px-4 py-10 sm:px-6 sm:py-12">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <h1 className="text-2xl font-semibold tracking-tight">Списки</h1>
          <WelcomeScreen user={current.user} stats={stats} />
        </div>
        <DashboardListsPanel initialLists={lists} initialDeletedLists={deletedLists} />
      </div>
    </div>
  );
}
