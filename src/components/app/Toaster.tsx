'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { NotificationType } from '@/lib/supabase/database.types';
import styles from './Toaster.module.css';

interface Toast {
  id: string;
  line: string;
  href: string | null;
  meta: string;
  leaving?: boolean;
}

/**
 * Which notification types are worth interrupting for. Rejections, auto-cancels
 * and cancellations stay silent — they show up in the bell, but a toast for
 * "your request was declined" is unnecessary friction.
 */
const TOAST_TYPES = new Set<NotificationType>([
  'request_created',
  'request_accepted',
  'order_completed',
  'order_timed_out',
]);

function messageFor(type: NotificationType, payload: Record<string, unknown>) {
  const p = payload as Record<string, string | undefined>;
  const food = p.food_name ?? 'a listing';
  const rid = p.request_id;
  const requestLink = rid ? `/orders/${rid}` : '/orders';

  switch (type) {
    case 'request_created':
      return {
        line: `Someone wants ${p.servings ?? ''} of ${food}`.trim(),
        href: '/orders',
        meta: 'New request',
      };
    case 'request_accepted':
      return {
        line: `Your request for ${food} was accepted`,
        href: requestLink,
        meta: 'Accepted',
      };
    case 'order_completed':
      return {
        line: `Handover of ${food} confirmed`,
        href: '/history',
        meta: 'Completed',
      };
    case 'order_timed_out':
      return {
        line: `Order for ${food} timed out`,
        href: '/orders',
        meta: 'Timed out',
      };
    default:
      return { line: 'You have an update', href: '/orders', meta: 'Update' };
  }
}

const AUTO_DISMISS_MS = 6000;
const MAX_ONSCREEN = 3;

/**
 * Toasts appear in the corner when a new notification lands in realtime.
 * Deliberately independent of the bell dropdown — this hooks into the same
 * postgres_changes stream but keeps its own transient state, so a fast tap
 * on the bell doesn't dismiss things the user hasn't seen yet.
 *
 * The Toaster only fires for notifications inserted AFTER it mounts, so
 * refreshing the page does not replay every unread as a toast.
 */
export function Toaster({ userId }: { userId: string }) {
  const supabase = useMemo(() => createClient(), []);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((current) =>
      current.map((t) => (t.id === id ? { ...t, leaving: true } : t)),
    );
    // Wait for animation to finish before removing from DOM.
    window.setTimeout(() => {
      setToasts((current) => current.filter((t) => t.id !== id));
    }, 300);
  }, []);

  useEffect(() => {
    const channel = supabase
      .channel(`toaster-${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const row = payload.new as {
            id: string;
            type: NotificationType;
            payload: Record<string, unknown>;
          };

          if (!TOAST_TYPES.has(row.type)) return;

          const { line, href, meta } = messageFor(row.type, row.payload ?? {});

          setToasts((current) => {
            const next = [...current, { id: row.id, line, href, meta }];
            // Never let the stack grow beyond MAX_ONSCREEN — evict oldest.
            if (next.length > MAX_ONSCREEN) {
              return next.slice(next.length - MAX_ONSCREEN);
            }
            return next;
          });

          window.setTimeout(() => dismiss(row.id), AUTO_DISMISS_MS);
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [supabase, userId, dismiss]);

  if (toasts.length === 0) return null;

  return (
    <div className={styles.container} aria-live="polite" aria-atomic="false">
      {toasts.map((toast) => {
        const className = toast.leaving
          ? `${styles.toast} ${styles.toastLeaving}`
          : styles.toast;

        const inner = (
          <>
            <div className={styles.body}>
              <span className={styles.meta}>{toast.meta}</span>
              <span className={styles.line}>{toast.line}</span>
            </div>
            <button
              type="button"
              className={styles.close}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                dismiss(toast.id);
              }}
              aria-label="Dismiss"
            >
              ×
            </button>
          </>
        );

        if (toast.href) {
          return (
            <Link key={toast.id} href={toast.href} className={className} onClick={() => dismiss(toast.id)}>
              {inner}
            </Link>
          );
        }
        return (
          <div key={toast.id} className={className}>
            {inner}
          </div>
        );
      })}
    </div>
  );
}