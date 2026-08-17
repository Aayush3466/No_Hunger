'use client';

import { useEffect, useRef, useState } from 'react';
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

  // Keep the latest onExpire in a ref so the interval effect depends only on
  // `expiresAt`. Callers routinely pass an inline arrow (new identity every
  // render); without this the timer tore down and rebuilt on every re-render.
  const onExpireRef = useRef(onExpire);
  onExpireRef.current = onExpire;

  useEffect(() => {
    const remaining = Date.parse(expiresAt) - Date.now();
    if (remaining <= 0) {
      onExpireRef.current?.();
      return;
    }
    const interval = remaining < 5 * 60_000 ? 1_000 : 30_000;
    const id = window.setInterval(() => {
      const next = Date.now();
      setNow(next);
      if (Date.parse(expiresAt) - next <= 0) {
        window.clearInterval(id);
        onExpireRef.current?.();
      }
    }, interval);
    return () => window.clearInterval(id);
  }, [expiresAt]);

  const label = formatCountdown(expiresAt, now);
  const urgent = Date.parse(expiresAt) - now < 30 * 60_000;
  const Tag = as;

  return (
    <Tag className={urgent ? `${styles.chip} ${styles.chipUrgent}` : styles.chip}>{label}</Tag>
  );
}
