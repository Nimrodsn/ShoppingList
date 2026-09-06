import { redirect } from "next/navigation";
import { getHousehold, getMember } from "@/lib/auth/household";
import { getBoard } from "@/actions/queries";
import { RealtimeProvider } from "@/lib/realtime/provider";
import { LandingScreen } from "@/components/shared/landing-screen";
import { AppHeader } from "@/components/shared/app-header";
import { ListTabs } from "@/components/shared/list-tabs";
import { PresenceBar } from "@/components/shared/presence-bar";
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
  const openCount = board.items.filter((item) => !item.isChecked).length;

  return (
    // realtimeKey reaches the client as a prop, never through a readable cookie.
    <RealtimeProvider
      realtimeKey={household.realtimeKey}
      memberId={member.id}
      memberName={member.name}
    >
      <div className="mx-auto flex w-full max-w-lg flex-1 flex-col">
        <AppHeader
          title={household.name}
          subtitle={`${openCount} פריטים ב${activeList?.name ?? "רשימה"}`}
        />
        <PresenceBar />
        <ListTabs lists={board.lists} activeListId={board.activeListId} />
        <ListScreen board={board} memberName={member.name} />
      </div>
    </RealtimeProvider>
  );
}
