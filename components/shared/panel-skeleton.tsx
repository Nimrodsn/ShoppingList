import { Skeleton } from "@/components/ui/skeleton";

/** Loading shape for the secondary screens: a page header over a stack of rows. */
export function PanelSkeleton({ title, rows }: { title: string; rows: number }) {
  return (
    <div
      role="status"
      aria-label={`טוען ${title}`}
      className="mx-auto flex w-full max-w-lg flex-1 flex-col"
    >
      <div aria-hidden className="flex items-center gap-2 px-4 py-3">
        <Skeleton className="size-11 rounded-full" />
        <Skeleton className="h-6 w-32" />
      </div>

      <div aria-hidden className="space-y-2 px-4">
        {Array.from({ length: rows }, (_, row) => (
          <Skeleton key={row} className="h-14 w-full rounded-2xl" />
        ))}
      </div>
    </div>
  );
}
