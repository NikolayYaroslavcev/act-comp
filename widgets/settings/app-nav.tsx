import Link from "next/link";

export function AppNav() {
  return (
    <nav
      aria-label="Основная навигация"
      className="flex w-full max-w-5xl flex-wrap items-center justify-end gap-4 text-sm"
    >
      <Link href="/dashboard" className="text-muted-foreground hover:text-foreground">
        Списки
      </Link>
      <Link href="/settings" className="text-muted-foreground hover:text-foreground">
        Настройки
      </Link>
    </nav>
  );
}
