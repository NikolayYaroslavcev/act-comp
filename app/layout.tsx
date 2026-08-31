import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { getCurrentSession } from "@/features/auth/current-session";
import { SESSION_COOKIE_NAME } from "@/features/auth/session-cookie";
import { ThemeSync } from "@/widgets/settings/theme-sync";
import { NotificationInbox } from "@/widgets/notification/notification-inbox";
import { StoreProvider } from "@/shared/store/provider";
import { AppErrorBoundary } from "./app-error-boundary";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Задачи",
  description: "Управление списками задач и совместная работа над ними",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const current = getCurrentSession(sessionId);
  const theme = current?.user.settings.theme ?? "system";
  const darkClass = theme === "dark" ? "dark" : "";

  return (
    <html
      lang="ru"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased ${darkClass}`.trim()}
    >
      <body className="min-h-full flex flex-col">
        <script
          // Runs synchronously before first paint so a "dark" or OS-resolved
          // "system" theme is applied immediately — the server can render the
          // correct class for an explicit choice, but never for "system"
          // (it has no way to know the client's OS preference), which is
          // what caused the light-then-dark flash on reload.
          dangerouslySetInnerHTML={{
            __html: `try{var t=${JSON.stringify(theme)};var d=t==="dark"||(t==="system"&&window.matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.classList.toggle("dark",d);}catch(e){}`,
          }}
        />
        <StoreProvider>
          <ThemeSync theme={theme} />
          <NotificationInbox crossTabSyncEnabled={current?.user.settings.notifications.otherUserChanges ?? false} />
          <AppErrorBoundary>{children}</AppErrorBoundary>
        </StoreProvider>
      </body>
    </html>
  );
}
