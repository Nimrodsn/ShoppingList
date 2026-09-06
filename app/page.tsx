import { redirect } from "next/navigation";
import { getHousehold, getMember } from "@/lib/auth/household";
import { getBoard } from "@/actions/queries";
import { LandingScreen } from "@/components/shared/landing-screen";
import { AppHeader } from "@/components/shared/app-header";
import { ListTabs } from "@/components/shared/list-tabs";
import { ListScreen } from "@/components/list/list-screen";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ e?: string; list?: string }>;
}) {
  const { e, list } = await searchParams;
  const household = await getHousehold();

  // A missing, forged or stale cookie (rotated link) all land on the join screen.
  if (!household) {
    return <LandingScreen badLink={e === "bad-link"} />;
  }

  const member = await getMember();
  if (!member) {
    redirect("/welcome");
  }

  const board = await getBoard(list);
  if (!board) {
    return (
      <main className="mx-auto flex w-full max-w-lg flex-1 items-center justify-center p-6 text-center">
        <p className="text-muted-foreground">
          אין עוד רשימות בבית הזה. אפשר ליצור אחת במסך ההגדרות.
        </p>
      </main>
    );
  }

  const activeList = board.lists.find((entry) => entry.id === board.activeListId);

  return (
    <div className="mx-auto flex w-full max-w-lg flex-1 flex-col">
      <AppHeader
        title={household.name}
        subtitle={`${board.openCount} פריטים ב${activeList?.name ?? "רשימה"}`}
      />
      <ListTabs lists={board.lists} activeListId={board.activeListId} />
      <ListScreen board={board} />
    </div>
  );
}
