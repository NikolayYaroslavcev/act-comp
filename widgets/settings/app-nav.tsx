import Link from "next/link";
import { cn } from "@/shared/lib/utils";

const LINKS = [
  { href: "/dashboard", label: "Списки" },
  { href: "/settings", label: "Настройки" },
] as const;

interface AppNavProps {
  active?: "dashboard" | "settings";
}

export function AppNav({ active }: AppNavProps = {}) {
  return (
    <header className="w-full border-b border-border bg-card/60">
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <Link
          href="/dashboard"
          className="rounded-lg text-sm font-semibold tracking-tight outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Задачи
        </Link>
        <nav aria-label="Основная навигация" className="flex items-center gap-1 text-sm">
          {LINKS.map((link) => {
            const isActive = link.href === `/${active}`;
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "rounded-lg px-3 py-1.5 font-medium transition-colors hover:bg-muted/60 hover:text-foreground",
                  isActive ? "bg-muted/60 text-foreground" : "text-muted-foreground",
                )}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
