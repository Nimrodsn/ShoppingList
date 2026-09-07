import { redirect } from "next/navigation";
import { getHousehold, getMember } from "@/lib/auth/household";
import { hasAnyHousehold } from "@/actions/household";
import { getBoard } from "@/actions/queries";
import { suggestForgotten } from "@/actions/suggestions";
import { listStaples } from "@/actions/catalog";
import { normalizeHebrew } from "@/lib/hebrew";
import { RealtimeProvider } from "@/lib/realtime/provider";
import { LandingScreen } from "@/components/shared/landing-screen";
import { AppHeader } from "@/components/shared/app-header";
import { ListTabs } from "@/components/shared/list-tabs";
import { PresenceBar } from "@/components/shared/presence-bar";
import { ForgottenBanner } from "@/components/list/forgotten-banner";
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
    return (
      <LandingScreen
        badLink={e === "bad-link"}
        canCreate={!(await hasAnyHousehold())}
      />
    );
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
  const openItems = board.items.filter((item) => !item.isChecked);
  const [forgotten, staples] = await Promise.all([
    suggestForgotten(openItems.map((item) => item.name)),
    listStaples(),
  ]);
  const stapleNames = staples.map((entry) => normalizeHebrew(entry.name));

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
          subtitle={`${openItems.length} פריטים ב${activeList?.name ?? "רשימה"}`}
        />
        <PresenceBar />
        <main className="flex flex-1 flex-col">
          <ListTabs lists={board.lists} activeListId={board.activeListId} />
          <ForgottenBanner suggestions={forgotten} listId={board.activeListId} />
          <ListScreen
            board={board}
            memberName={member.name}
            stapleNames={stapleNames}
          />
        </main>
      </div>
    </RealtimeProvider>
  );
}
