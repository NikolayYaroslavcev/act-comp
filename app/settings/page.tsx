import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getCurrentSession } from "@/features/auth/current-session";
import { SESSION_COOKIE_NAME } from "@/features/auth/session-cookie";
import { AppNav } from "@/widgets/settings/app-nav";
import { SettingsForm } from "@/widgets/settings/settings-form";

export default async function SettingsPage() {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const current = getCurrentSession(sessionId);

  if (!current) {
    return redirect("/login");
  }

  return (
    <div className="flex flex-1 flex-col items-center gap-6 bg-muted/40 px-4 py-12">
      <AppNav />
      <h1 className="w-full max-w-2xl text-xl font-semibold tracking-tight">Настройки</h1>
      <SettingsForm initialSettings={current.user.settings} />
    </div>
  );
}
