'use client';

import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import styles from './Landing.module.css';

/**
 * Interactive shell for the landing header nav. On desktop it renders the
 * links + auth CTA inline exactly as before (the hamburger is hidden via CSS).
 * On mobile it collapses them into a dropdown panel toggled by the hamburger.
 *
 * The auth CTA (avatar / logout / sign-in) is rendered on the server and passed
 * in as `authSlot`, so nothing about auth moves to the client.
 */
export function HeaderNav({ authSlot }: { authSlot: ReactNode }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const close = () => setOpen(false);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (e: PointerEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    // If the viewport grows back to desktop, the panel must never stay "stuck".
    const mq = window.matchMedia('(min-width: 801px)');
    const onMq = () => {
      if (mq.matches) setOpen(false);
    };

    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    mq.addEventListener('change', onMq);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
      mq.removeEventListener('change', onMq);
    };
  }, [open]);

  return (
    <div className={styles.navWrap} ref={wrapRef}>
      <button
        type="button"
        className={`${styles.navToggle} ${open ? styles.navToggleOpen : ''}`}
        aria-label={open ? 'Close menu' : 'Open menu'}
        aria-expanded={open}
        aria-controls="site-nav-links"
        onClick={() => setOpen((v) => !v)}
      >
        <span className={styles.navToggleBar} aria-hidden="true" />
        <span className={styles.navToggleBar} aria-hidden="true" />
        <span className={styles.navToggleBar} aria-hidden="true" />
      </button>

      <div
        id="site-nav-links"
        className={`${styles.navLinks} ${open ? styles.navLinksOpen : ''}`}
      >
        <a href="#how" onClick={close}>How it works</a>
        <a href="#features" onClick={close}>Features</a>
        <a href="#about" onClick={close}>About</a>
        {authSlot}
      </div>
    </div>
  );
}