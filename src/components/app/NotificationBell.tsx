'use client';

import Link from 'next/link';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { AppNotification } from '@/hooks/useNotifications';
import { useNotifications } from '@/hooks/useNotifications';
import {
  markAllNotificationsReadAction,
  markNotificationsReadAction,
} from '@/server/actions/notifications';
import { formatAge } from '@/lib/format';
import styles from './NotificationBell.module.css';

function messageFor(n: AppNotification): { line: string; href: string | null } {
  const p = n.payload as Record<string, string | undefined>;
  const food = p.food_name ?? 'a listing';
  const rid = p.request_id;
  const requestLink = rid ? `/orders/${rid}` : '/orders';

  switch (n.type) {
    case 'request_created':
      return { line: `Someone wants ${p.servings ?? ''} of ${food}`.trim(), href: '/orders' };
    case 'request_accepted':
      return { line: `Your request for ${food} was accepted`, href: requestLink };
    case 'request_rejected':
      return { line: `Your request for ${food} was declined`, href: '/orders' };
    case 'request_cancelled':
      return { line: `An order for ${food} was cancelled`, href: '/orders' };
    case 'request_auto_rejected':
      return { line: `Your request for ${food} could not be filled`, href: '/orders' };
    case 'order_completed':
      return { line: `Handover of ${food} confirmed`, href: '/history' };
    case 'order_timed_out':
      return { line: `Order for ${food} timed out`, href: '/orders' };
    case 'rating_received':
      return { line: `Someone rated your handover of ${food}`, href: '/profile' };
    default:
      return { line: 'You have an update', href: '/orders' };
  }
}

export function NotificationBell({ userId }: { userId: string }) {
  const { items, unreadCount, refresh } = useNotifications(userId);
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [anchor, setAnchor] = useState<{ top: number; right: number } | null>(null);

  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Portal target is document.body. Wait until we're in the browser.
  useEffect(() => {
    setMounted(true);
  }, []);

  // When the panel opens, measure the trigger button's position and pin the
  // panel just below its right edge. Recompute on window resize.
  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return;
    function place() {
      const rect = triggerRef.current!.getBoundingClientRect();
      setAnchor({
        top: rect.bottom + 8,
        right: Math.max(8, window.innerWidth - rect.right),
      });
    }
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [open]);

  // Close on outside click. We check BOTH the trigger and the portalled panel,
  // because in a portal the panel is not a descendant of triggerRef.
  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      const t = e.target as Node;
      if (triggerRef.current?.contains(t)) return;
      if (panelRef.current?.contains(t)) return;
      setOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  async function handleOpen() {
    const willOpen = !open;
    setOpen(willOpen);
    if (willOpen && unreadCount > 0) {
      const unread = items.filter((n) => !n.read).map((n) => n.id);
      if (unread.length > 0) {
        await markNotificationsReadAction(unread);
        void refresh();
      }
    }
  }

  async function clearAll() {
    await markAllNotificationsReadAction();
    void refresh();
  }

  const panel = open && anchor ? (
    <div
      ref={panelRef}
      className={styles.panel}
      role="dialog"
      aria-label="Recent notifications"
      style={{ top: anchor.top, right: anchor.right }}
    >
      <div className={styles.panelHeader}>
        <span className={styles.panelTitle}>Notifications</span>
        {items.some((n) => !n.read) ? (
          <button type="button" className={styles.markAll} onClick={() => void clearAll()}>
            Mark all read
          </button>
        ) : null}
      </div>

      {items.length === 0 ? (
        <p className={styles.empty}>Nothing here yet. Requests and updates arrive live.</p>
      ) : (
        <ul className={styles.list}>
          {items.map((n) => {
            const { line, href } = messageFor(n);
            return (
              <li key={n.id} className={n.read ? styles.item : `${styles.item} ${styles.itemUnread}`}>
                {href ? (
                  <Link href={href} className={styles.itemLink} onClick={() => setOpen(false)}>
                    <span className={styles.itemLine}>{line}</span>
                    <span className={styles.itemMeta}>{formatAge(n.created_at)}</span>
                  </Link>
                ) : (
                  <div className={styles.itemLink}>
                    <span className={styles.itemLine}>{line}</span>
                    <span className={styles.itemMeta}>{formatAge(n.created_at)}</span>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  ) : null;

  return (
    <div className={styles.wrap}>
      <button
        ref={triggerRef}
        type="button"
        className={styles.trigger}
        onClick={handleOpen}
        aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ''}`}
        aria-expanded={open}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
          <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
        </svg>
        {unreadCount > 0 ? (
          <span className={styles.badge} aria-hidden="true">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        ) : null}
      </button>

      {mounted && panel ? createPortal(panel, document.body) : null}
    </div>
  );
}