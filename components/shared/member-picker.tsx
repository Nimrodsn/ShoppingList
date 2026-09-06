"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { setMemberName } from "@/actions/household";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function MemberPicker({ suggestions }: { suggestions: string[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [custom, setCustom] = useState("");
  const [showCustom, setShowCustom] = useState(false);
  const [chosen, setChosen] = useState<string | null>(null);

  function choose(name: string) {
    const trimmed = name.trim();
    if (!trimmed) return;

    setChosen(trimmed);
    startTransition(async () => {
      try {
        await setMemberName(trimmed);
        router.replace("/");
      } catch {
        setChosen(null);
        toast.error("לא הצלחנו לשמור את השם. נסו שוב.");
      }
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap justify-center gap-3">
        {suggestions.map((name) => (
          <Button
            key={name}
            type="button"
            variant={chosen === name ? "default" : "outline"}
            className="h-12 min-w-24 rounded-full px-6 text-base"
            onClick={() => choose(name)}
            disabled={isPending}
          >
            {chosen === name && isPending ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : null}
            {name}
          </Button>
        ))}

        {!showCustom ? (
          <Button
            type="button"
            variant="ghost"
            className="h-12 rounded-full px-6 text-base"
            onClick={() => setShowCustom(true)}
            disabled={isPending}
          >
            <Plus className="size-4" aria-hidden />
            שם אחר
          </Button>
        ) : null}
      </div>

      {showCustom ? (
        <form
          className="flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            choose(custom);
          }}
        >
          <Input
            autoFocus
            value={custom}
            onChange={(event) => setCustom(event.target.value)}
            maxLength={20}
            placeholder="איך לקרוא לך?"
            className="h-12 text-base"
            aria-label="שם חדש"
          />
          <Button
            type="submit"
            size="icon"
            className="size-12 shrink-0"
            disabled={isPending || custom.trim().length === 0}
            aria-label="אישור"
          >
            {isPending ? (
              <Loader2 className="size-5 animate-spin" aria-hidden />
            ) : (
              <Check className="size-5" aria-hidden />
            )}
          </Button>
        </form>
      ) : null}
    </div>
  );
}
