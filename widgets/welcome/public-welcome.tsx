import Link from "next/link";
import type { SystemStats } from "@/features/dashboard/system-stats";
import { buttonVariants } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";
import { cn } from "@/shared/lib/utils";
import { SystemStatsSummary } from "./system-stats-summary";

interface PublicWelcomeProps {
  stats: SystemStats;
}

export function PublicWelcome({ stats }: PublicWelcomeProps) {
  return (
    <div className="flex flex-1 items-center justify-center bg-muted/40 px-4 py-12">
      <Card
        data-testid="public-welcome"
        className="motion-reduce:animate-none animate-in fade-in zoom-in-95 slide-in-from-bottom-4 w-full min-w-0 max-w-sm gap-6 p-6 text-center shadow-sm duration-500 ease-out sm:p-8"
      >
        <div
          data-testid="welcome-message"
          className="motion-reduce:animate-none animate-in fade-in slide-in-from-bottom-2 duration-500 ease-out"
        >
          <h1 className="text-2xl font-semibold tracking-tight text-balance">Добро пожаловать</h1>
        </div>
        <Link
          href="/login"
          className={cn(
            buttonVariants({ size: "lg" }),
            "motion-reduce:animate-none animate-in fade-in slide-in-from-bottom-2 w-full duration-500 delay-150 ease-out fill-mode-both"
          )}
        >
          Войти
        </Link>
        <SystemStatsSummary
          stats={stats}
          className="motion-reduce:animate-none animate-in fade-in slide-in-from-bottom-2 duration-500 delay-300 ease-out fill-mode-both"
        />
      </Card>
    </div>
  );
}
