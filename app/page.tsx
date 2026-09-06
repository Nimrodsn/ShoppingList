import { redirect } from "next/navigation";
import { getHousehold, getMember } from "@/lib/auth/household";
import { LandingScreen } from "@/components/shared/landing-screen";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ e?: string }>;
}) {
  const { e } = await searchParams;
  const household = await getHousehold();

  // A stale cookie (wrong generation, forged signature, rotated link) lands here.
  if (!household) {
    return <LandingScreen badLink={e === "bad-link"} />;
  }

  const member = await getMember();
  if (!member) {
    redirect("/welcome");
  }

  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-4 p-4">
      <h1 className="font-heading text-2xl font-bold">{household.name}</h1>
      <p className="text-muted-foreground">שלום {member.name}, הרשימה בדרך.</p>
    </main>
  );
}
