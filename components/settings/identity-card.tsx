"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { renameHousehold, setMemberName } from "@/actions/household";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function IdentityCard({
  householdName,
  memberName,
}: {
  householdName: string;
  memberName: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [house, setHouse] = useState(householdName);
  const [member, setMember] = useState(memberName);

  function save() {
    startTransition(async () => {
      try {
        await Promise.all([
          house.trim() !== householdName ? renameHousehold(house.trim()) : null,
          member.trim() !== memberName ? setMemberName(member.trim()) : null,
        ]);
        router.refresh();
        toast.success("נשמר");
      } catch {
        toast.error("לא הצלחנו לשמור.");
      }
    });
  }

  const dirty = house.trim() !== householdName || member.trim() !== memberName;

  return (
    <section aria-labelledby="identity-title" className="space-y-3">
      <h2 id="identity-title" className="font-heading text-lg font-semibold">
        מי אנחנו
      </h2>

      <div className="space-y-1.5">
        <Label htmlFor="household-name">שם הבית</Label>
        <Input
          id="household-name"
          value={house}
          onChange={(event) => setHouse(event.target.value)}
          maxLength={40}
          className="h-12 text-base"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="member-name">השם שלי</Label>
        <Input
          id="member-name"
          value={member}
          onChange={(event) => setMember(event.target.value)}
          maxLength={20}
          className="h-12 text-base"
        />
        <p className="text-xs text-muted-foreground">
          לתצוגה בלבד, כדי שכולם יראו מי הוסיף מה.
        </p>
      </div>

      <Button
        type="button"
        onClick={save}
        disabled={isPending || !dirty || house.trim() === "" || member.trim() === ""}
        className="h-12 w-full text-base"
      >
        {isPending ? (
          <Loader2 className="size-5 animate-spin" aria-hidden />
        ) : (
          <Check className="size-5" aria-hidden />
        )}
        שמירה
      </Button>
    </section>
  );
}
