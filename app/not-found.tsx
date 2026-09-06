import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
      <span className="text-6xl" aria-hidden>
        🔎
      </span>
      <h1 className="font-heading text-2xl font-bold">הדף הזה לא קיים</h1>
      <p className="text-muted-foreground">
        אולי הקישור התיישן. אפשר לחזור לרשימה ולהמשיך משם.
      </p>
      <Button asChild className="mt-2 h-12">
        <Link href="/">חזרה לרשימה</Link>
      </Button>
    </main>
  );
}
