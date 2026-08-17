'use client';

import { useEffect, useRef } from 'react';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import { useScrollLock } from '@/hooks/useScrollLock';
import styles from './ui.module.css';

/**
 * A small, reusable confirmation modal, styled to match the app (cream card on
 * a dimmed backdrop) so we never fall back to the browser's native
 * `window.confirm()`. Locks background scroll and traps focus while open;
 * closes on Escape, backdrop click, or the cancel button.
 */
export function ConfirmDialog({
  title,
  body,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  tone = 'primary',
  busy = false,
  onConfirm,
  onCancel,
}: {
  title: string;
  body?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'primary' | 'danger';
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  useScrollLock(true);
  useFocusTrap(cardRef, true);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy) onCancel();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onCancel, busy]);

  return (
    <div
      className={styles.modalBackdrop}
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      onClick={(event) => {
        if (event.target === event.currentTarget && !busy) onCancel();
      }}
    >
      <div className={styles.modalCard} ref={cardRef} tabIndex={-1}>
        <h2 id="confirm-dialog-title" className={`serif ${styles.cardTitle}`}>
          {title}
        </h2>
        {body ? <p className={styles.cardBody}>{body}</p> : null}
        <div className={styles.formActions}>
          <button
            type="button"
            className={tone === 'danger' ? 'btn btn-outline' : 'btn btn-primary'}
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? 'Working…' : confirmLabel}
          </button>
          <button type="button" className="btn btn-ghost" onClick={onCancel} disabled={busy}>
            {cancelLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
