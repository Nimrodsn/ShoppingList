"use client";

import { useState, useTransition } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Copy, Loader2, RefreshCw, Share2 } from "lucide-react";
import { toast } from "sonner";
import { rotateSecrets } from "@/actions/household";
import { Button } from "@/components/ui/button";

export function ShareCard({
  origin,
  initialSlug,
}: {
  origin: string;
  initialSlug: string;
}) {
  const [slug, setSlug] = useState(initialSlug);
  const [isPending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const link = `${origin}/j/${slug}`;

  async function share() {
    if (typeof navigator !== "undefined" && "share" in navigator) {
      try {
        await navigator.share({ title: "הסל שלנו", url: link });
        return;
      } catch {
        // The user dismissed the share sheet, or sharing is not permitted here.
      }
    }
    await copy();
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      toast.success("הקישור הועתק");
    } catch {
      toast.error("לא הצלחנו להעתיק. אפשר לסמן את הקישור ידנית.");
    }
  }

  function rotate() {
    startTransition(async () => {
      try {
        const result = await rotateSecrets();
        setSlug(result.secretSlug);
        setConfirming(false);
        toast.success("נוצר קישור חדש. כל המכשירים האחרים התנתקו.");
      } catch {
        toast.error("לא הצלחנו לייצר קישור חדש.");
      }
    });
  }

  return (
    <section aria-labelledby="share-title" className="space-y-3 rounded-2xl border bg-card p-4">
      <h2 id="share-title" className="font-heading text-lg font-semibold">
        הקישור המשפחתי
      </h2>
      <p className="text-sm text-muted-foreground">
        מי שיש לו את הקישור נכנס לרשימה. אין סיסמה, אז שלחו אותו רק למשפחה.
      </p>

      <div className="flex justify-center rounded-xl bg-white p-4">
        <QRCodeSVG value={link} size={160} level="M" />
      </div>

      <p dir="ltr" className="truncate rounded-lg bg-secondary px-3 py-2 text-xs">
        {link}
      </p>

      <div className="flex gap-2">
        <Button type="button" onClick={share} className="h-12 flex-1 text-base">
          <Share2 className="size-5" aria-hidden />
          שיתוף
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={copy}
          className="size-12 shrink-0"
          aria-label="העתקת הקישור"
        >
          <Copy className="size-5" aria-hidden />
        </Button>
      </div>

      {confirming ? (
        <div className="space-y-2 rounded-xl border border-destructive/40 bg-destructive/5 p-3">
          <p className="text-sm">
            קישור חדש ינתק <strong>את כל המכשירים</strong> חוץ מזה. להמשיך?
          </p>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="destructive"
              onClick={rotate}
              disabled={isPending}
              className="h-11 flex-1"
            >
              {isPending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
              כן, צור קישור חדש
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setConfirming(false)}
              className="h-11"
            >
              ביטול
            </Button>
          </div>
        </div>
      ) : (
        <Button
          type="button"
          variant="ghost"
          onClick={() => setConfirming(true)}
          className="h-11 w-full text-destructive"
        >
          <RefreshCw className="size-4" aria-hidden />
          צור קישור חדש
        </Button>
      )}
    </section>
  );
}
