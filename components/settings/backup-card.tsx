"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Download, Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import { exportBackup, restoreBackup } from "@/actions/backup";
import { Button } from "@/components/ui/button";

function download(filename: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function BackupCard() {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const [isPending, startTransition] = useTransition();
  const [restoring, setRestoring] = useState(false);

  function runExport(format: "json" | "csv") {
    startTransition(async () => {
      try {
        const backup = await exportBackup();
        if (format === "json") {
          download(`${backup.filename}.json`, backup.json, "application/json");
        } else {
          download(`${backup.filename}.csv`, backup.csv, "text/csv;charset=utf-8");
        }
      } catch {
        toast.error("לא הצלחנו להכין את הגיבוי.");
      }
    });
  }

  function runRestore(file: File) {
    setRestoring(true);
    startTransition(async () => {
      try {
        const parsed: unknown = JSON.parse(await file.text());
        const result = await restoreBackup(parsed);
        router.refresh();
        toast.success(
          `שוחזרו ${result.itemsAdded} פריטים` +
            (result.listsCreated > 0 ? ` ו-${result.listsCreated} רשימות` : "") +
            (result.itemsSkipped > 0 ? ` (${result.itemsSkipped} כבר היו ברשימה)` : ""),
        );
      } catch {
        toast.error("קובץ הגיבוי לא תקין.");
      } finally {
        setRestoring(false);
      }
    });
  }

  const busy = isPending || restoring;

  return (
    <section aria-labelledby="backup-title" className="space-y-3">
      <h2 id="backup-title" className="font-heading text-lg font-semibold">
        גיבוי ושחזור
      </h2>
      <p className="text-sm text-muted-foreground">
        הורדה של כל הרשימות וההיסטוריה, ושחזור שמוסיף בלבד - שום דבר קיים לא נמחק.
      </p>

      <div className="flex flex-wrap gap-2">
        <Button
          variant="secondary"
          className="h-11"
          disabled={busy}
          onClick={() => runExport("json")}
        >
          {isPending ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <Download className="size-4" aria-hidden />
          )}
          ייצוא JSON
        </Button>
        <Button
          variant="secondary"
          className="h-11"
          disabled={busy}
          onClick={() => runExport("csv")}
        >
          <Download className="size-4" aria-hidden />
          ייצוא CSV
        </Button>
        <Button
          variant="secondary"
          className="h-11"
          disabled={busy}
          onClick={() => fileInput.current?.click()}
        >
          {restoring ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <Upload className="size-4" aria-hidden />
          )}
          שחזור מקובץ
        </Button>
      </div>

      <input
        ref={fileInput}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) runRestore(file);
        }}
      />
    </section>
  );
}
