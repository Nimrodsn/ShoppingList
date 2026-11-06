import "server-only";
import { cache } from "react";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { requireHousehold } from "@/lib/auth/household";
import { normalizeHebrew } from "@/lib/hebrew";

export type ForgottenSuggestion = {
  name: string;
  categoryKey: string | null;
  avgDays: number;
  daysSince: number;
  reason: string;
};

/**
 * Products bought on a rhythm that are overdue. The open-list filter runs on the
 * caller side (the list is already loaded there), so this fetch can start in
 * parallel with the board instead of waiting for it.
 */
export const suggestForgotten = cache(
  async (): Promise<ForgottenSuggestion[]> => {
    const householdId = await requireHousehold();

    const { data, error } = await supabaseAdmin().rpc("suggest_forgotten", {
      p_household_id: householdId,
      p_limit: 5,
    });

    if (error || !data) return [];

    return data.map((row) => ({
      name: row.name,
      categoryKey: row.category_key,
      avgDays: row.avg_days,
      daysSince: row.days_since,
      reason: `בדרך כלל כל ${Math.round(row.avg_days)} ימים, עברו ${Math.round(row.days_since)}`,
    }));
  },
);

export type HistoryEntry = {
  id: string;
  name: string;
  quantity: number | null;
  unit: string | null;
  purchasedAt: string;
  purchasedBy: string | null;
};

export type HistoryStat = {
  name: string;
  purchases: number;
};

export const getHistory = cache(
  async (): Promise<{ entries: HistoryEntry[]; top: HistoryStat[] }> => {
    const householdId = await requireHousehold();
    const supabase = supabaseAdmin();

    const { data } = await supabase
      .from("purchase_history")
      .select("id, name, quantity, unit, purchased_at, purchased_by")
      .eq("household_id", householdId)
      .order("purchased_at", { ascending: false })
      .limit(200);

    const entries = (data ?? []).map((row) => ({
      id: row.id,
      name: row.name,
      quantity: row.quantity,
      unit: row.unit,
      purchasedAt: row.purchased_at,
      purchasedBy: row.purchased_by,
    }));

    const counts = new Map<string, { name: string; purchases: number }>();
    for (const entry of entries) {
      const key = normalizeHebrew(entry.name);
      const current = counts.get(key);
      if (current) current.purchases += 1;
      else counts.set(key, { name: entry.name, purchases: 1 });
    }

    const top = [...counts.values()]
      .sort((a, b) => b.purchases - a.purchases)
      .slice(0, 10);

    return { entries, top };
  },
);
