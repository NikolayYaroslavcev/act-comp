import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getCurrentSession } from "@/features/auth/current-session";
import { resolvePostLoginRedirect } from "@/features/auth/safe-redirect";
import { SESSION_COOKIE_NAME } from "@/features/auth/session-cookie";
import { LoginForm } from "@/features/auth/login-form";

interface LoginPageProps {
  searchParams: Promise<{ redirect?: string | string[] }>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { redirect: redirectParam } = await searchParams;
  const redirectTo = resolvePostLoginRedirect(
    Array.isArray(redirectParam) ? redirectParam[0] : redirectParam
  );

  const cookieStore = await cookies();
  const sessionId = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (getCurrentSession(sessionId)) {
    redirect(redirectTo);
  }

  return (
    <div className="flex flex-1 items-center justify-center bg-muted/40 px-4 py-12">
      <LoginForm redirectTo={redirectTo} />
    </div>
  );
}
