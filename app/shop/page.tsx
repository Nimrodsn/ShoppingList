import { redirect } from "next/navigation";
import { getHousehold, getMember } from "@/lib/auth/household";
import { getBoard } from "@/actions/queries";
import { RealtimeProvider } from "@/lib/realtime/provider";
import { ShoppingScreen } from "@/components/shopping/shopping-screen";

export default async function ShopPage({
  searchParams,
}: {
  searchParams: Promise<{ list?: string }>;
}) {
  const { list } = await searchParams;
  const household = await getHousehold();
  const member = await getMember();

  if (!household) redirect("/");
  if (!member) redirect("/welcome");

  const board = await getBoard(list);
  if (!board) redirect("/");

  return (
    <RealtimeProvider
      realtimeKey={household.realtimeKey}
      memberId={member.id}
      memberName={member.name}
    >
      <ShoppingScreen board={board} memberName={member.name} />
    </RealtimeProvider>
  );
}
