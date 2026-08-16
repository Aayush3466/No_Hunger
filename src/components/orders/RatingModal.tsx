'use client';

import { useEffect, useState } from 'react';
import { submitRatingAction } from '@/server/actions/ratings';
import ui from '@/components/ui/ui.module.css';
import styles from './RatingModal.module.css';

export function RatingModal({
  requestId,
  rateeId,
  rateeName,
  initialStars,
  initialComment,
  onClose,
  onDone,
}: {
  requestId: string;
  rateeId: string;
  rateeName: string;
  initialStars?: number;
  initialComment?: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const [stars, setStars] = useState(initialStars ?? 0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState(initialComment ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function submit() {
    if (stars < 1) {
      setError('Pick at least one star.');
      return;
    }
    setBusy(true);
    setError(null);
    const result = await submitRatingAction({
      request_id: requestId,
      ratee_id: rateeId,
      stars,
      comment,
    });
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    onDone();
  }

  const display = hover || stars;

  return (
    <div
      className={styles.backdrop}
      role="dialog"
      aria-modal="true"
      aria-labelledby="rate-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className={styles.card}>
        <h2 id="rate-title" className={`serif ${ui.cardTitle}`}>
          Rate this handover
        </h2>
        <p className={ui.cardMeta}>
          How was your experience with {rateeName}? Only they will see the details.
        </p>

        <div
          className={styles.stars}
          role="radiogroup"
          aria-label="Stars"
          onMouseLeave={() => setHover(0)}
        >
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={stars === n}
              aria-label={`${n} star${n === 1 ? '' : 's'}`}
              className={n <= display ? `${styles.star} ${styles.starActive}` : styles.star}
              onClick={() => setStars(n)}
              onMouseEnter={() => setHover(n)}
            >
              ★
            </button>
          ))}
        </div>

        <label className={ui.field}>
          <span className={ui.label}>Add a note (optional)</span>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            maxLength={400}
            rows={3}
            className={ui.textarea}
            placeholder="What made this a good or bad handover?"
          />
        </label>

        {error ? (
          <p className={ui.formError} role="alert">
            {error}
          </p>
        ) : null}

        <div className={ui.formActions}>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => void submit()}
            disabled={busy}
          >
            {busy ? 'Saving…' : initialStars ? 'Update rating' : 'Submit rating'}
          </button>
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={busy}>
            Skip
          </button>
        </div>
      </div>
    </div>
  );
}