'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type {
  AvailableDonation,
  DonationCategory,
  FoodType,
  RequestMode,
} from '@/lib/supabase/database.types';
import { DEFAULT_RADIUS_KM, type LatLng } from '@/lib/geo';
import { useDebouncedCallback } from './useDebouncedCallback';

export interface NearbyFilters {
  radiusKm: number;
  categories: DonationCategory[];
  foodTypes: FoodType[];
  minServings: number;
  mode: RequestMode | null;
}

export const DEFAULT_FILTERS: NearbyFilters = {
  radiusKm: DEFAULT_RADIUS_KM,
  categories: [],
  foodTypes: [],
  minServings: 1,
  mode: null,
};

/** Statuses that mean "this can never appear on the map again". */
const TERMINAL = new Set(['completed', 'expired', 'cancelled']);

/**
 * The map's read path.
 *
 * Three things keep it honest, and all three are needed:
 *
 *  1. get_available_donations() is the only source of truth. It filters status,
 *     expiry and servings server-side, so the client never decides what is live.
 *  2. Realtime events trigger an optimistic local removal for anything that went
 *     terminal, then a debounced refetch. The server always gets the last word.
 *  3. A slow interval refetch plus a refetch on tab focus covers the one case
 *     realtime cannot: a row that stops satisfying the SELECT policy may not
 *     produce a deliverable event at all.
 */
export function useNearbyDonations(center: LatLng | null, filters: NearbyFilters) {
  const supabase = useMemo(() => createClient(), []);
  const [donations, setDonations] = useState<AvailableDonation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Guards against an older in-flight response landing after a newer one.
  const sequence = useRef(0);
  const centerRef = useRef(center);
  const filtersRef = useRef(filters);
  centerRef.current = center;
  filtersRef.current = filters;

  const fetchNow = useCallback(async () => {
    const at = centerRef.current;
    if (!at) return;

    const ticket = ++sequence.current;
    const current = filtersRef.current;

    const { data, error: rpcError } = await supabase.rpc('get_available_donations', {
      p_center_lat: at.lat,
      p_center_lng: at.lng,
      p_radius_km: current.radiusKm,
      p_categories: current.categories.length ? current.categories : null,
      p_food_types: current.foodTypes.length ? current.foodTypes : null,
      p_min_servings: current.minServings,
      p_mode: current.mode,
      p_limit: 120,
    });

    if (ticket !== sequence.current) return; // superseded

    if (rpcError) {
      setError('Could not load food nearby. Pull down to retry.');
    } else {
      setError(null);
      setDonations((data ?? []) as AvailableDonation[]);
    }
    setLoading(false);
  }, [supabase]);

  const refetchDebounced = useDebouncedCallback(() => void fetchNow(), 500);

  /** Drop a marker immediately, without waiting for the server round trip. */
  const removeLocally = useCallback((donationId: string) => {
    setDonations((previous) => previous.filter((item) => item.id !== donationId));
  }, []);

  // First load fires immediately so the map shows food without a 500ms wait.
  // Every later change (map pan, filter tweak) stays debounced so panning
  // doesn't spam the RPC.
  const initialLoadDone = useRef(false);

  useEffect(() => {
    if (!center) return;
    setLoading(true);
    if (initialLoadDone.current) {
      refetchDebounced();
    } else {
      initialLoadDone.current = true;
      void fetchNow();
    }
  }, [
    center?.lat,
    center?.lng,
    filters.radiusKm,
    filters.minServings,
    filters.mode,
    filters.categories.join(','),
    filters.foodTypes.join(','),
    refetchDebounced,
    fetchNow,
    center,
  ]);

  // Realtime.
  useEffect(() => {
    const channel = supabase
      .channel('donations-map')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'donations' },
        (payload) => {
          const next = payload.new as Partial<AvailableDonation> & {
            id?: string;
            status?: string;
            servings_remaining?: number;
            expires_at?: string;
          };
          const old = payload.old as { id?: string };
          const id = next?.id ?? old?.id;

          if (id && payload.eventType === 'DELETE') {
            removeLocally(id);
          } else if (id && next) {
            const gone =
              (next.status !== undefined && TERMINAL.has(next.status)) ||
              (next.servings_remaining !== undefined && next.servings_remaining <= 0) ||
              (next.expires_at !== undefined && Date.parse(next.expires_at) <= Date.now());
            if (gone) removeLocally(id);
          }

          // Whatever we just guessed, ask the authoritative function.
          refetchDebounced();
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [supabase, refetchDebounced, removeLocally]);

  // Safety net: slow poll and a refetch whenever the tab comes back.
  useEffect(() => {
    const interval = window.setInterval(() => void fetchNow(), 45_000);
    const onVisible = () => {
      if (document.visibilityState === 'visible') void fetchNow();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [fetchNow]);

  return {
    donations,
    loading,
    error,
    refetch: fetchNow,
    removeLocally,
  };
}
