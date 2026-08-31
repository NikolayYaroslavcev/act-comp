import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getCurrentSession } from "@/features/auth/current-session";
import { SESSION_COOKIE_NAME } from "@/features/auth/session-cookie";
import { getSystemStats } from "@/features/dashboard/system-stats";
import { PublicWelcome } from "@/widgets/welcome/public-welcome";

export default async function Home() {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const current = getCurrentSession(sessionId);

  if (current) {
    return redirect("/dashboard");
  }

  const stats = getSystemStats();

  return <PublicWelcome stats={stats} />;
}
