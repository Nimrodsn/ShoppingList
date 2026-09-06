"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { randomUUID } from "node:crypto";
import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  clearHouseholdCookie,
  getHousehold,
  requireHousehold,
  setHouseholdCookie,
} from "@/lib/auth/household";
import {
  MEMBER_ID_COOKIE,
  MEMBER_NAME_COOKIE,
} from "@/lib/auth/constants";
import { HouseholdNameSchema, MemberNameSchema, SecretSlugSchema } from "@/lib/schemas";

const MEMBER_COOKIE_MAX_AGE = 31_536_000;

/** Soft identity, deliberately readable by the client so the UI can show "who added this". */
export async function setMemberName(raw: string): Promise<void> {
  await requireHousehold();
  const name = MemberNameSchema.parse(raw);

  const store = await cookies();
  const existingId = store.get(MEMBER_ID_COOKIE)?.value;

  const options = {
    httpOnly: false,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MEMBER_COOKIE_MAX_AGE,
  } as const;

  store.set(MEMBER_NAME_COOKIE, name, options);
  store.set(MEMBER_ID_COOKIE, existingId ?? randomUUID(), options);

  revalidatePath("/");
}

/** Names already seen on this household's items and history, plus the two defaults. */
export async function listKnownMembers(): Promise<string[]> {
  const householdId = await requireHousehold();
  const supabase = supabaseAdmin();

  const [items, history] = await Promise.all([
    supabase
      .from("items")
      .select("added_by")
      .eq("household_id", householdId)
      .not("added_by", "is", null)
      .limit(500),
    supabase
      .from("purchase_history")
      .select("purchased_by")
      .eq("household_id", householdId)
      .not("purchased_by", "is", null)
      .limit(500),
  ]);

  const names = new Set<string>(["אבא", "אמא"]);
  for (const row of items.data ?? []) {
    if (row.added_by) names.add(row.added_by);
  }
  for (const row of history.data ?? []) {
    if (row.purchased_by) names.add(row.purchased_by);
  }

  return [...names];
}

export async function renameHousehold(raw: string): Promise<void> {
  const householdId = await requireHousehold();
  const name = HouseholdNameSchema.parse(raw);

  const { error } = await supabaseAdmin()
    .from("households")
    .update({ name })
    .eq("id", householdId);

  if (error) throw new Error("לא הצלחנו לשמור את שם הבית");

  revalidatePath("/");
  revalidatePath("/settings");
}

/**
 * New slug, bumped generation, new realtime channel. Every other device is
 * disconnected from both the data and the realtime stream immediately.
 * This device gets a refreshed cookie so it stays signed in.
 */
export async function rotateSecrets(): Promise<{ secretSlug: string }> {
  const householdId = await requireHousehold();

  const { data, error } = await supabaseAdmin().rpc("rotate_household_secrets", {
    p_household_id: householdId,
  });

  const rotated = Array.isArray(data) ? data[0] : data;
  if (error || !rotated) {
    throw new Error("לא הצלחנו לייצר קישור חדש");
  }

  await setHouseholdCookie(householdId, rotated.cookie_generation);

  revalidatePath("/");
  revalidatePath("/settings");

  return { secretSlug: rotated.secret_slug };
}

/** Powers the "paste your link" field on the landing screen. */
export async function joinByLink(raw: string): Promise<{ error: string } | void> {
  const slug = raw.trim().split("/j/").pop() ?? "";
  const parsed = SecretSlugSchema.safeParse(slug);

  if (!parsed.success) {
    return { error: "הקישור לא נראה תקין" };
  }

  redirect(`/j/${parsed.data}`);
}

export async function leaveHousehold(): Promise<void> {
  await clearHouseholdCookie();
  redirect("/");
}

export async function currentSecretSlug(): Promise<string | null> {
  const household = await getHousehold();
  if (!household) return null;

  const { data } = await supabaseAdmin()
    .from("households")
    .select("secret_slug")
    .eq("id", household.id)
    .maybeSingle();

  return data?.secret_slug ?? null;
}
