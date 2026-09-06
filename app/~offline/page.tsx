import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "אין חיבור",
};

/**
 * Precached by the service worker and served when a cold start finds no network
 * and no cached copy of the requested page.
 */
export default function OfflinePage() {
  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
      <span className="text-6xl" aria-hidden>
        📡
      </span>
      <h1 className="font-heading text-2xl font-bold">אין חיבור לאינטרנט</h1>
      <p className="text-muted-foreground">
        הרשימה שנשמרה במכשיר תופיע ברגע שהחיבור יחזור. מה שהוספתם בזמן הזה מחכה
        בתור ויישלח לבד.
      </p>
    </main>
  );
}
