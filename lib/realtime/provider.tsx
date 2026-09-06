"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { householdChannel, removeChannel } from "@/lib/supabase/browser";

const REFRESH_DEBOUNCE_MS = 150;

export type PresenceMode = "idle" | "shopping";

export type Peer = {
  id: string;
  name: string;
  mode: PresenceMode;
};

type RealtimeContextValue = {
  peers: Peer[];
  shoppers: Peer[];
  isConnected: boolean;
  setMode: (mode: PresenceMode) => void;
};

const RealtimeContext = createContext<RealtimeContextValue>({
  peers: [],
  shoppers: [],
  isConnected: false,
  setMode: () => {},
});

export function useRealtime(): RealtimeContextValue {
  return useContext(RealtimeContext);
}

type PresencePayload = { id: string; name: string; mode: PresenceMode };

function isPresencePayload(value: unknown): value is PresencePayload {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.id === "string" &&
    typeof candidate.name === "string" &&
    (candidate.mode === "idle" || candidate.mode === "shopping")
  );
}

/**
 * One channel for the whole app, mounted once. Broadcast messages are a notification
 * only: their payload is never used to update the UI, we always re-fetch through
 * `router.refresh()`, debounced so a burst of writes costs one render.
 */
export function RealtimeProvider({
  realtimeKey,
  memberId,
  memberName,
  children,
}: {
  realtimeKey: string;
  memberId: string;
  memberName: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [peers, setPeers] = useState<Peer[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [mode, setModeState] = useState<PresenceMode>("idle");
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    const channel = householdChannel(realtimeKey, memberId);
    channelRef.current = channel;

    let refreshTimer: ReturnType<typeof setTimeout> | null = null;
    const scheduleRefresh = () => {
      if (refreshTimer) clearTimeout(refreshTimer);
      refreshTimer = setTimeout(() => router.refresh(), REFRESH_DEBOUNCE_MS);
    };

    channel
      .on("broadcast", { event: "change" }, scheduleRefresh)
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState();
        const next: Peer[] = [];
        for (const entries of Object.values(state)) {
          for (const entry of entries) {
            if (isPresencePayload(entry)) {
              next.push({ id: entry.id, name: entry.name, mode: entry.mode });
            }
          }
        }
        setPeers(next);
      })
      .subscribe((status) => {
        setIsConnected(status === "SUBSCRIBED");
      });

    return () => {
      if (refreshTimer) clearTimeout(refreshTimer);
      channelRef.current = null;
      removeChannel(channel);
    };
  }, [realtimeKey, memberId, router]);

  // Presence payload is display-only, exactly like the member cookie it comes from.
  useEffect(() => {
    if (!isConnected) return;
    void channelRef.current?.track({ id: memberId, name: memberName, mode });
  }, [isConnected, memberId, memberName, mode]);

  const setMode = useCallback((next: PresenceMode) => setModeState(next), []);

  const value = useMemo<RealtimeContextValue>(
    () => ({
      peers,
      shoppers: peers.filter((peer) => peer.mode === "shopping" && peer.id !== memberId),
      isConnected,
      setMode,
    }),
    [peers, isConnected, setMode, memberId],
  );

  return <RealtimeContext value={value}>{children}</RealtimeContext>;
}
