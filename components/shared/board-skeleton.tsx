import { Skeleton } from "@/components/ui/skeleton";

const GROUPS = [3, 2];

/** Mirrors the real board so nothing jumps when the data arrives. */
export function BoardSkeleton() {
  return (
    <div
      role="status"
      aria-label="טוען את הרשימה"
      className="mx-auto flex w-full max-w-lg flex-1 flex-col"
    >
      <div aria-hidden className="space-y-4 px-4 pt-4">
        <div className="space-y-2">
          <Skeleton className="h-7 w-40" />
          <Skeleton className="h-4 w-28" />
        </div>

        <div className="flex gap-2">
          <Skeleton className="h-10 w-28 rounded-full" />
          <Skeleton className="h-10 w-24 rounded-full" />
          <Skeleton className="h-10 w-20 rounded-full" />
        </div>

        {GROUPS.map((rows, group) => (
          <div key={group} className="space-y-2">
            <Skeleton className="h-4 w-24" />
            {Array.from({ length: rows }, (_, row) => (
              <Skeleton key={row} className="h-14 w-full rounded-2xl" />
            ))}
          </div>
        ))}
      </div>

      <div aria-hidden className="mt-auto flex gap-2 px-4 pt-3 pb-safe">
        <Skeleton className="h-12 flex-1 rounded-lg" />
        <Skeleton className="size-12 rounded-lg" />
        <Skeleton className="size-12 rounded-lg" />
      </div>
    </div>
  );
}
