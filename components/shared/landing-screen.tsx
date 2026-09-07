import { CreateHouseholdForm } from "@/components/shared/create-household-form";
import { JoinByLinkForm } from "@/components/shared/join-by-link-form";

/**
 * `canCreate` is true only while no household exists, so the setup form disappears
 * for everyone the moment the first family is created.
 */
export function LandingScreen({
  badLink = false,
  canCreate = false,
}: {
  badLink?: boolean;
  canCreate?: boolean;
}) {
  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center gap-8 p-6">
      <div className="space-y-3 text-center">
        <span className="text-6xl" aria-hidden>
          🛒
        </span>
        <h1 className="font-heading text-3xl font-bold">הסל שלנו</h1>
        <p className="text-muted-foreground">
          {canCreate
            ? "רשימת הקניות המשותפת של המשפחה. שנייה אחת ואפשר להתחיל."
            : "רשימת הקניות המשותפת של המשפחה. בלי הרשמה ובלי סיסמאות — רק הקישור המשפחתי."}
        </p>
      </div>

      {canCreate ? (
        <>
          <CreateHouseholdForm />
          <div className="space-y-3 border-t pt-6">
            <p className="text-center text-sm font-medium">כבר קיבלתם קישור?</p>
            <JoinByLinkForm badLink={badLink} />
          </div>
        </>
      ) : (
        <>
          <JoinByLinkForm badLink={badLink} />
          <p className="text-center text-xs text-muted-foreground">
            אין לכם קישור? בקשו מבן משפחה לשתף אותו מתוך מסך ההגדרות.
          </p>
        </>
      )}
    </main>
  );
}
