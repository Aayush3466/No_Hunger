'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { NotificationType } from '@/lib/supabase/database.types';

export interface AppNotification {
  id: string;
  type: NotificationType;
  payload: Record<string, unknown>;
  read: boolean;
  created_at: string;
}

const LIMIT = 20;

/**
 * Live feed of the current user's notifications.
 * Uses realtime for instant delivery when the tab is open, and refetches on
 * tab focus to catch anything missed while backgrounded.
 */
export function useNotifications(userId: string | null) {
  const supabase = useMemo(() => createClient(), []);
  const [items, setItems] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchNow = useCallback(async () => {
    if (!userId) return;
    const { data } = await supabase
      .from('notifications')
      .select('id, type, payload, read, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(LIMIT);
    setItems((data ?? []) as AppNotification[]);
    setLoading(false);
  }, [supabase, userId]);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }
    void fetchNow();
  }, [userId, fetchNow]);

  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`notifications-${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        () => {
          void fetchNow();
        },
      )
      .subscribe();

    const onVisible = () => {
      if (document.visibilityState === 'visible') void fetchNow();
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      void supabase.removeChannel(channel);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [supabase, userId, fetchNow]);

  const unreadCount = items.filter((n) => !n.read).length;

  return { items, unreadCount, loading, refresh: fetchNow };
}