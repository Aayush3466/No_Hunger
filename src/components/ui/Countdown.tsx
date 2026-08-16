'use client';

import { useEffect, useState } from 'react';
import { formatCountdown } from '@/lib/format';
import styles from './ui.module.css';

/**
 * Live expiry countdown. Ticks once a minute, or every second in the last five,
 * and calls onExpire exactly once so the caller can drop the listing locally
 * without waiting for the next cron tick or realtime event.
 */
export function Countdown({
  expiresAt,
  onExpire,
  as = 'span',
}: {
  expiresAt: string;
  onExpire?: () => void;
  as?: 'span' | 'div';
}) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const remaining = Date.parse(expiresAt) - Date.now();
    if (remaining <= 0) {
      onExpire?.();
      return;
    }
    const interval = remaining < 5 * 60_000 ? 1_000 : 30_000;
    const id = window.setInterval(() => {
      const next = Date.now();
      setNow(next);
      if (Date.parse(expiresAt) - next <= 0) {
        window.clearInterval(id);
        onExpire?.();
      }
    }, interval);
    return () => window.clearInterval(id);
  }, [expiresAt, onExpire]);

  const label = formatCountdown(expiresAt, now);
  const urgent = Date.parse(expiresAt) - now < 30 * 60_000;
  const Tag = as;

  return (
    <Tag className={urgent ? `${styles.chip} ${styles.chipUrgent}` : styles.chip}>{label}</Tag>
  );
}
