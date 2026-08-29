import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getCurrentSession } from "@/features/auth/current-session";
import { SESSION_COOKIE_NAME } from "@/features/auth/session-cookie";
import { getSystemStats } from "@/features/dashboard/system-stats";
import { getDashboardLists } from "@/features/dashboard/dashboard-lists";
import { WelcomeScreen } from "@/widgets/dashboard/welcome-screen";
import { ListsSection } from "@/widgets/dashboard/lists-section";

export default async function DashboardPage() {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const current = getCurrentSession(sessionId);

  if (!current) {
    return redirect("/login");
  }

  const stats = getSystemStats();
  const lists = getDashboardLists(current.user.id);

  return (
    <div className="flex flex-1 flex-col items-center gap-8 bg-muted/40 px-4 py-12">
      <WelcomeScreen user={current.user} stats={stats} />
      <div className="w-full max-w-5xl">
        <ListsSection lists={lists} />
      </div>
    </div>
  );
}
