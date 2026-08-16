'use client';

import { useCallback, useMemo, useState } from 'react';
import Link from 'next/link';
import { Avatar } from '@/components/ui/Avatar';
import { EmptyState } from '@/components/ui/EmptyState';
import { RatingModal } from '@/components/orders/RatingModal';
import { MODE_LABELS, servingsLabel } from '@/lib/format';
import { useHistory, type HistoryEntry } from '@/hooks/useHistory';
import ui from '@/components/ui/ui.module.css';
import styles from './History.module.css';

function StarsRow({ stars }: { stars: number }) {
  return (
    <span aria-label={`${stars} out of 5 stars`} className={styles.staticStars}>
      {[1, 2, 3, 4, 5].map((n) => (
        <span key={n} className={n <= stars ? styles.staticStarOn : styles.staticStarOff}>
          ★
        </span>
      ))}
    </span>
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

export function HistoryClient({ userId }: { userId: string }) {
  const { items, loading, error, refresh } = useHistory(userId);
  const [rating, setRating] = useState<HistoryEntry | null>(null);

  const closeRating = useCallback(() => setRating(null), []);
  const onRated = useCallback(() => {
    setRating(null);
    void refresh();
  }, [refresh]);

  const empty = !loading && items.length === 0;

  if (error) {
    return (
      <div className={ui.stack}>
        <p className={ui.formError} role="alert">
          {error}
        </p>
        <button type="button" className="btn btn-outline" onClick={() => void refresh()}>
          Try again
        </button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className={ui.card}>
        <p className={ui.cardMeta}>Loading your history…</p>
      </div>
    );
  }

  if (empty) {
    return (
      <div className={ui.card}>
        <EmptyState
          title="Nothing completed yet"
          body="Once a handover is confirmed it lands here, for the donor and the receiver alike."
          action={
            <Link href="/map" className="btn btn-primary">
              Find food nearby
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className={ui.stack}>
      {items.map((entry) => (
        <article key={entry.request_id} className={ui.card}>
          <div className={ui.row}>
            <Avatar name={entry.counterpart_name} url={entry.counterpart_avatar_url} />
            <div className={ui.grow}>
              <div style={{ fontWeight: 600 }}>{entry.food_name}</div>
              <div className={ui.cardMeta}>
                {entry.role === 'donor' ? 'You gave to' : 'You received from'}{' '}
                {entry.counterpart_name} · {servingsLabel(entry.servings)} ·{' '}
                {MODE_LABELS[entry.mode]}
              </div>
              <div className={ui.cardMeta}>{formatDate(entry.completed_at)}</div>
            </div>
          </div>

          <div className={styles.ratings}>
            <div className={styles.ratingBlock}>
              <span className={styles.ratingLabel}>Your rating</span>
              {entry.my_rating ? (
                <>
                  <StarsRow stars={entry.my_rating.stars} />
                  {entry.my_rating.comment ? (
                    <p className={styles.ratingComment}>“{entry.my_rating.comment}”</p>
                  ) : null}
                </>
              ) : (
                <span className={ui.hint}>Not rated yet</span>
              )}
              <button
                type="button"
                className={`btn btn-ghost ${styles.ratingButton}`}
                onClick={() => setRating(entry)}
              >
                {entry.my_rating ? 'Edit rating' : 'Rate this handover'}
              </button>
            </div>

            <div className={styles.ratingBlock}>
              <span className={styles.ratingLabel}>Their rating of you</span>
              {entry.their_rating ? (
                <>
                  <StarsRow stars={entry.their_rating.stars} />
                  {entry.their_rating.comment ? (
                    <p className={styles.ratingComment}>“{entry.their_rating.comment}”</p>
                  ) : null}
                </>
              ) : (
                <span className={ui.hint}>Not yet</span>
              )}
            </div>
          </div>
        </article>
      ))}

      {rating ? (
        <RatingModal
          requestId={rating.request_id}
          rateeId={rating.counterpart_id}
          rateeName={rating.counterpart_name}
          initialStars={rating.my_rating?.stars}
          initialComment={rating.my_rating?.comment ?? undefined}
          onClose={closeRating}
          onDone={onRated}
        />
      ) : null}
    </div>
  );
}