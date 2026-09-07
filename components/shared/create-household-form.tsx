"use client";

import { useActionState } from "react";
import { Home, Loader2 } from "lucide-react";
import { createFirstHousehold } from "@/actions/household";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type State = { error: string | null };

async function submit(_previous: State, formData: FormData): Promise<State> {
  const result = await createFirstHousehold(String(formData.get("name") ?? ""));
  return { error: result?.error ?? null };
}

export function CreateHouseholdForm() {
  const [state, formAction, isPending] = useActionState<State, FormData>(submit, {
    error: null,
  });

  return (
    <form action={formAction} className="space-y-3">
      <label htmlFor="name" className="block text-sm font-medium">
        איך נקרא לבית?
      </label>
      <Input
        id="name"
        name="name"
        defaultValue="הבית שלנו"
        autoComplete="off"
        maxLength={40}
        className="h-12 text-base"
        aria-describedby={state.error ? "name-error" : undefined}
      />
      {state.error ? (
        <p id="name-error" role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      ) : null}
      <Button type="submit" className="h-12 w-full text-base" disabled={isPending}>
        {isPending ? (
          <Loader2 className="size-5 animate-spin" aria-hidden />
        ) : (
          <Home className="size-5" aria-hidden />
        )}
        יצירת הבית
      </Button>
    </form>
  );
}
