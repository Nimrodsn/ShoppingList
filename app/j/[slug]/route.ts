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
  // #region agent log
  try {
    return await handle(request, params);
  } catch (thrown) {
    const stage = thrown instanceof Error ? `${thrown.name}: ${thrown.message}` : String(thrown);
    const cause = thrown instanceof Error && thrown.cause instanceof Error ? thrown.cause.message : "";
    return new NextResponse(`debug bc4700\n${stage}\n${cause}`.slice(0, 4000), {
      status: 500,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }
  // #endregion
}

async function handle(
  request: NextRequest,
  params: Promise<{ slug: string }>,
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

  // #region agent log
  fetch('http://127.0.0.1:7819/ingest/ddb11756-cca7-49a3-abc9-419b9db515a5',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'bc4700'},body:JSON.stringify({sessionId:'bc4700',runId:'run1',hypothesisId:'C,D',location:'app/j/[slug]/route.ts:35',message:'join lookup returned',data:{slugLength:parsed.data.length,found:household!==null,errorMessage:error?.message??null,errorCode:error?.code??null},timestamp:Date.now()})}).catch(()=>{});
  // #endregion

  // A rejected service key returns no row, exactly like an unknown slug. Without this
  // line a misconfigured deployment is indistinguishable from a stale family link.
  if (error) {
    console.error(`household lookup failed: ${error.message}`);
    // #region agent log
    return new NextResponse(
      `debug bc4700\nquery error ${error.code}: ${error.message}\nhint: ${error.hint ?? ""}`,
      { status: 500, headers: { "Content-Type": "text/plain; charset=utf-8" } },
    );
    // #endregion
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
