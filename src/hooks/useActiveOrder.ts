'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { LatLng } from '@/lib/geo';

/**
 * Shape returned by public.get_order_details(). Matches the JSON built in the
 * SQL function. Fields only present for delivery mode are optional.
 */
export interface OrderDetails {
  request_id: string;
  donation_id: string;
  role: 'donor' | 'receiver';
  mode: 'pickup' | 'delivery';
  food_name: string;
  servings: number;
  accepted_at: string;
  pickup: { lat: number; lng: number; address: string | null };
  counterpart: {
    id: string;
    full_name: string;
    avatar_url: string | null;
    phone: string | null;
  };
  dropoff?: { lat: number; lng: number; address: string | null };
}

const POLL_MS = 45_000;

/**
 * Fetches an active order's shared detail. Returns null when the order stops
 * being 'accepted' — the DB function returns null then, so the caller can
 * gracefully route the user to history or wherever.
 *
 * Not realtime by design: your Supabase realtime quota is finite, and 45 s +
 * tab-focus refresh is enough. There's a `refresh()` for a manual button.
 */
export function useActiveOrder(requestId: string | null) {
  const supabase = useMemo(() => createClient(), []);
  const [details, setDetails] = useState<OrderDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [gone, setGone] = useState(false);

  const sequence = useRef(0);

  const fetchNow = useCallback(async () => {
    if (!requestId) return;
    const ticket = ++sequence.current;

    const { data, error: rpcError } = await supabase.rpc('get_order_details', {
      p_request_id: requestId,
    });

    if (ticket !== sequence.current) return;

    if (rpcError) {
      setError('Could not load this order. Trying again shortly.');
      setLoading(false);
      return;
    }
    setError(null);

    // The SQL returns NULL when the order is no longer accepted (completed,
    // cancelled, or not a party). Signal that to the caller.
    if (data === null) {
      setDetails(null);
      setGone(true);
    } else {
      setDetails(data as unknown as OrderDetails);
      setGone(false);
    }
    setLoading(false);
  }, [requestId, supabase]);

  useEffect(() => {
    if (!requestId) return;
    setLoading(true);
    void fetchNow();

    const interval = window.setInterval(() => void fetchNow(), POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === 'visible') void fetchNow();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [requestId, fetchNow]);

  return { details, loading, error, gone, refresh: fetchNow };
}

/** OSRM public server. No key needed. Returns null if it can't route. */
export async function fetchRoute(a: LatLng, b: LatLng): Promise<LatLng[] | null> {
  try {
    const url =
      `https://router.project-osrm.org/route/v1/driving/` +
      `${a.lng},${a.lat};${b.lng},${b.lat}?geometries=geojson&overview=full`;
    const response = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!response.ok) return null;
    const json = (await response.json()) as {
      routes?: Array<{ geometry?: { coordinates?: [number, number][] } }>;
    };
    const coords = json.routes?.[0]?.geometry?.coordinates;
    if (!coords) return null;
    // OSRM returns [lng, lat] pairs, flip to LatLng.
    return coords.map(([lng, lat]) => ({ lat, lng }));
  } catch {
    return null;
  }
}