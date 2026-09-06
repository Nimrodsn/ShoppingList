import { redirect } from "next/navigation";
import { getHousehold } from "@/lib/auth/household";
import { listKnownMembers } from "@/actions/household";
import { MemberPicker } from "@/components/shared/member-picker";

export default async function WelcomePage() {
  const household = await getHousehold();
  if (!household) {
    redirect("/");
  }

  const suggestions = await listKnownMembers();

  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center gap-8 p-6">
      <div className="space-y-3 text-center">
        <span className="text-5xl" aria-hidden>
          👋
        </span>
        <h1 className="font-heading text-2xl font-bold">איך קוראים לך?</h1>
        <p className="text-muted-foreground">
          כדי שכולם יראו מי הוסיף מה. אפשר לשנות בכל רגע בהגדרות.
        </p>
      </div>

      <MemberPicker suggestions={suggestions} />
    </main>
  );
}
