'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { RequestMode } from '@/lib/supabase/database.types';

export interface HistoryEntry {
  request_id: string;
  donation_id: string;
  role: 'donor' | 'receiver';
  food_name: string;
  servings: number;
  mode: RequestMode;
  completed_at: string;
  counterpart_id: string;
  counterpart_name: string;
  counterpart_avatar_url: string | null;
  /** How the current user rated the counterpart, if at all. */
  my_rating: { id: string; stars: number; comment: string | null } | null;
  /** How the counterpart rated the current user, if at all. */
  their_rating: { stars: number; comment: string | null } | null;
}

/**
 * Loads the current user's completed handovers, both sides, newest first, with
 * the two ratings that may already exist.
 *
 * Uses two queries — the writes here would be an SQL view/function but that
 * would need a migration. This is fine on the free tier: one query per side,
 * done in parallel, both under RLS.
 */
export function useHistory(userId: string | null) {
  const supabase = useMemo(() => createClient(), []);
  const [items, setItems] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!userId) return;

    const [asReceiver, asDonor] = await Promise.all([
      supabase
        .from('requests')
        .select(
          `
          id,
          donation_id,
          servings_requested,
          fulfilment_mode,
          completed_at,
          donations!inner (id, donor_id, food_name),
          donor:donations!inner (donor_id)
        `,
        )
        .eq('receiver_id', userId)
        .eq('status', 'completed')
        .order('completed_at', { ascending: false })
        .limit(100),

      supabase
        .from('requests')
        .select(
          `
          id,
          donation_id,
          servings_requested,
          fulfilment_mode,
          completed_at,
          receiver_id,
          donations!inner (id, donor_id, food_name)
        `,
        )
        .eq('donations.donor_id', userId)
        .eq('status', 'completed')
        .order('completed_at', { ascending: false })
        .limit(100),
    ]);

    if (asReceiver.error || asDonor.error) {
      setError('Could not load history. Try again.');
      setLoading(false);
      return;
    }

    // Merge and resolve counterpart. We need each counterpart's public profile
    // and every rating attached to any of these requests.
    type ReceiverRow = {
      id: string;
      donation_id: string;
      servings_requested: number;
      fulfilment_mode: RequestMode;
      completed_at: string | null;
      donations: { id: string; donor_id: string; food_name: string };
    };
    type DonorRow = ReceiverRow & { receiver_id: string };

    const rReceiver = (asReceiver.data ?? []) as unknown as ReceiverRow[];
    const rDonor = (asDonor.data ?? []) as unknown as DonorRow[];

    const counterpartIds = new Set<string>();
    for (const r of rReceiver) counterpartIds.add(r.donations.donor_id);
    for (const r of rDonor) counterpartIds.add(r.receiver_id);

    const requestIds = [...rReceiver.map((r) => r.id), ...rDonor.map((r) => r.id)];

    const [profilesRes, ratingsRes] = await Promise.all([
      counterpartIds.size
        ? supabase
            .from('public_profiles')
            .select('id, full_name, avatar_url')
            .in('id', [...counterpartIds])
        : Promise.resolve({ data: [], error: null }),
      requestIds.length
        ? supabase
            .from('ratings')
            .select('id, request_id, rater_id, ratee_id, stars, comment')
            .in('request_id', requestIds)
        : Promise.resolve({ data: [], error: null }),
    ]);

    const profiles = new Map<string, { full_name: string; avatar_url: string | null }>();
    for (const p of (profilesRes.data ?? []) as Array<{
      id: string;
      full_name: string;
      avatar_url: string | null;
    }>) {
      profiles.set(p.id, { full_name: p.full_name, avatar_url: p.avatar_url });
    }

    type RatingRow = {
      id: string;
      request_id: string;
      rater_id: string;
      ratee_id: string;
      stars: number;
      comment: string | null;
    };
    const ratingsByRequest = new Map<string, RatingRow[]>();
    for (const r of (ratingsRes.data ?? []) as RatingRow[]) {
      const list = ratingsByRequest.get(r.request_id) ?? [];
      list.push(r);
      ratingsByRequest.set(r.request_id, list);
    }

    function pickRatings(reqId: string, meId: string) {
      const list = ratingsByRequest.get(reqId) ?? [];
      const mine = list.find((r) => r.rater_id === meId) ?? null;
      const theirs = list.find((r) => r.ratee_id === meId) ?? null;
      return {
        my_rating: mine ? { id: mine.id, stars: mine.stars, comment: mine.comment } : null,
        their_rating: theirs ? { stars: theirs.stars, comment: theirs.comment } : null,
      };
    }

    const receiverEntries: HistoryEntry[] = rReceiver.map((r) => {
      const cp = profiles.get(r.donations.donor_id);
      const rt = pickRatings(r.id, userId);
      return {
        request_id: r.id,
        donation_id: r.donation_id,
        role: 'receiver',
        food_name: r.donations.food_name,
        servings: r.servings_requested,
        mode: r.fulfilment_mode,
        completed_at: r.completed_at ?? new Date(0).toISOString(),
        counterpart_id: r.donations.donor_id,
        counterpart_name: cp?.full_name ?? 'A neighbour',
        counterpart_avatar_url: cp?.avatar_url ?? null,
        ...rt,
      };
    });

    const donorEntries: HistoryEntry[] = rDonor.map((r) => {
      const cp = profiles.get(r.receiver_id);
      const rt = pickRatings(r.id, userId);
      return {
        request_id: r.id,
        donation_id: r.donation_id,
        role: 'donor',
        food_name: r.donations.food_name,
        servings: r.servings_requested,
        mode: r.fulfilment_mode,
        completed_at: r.completed_at ?? new Date(0).toISOString(),
        counterpart_id: r.receiver_id,
        counterpart_name: cp?.full_name ?? 'A neighbour',
        counterpart_avatar_url: cp?.avatar_url ?? null,
        ...rt,
      };
    });

    const merged = [...receiverEntries, ...donorEntries].sort(
      (a, b) => Date.parse(b.completed_at) - Date.parse(a.completed_at),
    );

    setItems(merged);
    setError(null);
    setLoading(false);
  }, [supabase, userId]);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    void load();
  }, [userId, load]);

  return { items, loading, error, refresh: load };
}