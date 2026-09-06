import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getHousehold, getMember } from "@/lib/auth/household";
import { currentSecretSlug } from "@/actions/household";
import { getBoard } from "@/actions/queries";
import { PageHeader } from "@/components/shared/page-header";
import { CategoryReorder } from "@/components/settings/category-reorder";
import { IdentityCard } from "@/components/settings/identity-card";
import { ListsManager } from "@/components/settings/lists-manager";
import { ShareCard } from "@/components/settings/share-card";
import { Separator } from "@/components/ui/separator";

export default async function SettingsPage() {
  const household = await getHousehold();
  const member = await getMember();

  if (!household) redirect("/");
  if (!member) redirect("/welcome");

  const [board, slug, headerList] = await Promise.all([
    getBoard(),
    currentSecretSlug(),
    headers(),
  ]);

  if (!board || !slug) redirect("/");

  const host = headerList.get("host") ?? "localhost:3000";
  const protocol = host.startsWith("localhost") ? "http" : "https";

  return (
    <div className="mx-auto flex w-full max-w-lg flex-1 flex-col">
      <PageHeader title="הגדרות" subtitle={household.name} />

      <main className="space-y-6 px-4 pb-12">
        <ShareCard origin={`${protocol}://${host}`} initialSlug={slug} />
        <Separator />
        <IdentityCard householdName={household.name} memberName={member.name} />
        <Separator />
        <ListsManager lists={board.lists} />
        <Separator />
        <CategoryReorder categories={board.categories} />
      </main>
    </div>
  );
}
