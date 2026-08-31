import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getCurrentSession } from "@/features/auth/current-session";
import { SESSION_COOKIE_NAME } from "@/features/auth/session-cookie";
import { AppNav } from "@/widgets/settings/app-nav";
import { SessionsSection } from "@/widgets/settings/sessions-section";
import { SettingsForm } from "@/widgets/settings/settings-form";

export default async function SettingsPage() {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const current = getCurrentSession(sessionId);

  if (!current) {
    return redirect("/login");
  }

  return (
    <div className="flex min-w-0 flex-1 flex-col overflow-x-hidden bg-muted/40">
      <AppNav active="settings" />
      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-10 sm:px-6 sm:py-12">
        <h1 className="text-2xl font-semibold tracking-tight">Настройки</h1>
        <SettingsForm initialSettings={current.user.settings} />
        <SessionsSection />
      </div>
    </div>
  );
}
