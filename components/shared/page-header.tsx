import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export function PageHeader({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <header className="flex items-center gap-2 px-4 pt-4 pb-2">
      <Button asChild variant="ghost" size="icon" className="size-11 shrink-0">
        <Link href="/" aria-label="חזרה לרשימה">
          {/* Directional icon: mirrored in RTL so the arrow points back correctly. */}
          <ArrowRight className="size-5 rtl:-scale-x-100" aria-hidden />
        </Link>
      </Button>
      <div className="min-w-0">
        <h1 className="truncate font-heading text-xl font-bold">{title}</h1>
        {subtitle ? (
          <p className="truncate text-sm text-muted-foreground">{subtitle}</p>
        ) : null}
      </div>
    </header>
  );
}
