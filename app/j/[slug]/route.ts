import { NextResponse, type NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  buildHouseholdCookie,
  HOUSEHOLD_COOKIE_OPTIONS,
} from "@/lib/auth/household";
import { HOUSEHOLD_COOKIE, MEMBER_NAME_COOKIE } from "@/lib/auth/constants";
import { clientIp, joinLimiter } from "@/lib/ratelimit";
import { SecretSlugSchema } from "@/lib/schemas";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { success } = await joinLimiter().limit(clientIp(request.headers));
  if (!success) {
    return new NextResponse("יותר מדי ניסיונות. נסו שוב בעוד דקה.", {
      status: 429,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  const { slug } = await params;
  const parsed = SecretSlugSchema.safeParse(slug);
  if (!parsed.success) {
    return NextResponse.redirect(new URL("/?e=bad-link", request.url));
  }

  const { data: household, error } = await supabaseAdmin()
    .from("households")
    .select("id, cookie_generation")
    .eq("secret_slug", parsed.data)
    .maybeSingle();

  // A rejected service key returns no row, exactly like an unknown slug. Without this
  // line a misconfigured deployment is indistinguishable from a stale family link.
  if (error) {
    console.error(`household lookup failed: ${error.message}`);
  }

  if (!household) {
    return NextResponse.redirect(new URL("/?e=bad-link", request.url));
  }

  const knowsWhoTheyAre = request.cookies.has(MEMBER_NAME_COOKIE);
  const response = NextResponse.redirect(
    new URL(knowsWhoTheyAre ? "/" : "/welcome", request.url),
  );

  response.cookies.set(
    HOUSEHOLD_COOKIE,
    buildHouseholdCookie(household.id, household.cookie_generation),
    HOUSEHOLD_COOKIE_OPTIONS,
  );

  return response;
}
