import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { serverEnv } from "@/lib/env";
import { signPayload, verifySignature } from "@/lib/auth/signing";
import {
  HOUSEHOLD_COOKIE,
  HOUSEHOLD_COOKIE_MAX_AGE,
  IS_SECURE_COOKIE,
  MEMBER_ID_COOKIE,
  MEMBER_NAME_COOKIE,
} from "@/lib/auth/constants";

export type Household = {
  id: string;
  name: string;
  cookieGeneration: number;
  realtimeKey: string;
};

/** Soft identity. Not httpOnly, forgeable, display only. Never an authorization input. */
export type Member = {
  id: string;
  name: string;
};

export class HouseholdAccessError extends Error {
  constructor() {
    super("אין הרשאה לגשת לרשימה. פתחו מחדש את הקישור המשפחתי.");
    this.name = "HouseholdAccessError";
  }
}

export function buildHouseholdCookie(
  householdId: string,
  generation: number,
): string {
  const payload = `${householdId}.${generation}`;
  return `${payload}.${signPayload(payload, serverEnv().APP_SECRET)}`;
}

export const HOUSEHOLD_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: IS_SECURE_COOKIE,
  sameSite: "lax",
  path: "/",
  maxAge: HOUSEHOLD_COOKIE_MAX_AGE,
} as const;

/**
 * Verifies the signed cookie and confirms `cookie_generation` still matches the row.
 * Cached per request, so a page with many server calls hits Postgres once.
 * Returns null instead of throwing so Server Components can render the landing screen.
 */
export const getHousehold = cache(async (): Promise<Household | null> => {
  const raw = (await cookies()).get(HOUSEHOLD_COOKIE)?.value;
  if (!raw) return null;

  const parts = raw.split(".");
  if (parts.length !== 3) return null;

  const [householdId, generationRaw, signature] = parts;
  if (!verifySignature(`${householdId}.${generationRaw}`, signature, serverEnv().APP_SECRET)) {
    return null;
  }

  const generation = Number.parseInt(generationRaw, 10);
  if (!Number.isInteger(generation)) return null;

  const { data, error } = await supabaseAdmin()
    .from("households")
    .select("id, name, cookie_generation, realtime_key")
    .eq("id", householdId)
    .maybeSingle();

  if (error || !data || data.cookie_generation !== generation) {
    return null;
  }

  return {
    id: data.id,
    name: data.name,
    cookieGeneration: data.cookie_generation,
    realtimeKey: data.realtime_key,
  };
});

/** First line of every Server Action. Throws when the cookie is missing, forged or stale. */
export async function requireHousehold(): Promise<string> {
  const household = await getHousehold();
  if (!household) {
    throw new HouseholdAccessError();
  }
  return household.id;
}

export async function setHouseholdCookie(
  householdId: string,
  generation: number,
): Promise<void> {
  (await cookies()).set(
    HOUSEHOLD_COOKIE,
    buildHouseholdCookie(householdId, generation),
    HOUSEHOLD_COOKIE_OPTIONS,
  );
}

export async function clearHouseholdCookie(): Promise<void> {
  (await cookies()).delete(HOUSEHOLD_COOKIE);
}

export const getMember = cache(async (): Promise<Member | null> => {
  const store = await cookies();
  const name = store.get(MEMBER_NAME_COOKIE)?.value;
  const id = store.get(MEMBER_ID_COOKIE)?.value;
  if (!name || !id) return null;
  return { id, name };
});
