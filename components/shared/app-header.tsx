import Link from "next/link";
import { History, Settings, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/shared/theme-toggle";

export function AppHeader({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <header className="flex items-start justify-between gap-2 px-4 pt-4">
      <div className="min-w-0">
        <h1 className="truncate font-heading text-2xl font-bold">{title}</h1>
        {subtitle ? (
          <p aria-live="polite" className="truncate text-sm text-muted-foreground">
            {subtitle}
          </p>
        ) : null}
      </div>

      <nav aria-label="ניווט ראשי" className="flex shrink-0 items-center">
        <Button asChild variant="ghost" size="icon" className="size-11">
          <Link href="/staples" aria-label="הקנייה השבועית">
            <Star className="size-5" aria-hidden />
          </Link>
        </Button>
        <Button asChild variant="ghost" size="icon" className="size-11">
          <Link href="/history" aria-label="היסטוריה">
            <History className="size-5" aria-hidden />
          </Link>
        </Button>
        <ThemeToggle />
        <Button asChild variant="ghost" size="icon" className="size-11">
          <Link href="/settings" aria-label="הגדרות">
            <Settings className="size-5" aria-hidden />
          </Link>
        </Button>
      </nav>
    </header>
  );
}
