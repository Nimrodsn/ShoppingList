"use client";

import { useActionState } from "react";
import { Loader2, Link2 } from "lucide-react";
import { joinByLink } from "@/actions/household";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type State = { error: string | null };

async function submit(_previous: State, formData: FormData): Promise<State> {
  const result = await joinByLink(String(formData.get("link") ?? ""));
  return { error: result?.error ?? null };
}

export function JoinByLinkForm({ badLink = false }: { badLink?: boolean }) {
  const [state, formAction, isPending] = useActionState<State, FormData>(submit, {
    error: badLink ? "הקישור פג או הוחלף. בקשו קישור חדש מהמשפחה." : null,
  });

  return (
    <form action={formAction} className="space-y-3">
      <label htmlFor="link" className="block text-sm font-medium">
        הדביקו כאן את הקישור שקיבלתם
      </label>
      <Input
        id="link"
        name="link"
        inputMode="url"
        autoComplete="off"
        placeholder="https://…/j/xxxxxxxx"
        className="h-12 text-base"
        aria-describedby={state.error ? "link-error" : undefined}
      />
      {state.error ? (
        <p id="link-error" role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      ) : null}
      <Button type="submit" className="h-12 w-full text-base" disabled={isPending}>
        {isPending ? (
          <Loader2 className="size-5 animate-spin" aria-hidden />
        ) : (
          <Link2 className="size-5" aria-hidden />
        )}
        הצטרפות לרשימה
      </Button>
    </form>
  );
}
