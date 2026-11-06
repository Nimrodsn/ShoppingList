import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getHousehold, getMember } from "@/lib/auth/household";
import { hasAnyHousehold } from "@/actions/household";
import { getBoard } from "@/actions/queries";
import { suggestForgotten, type ForgottenSuggestion } from "@/actions/suggestions";
import { getCatalog } from "@/actions/catalog-data";
import { effectiveCatalog } from "@/lib/catalog-match";
import { normalizeHebrew } from "@/lib/hebrew";
import { RealtimeProvider } from "@/lib/realtime/provider";
import { LandingScreen } from "@/components/shared/landing-screen";
import { AppHeader } from "@/components/shared/app-header";
import { ListTabs } from "@/components/shared/list-tabs";
import { PresenceBar } from "@/components/shared/presence-bar";
import { ForgottenBanner } from "@/components/list/forgotten-banner";
import { ListScreen } from "@/components/list/list-screen";

/**
 * Streams in once the suggestions arrive, so the banner never holds up first paint.
 * The open-list filter lives here (not in the query) so the fetch starts in
 * parallel with the board instead of after it.
 */
async function ForgottenSection({
  promise,
  openNames,
  listId,
}: {
  promise: Promise<ForgottenSuggestion[]>;
  openNames: string[];
  listId: string;
}) {
  const suggestions = await promise;
  const openNorms = new Set(openNames.map(normalizeHebrew));
  return (
    <ForgottenBanner
      suggestions={suggestions.filter(
        (entry) => !openNorms.has(normalizeHebrew(entry.name)),
      )}
      listId={listId}
    />
  );
}

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

  // Everything starts at once: the board, the catalog (autocomplete + staples)
  // and the forgotten suggestions all fan out after the single auth check.
  const boardPromise = getBoard(list);
  const catalogPromise = getCatalog();
  const forgottenPromise = suggestForgotten();

  const [board, catalog] = await Promise.all([boardPromise, catalogPromise]);
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
  const stapleNames = effectiveCatalog(catalog)
    .filter((entry) => entry.isStaple)
    .map((entry) => normalizeHebrew(entry.name));

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
          <Suspense fallback={null}>
            <ForgottenSection
              promise={forgottenPromise}
              openNames={openItems.map((item) => item.name)}
              listId={board.activeListId}
            />
          </Suspense>
          <ListScreen
            board={board}
            memberName={member.name}
            stapleNames={stapleNames}
            catalog={catalog}
          />
        </main>
      </div>
    </RealtimeProvider>
  );
}
