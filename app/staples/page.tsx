import { redirect } from "next/navigation";
import { getHousehold } from "@/lib/auth/household";
import { getBoard } from "@/actions/queries";
import { listStaples } from "@/actions/catalog";
import { PageHeader } from "@/components/shared/page-header";
import { StaplesScreen } from "@/components/staples/staples-screen";

export default async function StaplesPage({
  searchParams,
}: {
  searchParams: Promise<{ list?: string }>;
}) {
  const { list } = await searchParams;
  const household = await getHousehold();
  if (!household) redirect("/");

  const [board, staples] = await Promise.all([getBoard(list), listStaples()]);
  if (!board) redirect("/");

  return (
    <div className="mx-auto flex w-full max-w-lg flex-1 flex-col">
      <PageHeader
        title="הקנייה השבועית"
        subtitle="הפריטים שחוזרים כל שבוע, בלחיצה אחת"
      />
      <main className="flex flex-1 flex-col">
        <StaplesScreen
          staples={staples}
          categories={board.categories}
          listId={board.activeListId}
        />
      </main>
    </div>
  );
}
