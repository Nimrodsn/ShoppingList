import Link from "next/link";
import { Button } from "@/components/ui/button";

export function EmptyList({ hasChecked }: { hasChecked: boolean }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 py-16 text-center">
      <span className="text-5xl" aria-hidden>
        {hasChecked ? "🎉" : "🧺"}
      </span>
      <p className="font-heading text-lg font-semibold">
        {hasChecked ? "הרשימה ריקה — סיימתם הכל!" : "הרשימה ריקה"}
      </p>
      <p className="max-w-xs text-sm text-muted-foreground">
        {hasChecked
          ? "אפשר לסגור את הקנייה, או להוסיף עוד משהו לפני שיוצאים."
          : "או שכולם שכחו להוסיף? התחילו מהקנייה השבועית."}
      </p>
      <Button asChild variant="outline" className="mt-2 h-11">
        <Link href="/staples">הקנייה השבועית</Link>
      </Button>
    </div>
  );
}
