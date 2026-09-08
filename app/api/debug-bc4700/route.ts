// #region agent log
// Temporary diagnostics for debug session bc4700: walks the same chain as
// requireHousehold() and reports where it breaks. Reports shapes and booleans only,
// never a cookie value, never a key. Delete together with the rest of the session.
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { HOUSEHOLD_COOKIE, MEMBER_ID_COOKIE, MEMBER_NAME_COOKIE } from "@/lib/auth/constants";
import { verifySignature } from "@/lib/auth/signing";
import { serverEnv } from "@/lib/env";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function GET() {
  const lines: string[] = ["debug bc4700 household chain"];
  const store = await cookies();

  lines.push(`build: ${process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "local"}`);
  lines.push(`cookieName: ${HOUSEHOLD_COOKIE}`);
  lines.push(`cookieNamesSeen: ${store.getAll().map((c) => c.name).join(",") || "none"}`);

  const raw = store.get(HOUSEHOLD_COOKIE)?.value;
  lines.push(`householdCookie: ${raw ? `present length=${raw.length}` : "MISSING"}`);
  lines.push(
    `memberCookies: name=${store.has(MEMBER_NAME_COOKIE)} id=${store.has(MEMBER_ID_COOKIE)}`,
  );

  if (raw) {
    const parts = raw.split(".");
    lines.push(`parts: ${parts.length}`);

    if (parts.length === 3) {
      const [householdId, generationRaw, signature] = parts;
      let signatureValid = false;
      try {
        signatureValid = verifySignature(
          `${householdId}.${generationRaw}`,
          signature,
          serverEnv().APP_SECRET,
        );
      } catch (thrown) {
        lines.push(`verifyThrew: ${thrown instanceof Error ? thrown.message : String(thrown)}`);
      }
      lines.push(`signatureValid: ${signatureValid}`);
      lines.push(`cookieGeneration: ${generationRaw}`);

      const { data, error } = await supabaseAdmin()
        .from("households")
        .select("id, cookie_generation")
        .eq("id", householdId)
        .maybeSingle();

      lines.push(`dbRowFound: ${data !== null}`);
      lines.push(`dbGeneration: ${data?.cookie_generation ?? "n/a"}`);
      lines.push(`dbError: ${error?.message ?? "none"}`);
    }
  }

  // Hypothesis V: does the cookie serializer accept a Hebrew value at all?
  const response = new NextResponse("", {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
  try {
    response.cookies.set("debug_he_bc4700", "בדיקה", { path: "/", maxAge: 60 });
    lines.push("hebrewCookieWrite: ok");
  } catch (thrown) {
    lines.push(
      `hebrewCookieWrite: THREW ${thrown instanceof Error ? thrown.message : String(thrown)}`,
    );
  }

  return new NextResponse(lines.join("\n"), {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
// #endregion
