"use client";

import { Button } from "@/components/ui/button";

export default function Error({ reset }: { reset: () => void }) {
  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
      <span className="text-6xl" aria-hidden>
        🫠
      </span>
      <h1 className="font-heading text-2xl font-bold">משהו נשבר</h1>
      <p className="text-muted-foreground">
        הרשימה לא נעלמה, רק המסך הזה. אפשר לנסות לטעון מחדש.
      </p>
      <Button type="button" onClick={reset} className="mt-2 h-12">
        נסו שוב
      </Button>
    </main>
  );
}
