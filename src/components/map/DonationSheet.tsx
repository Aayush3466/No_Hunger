'use client';

/* eslint-disable @next/next/no-img-element */
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { Avatar } from '@/components/ui/Avatar';
import { Countdown } from '@/components/ui/Countdown';
import { SafetyNotice } from '@/components/ui/SafetyNotice';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import { useScrollLock } from '@/hooks/useScrollLock';
import { publicImageUrl } from '@/lib/env';
import { CATEGORY_LABELS, FOOD_TYPE_LABELS, formatAge, formatRating, servingsLabel } from '@/lib/format';
import { formatDistance, type LatLng } from '@/lib/geo';
import type { AvailableDonation, RequestMode } from '@/lib/supabase/database.types';
import { createRequestAction } from '@/server/actions/requests';
import ui from '@/components/ui/ui.module.css';
import styles from './Map.module.css';

export function DonationSheet({
  donation,
  userPosition,
  isAuthenticated,
  onClose,
  onRequested,
}: {
  donation: AvailableDonation;
  userPosition: LatLng | null;
  isAuthenticated: boolean;
  onClose: () => void;
  onRequested: () => void;
}) {
  const offersDelivery = donation.fulfilment_mode !== 'pickup' && donation.delivery_available;
  const offersPickup = donation.fulfilment_mode !== 'delivery';

  const [servings, setServings] = useState(1);
  const [mode, setMode] = useState<RequestMode>(offersPickup ? 'pickup' : 'delivery');
  const [address, setAddress] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  useScrollLock(true);
  useFocusTrap(dialogRef, true);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const max = donation.servings_remaining;
  const imageUrl = publicImageUrl(donation.image_path);

  async function submit() {
    setError(null);

    if (mode === 'delivery' && !userPosition) {
      setError('Turn on location, or switch to pickup, so the donor knows where to bring it.');
      return;
    }

    setPending(true);
    const result = await createRequestAction({
      donation_id: donation.id,
      servings,
      mode,
      dropoff_lat: mode === 'delivery' ? userPosition?.lat : null,
      dropoff_lng: mode === 'delivery' ? userPosition?.lng : null,
      dropoff_address: mode === 'delivery' ? address : '',
    });
    setPending(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }
    setDone(true);
    onRequested();
  }

  return (
    <div
      className={styles.detailBackdrop}
      role="dialog"
      aria-modal="true"
      aria-label={donation.food_name}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className={styles.detail} ref={dialogRef} tabIndex={-1}>
        <div className={ui.rowBetween}>
          <div className={ui.chipRow}>
            <span className={ui.chip}>{CATEGORY_LABELS[donation.category]}</span>
            <span className={`${ui.chip} ${ui.chipHoney}`}>
              {FOOD_TYPE_LABELS[donation.food_type]}
            </span>
            <Countdown expiresAt={donation.expires_at} />
          </div>
          <button
            ref={closeRef}
            type="button"
            className={styles.stepper}
            onClick={onClose}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {imageUrl ? (
          <img src={imageUrl} alt="" className={styles.detailImage} loading="lazy" />
        ) : null}

        <div>
          <h2 className={`serif ${styles.detailTitle}`}>{donation.food_name}</h2>
          <p className={ui.cardMeta}>
            {formatDistance(donation.distance_km)} · {formatAge(donation.created_at)} ·{' '}
            {servingsLabel(donation.servings_remaining)} left of {donation.total_servings}
          </p>
        </div>

        {donation.description ? <p className={ui.cardBody}>{donation.description}</p> : null}

        {donation.allergens ? (
          <p className={ui.cardBody}>
            <strong>Allergens:</strong> {donation.allergens}
          </p>
        ) : null}

        <div className={ui.row}>
          <Avatar name={donation.donor_name} url={donation.donor_avatar_url} />
          <div className={ui.grow}>
            <div style={{ fontWeight: 600 }}>{donation.donor_name}</div>
            <div className={ui.cardMeta}>
              {formatRating(donation.donor_avg_rating, donation.donor_ratings_count)}
            </div>
          </div>
        </div>

        {donation.pickup_address ? (
          <p className={ui.cardMeta}>Pickup near {donation.pickup_address}</p>
        ) : null}

        <SafetyNotice variant="receiver" />

        {done ? (
          <div className={ui.notice} role="status">
            <p className={ui.noticeTitle}>Request sent</p>
            <p className={ui.cardBody}>
              The donor sees it now. You will get a notification the moment they answer.
            </p>
            <div className={ui.formActions}>
              <Link href="/orders" className="btn btn-primary">
                See your requests
              </Link>
              <button type="button" className="btn btn-outline" onClick={onClose}>
                Keep browsing
              </button>
            </div>
          </div>
        ) : !isAuthenticated ? (
          <div className={ui.stack}>
            <p className={ui.cardBody}>Sign in to claim a portion. Browsing stays open to everyone.</p>
            <Link href="/login?next=/map" className="btn btn-primary btn-block">
              Sign in to request
            </Link>
          </div>
        ) : (
          <div className={ui.stack}>
            <div className={ui.field}>
              <span className={ui.label} id="servings-label">
                How many servings do you need?
              </span>
              <div className={styles.servingsPicker} role="group" aria-labelledby="servings-label">
                <button
                  type="button"
                  className={styles.stepper}
                  onClick={() => setServings((n) => Math.max(1, n - 1))}
                  aria-label="One fewer serving"
                  disabled={servings <= 1}
                >
                  −
                </button>
                <span className={styles.servingsValue} aria-live="polite">
                  {servings}
                </span>
                <button
                  type="button"
                  className={styles.stepper}
                  onClick={() => setServings((n) => Math.min(max, n + 1))}
                  aria-label="One more serving"
                  disabled={servings >= max}
                >
                  +
                </button>
                <span className={ui.hint}>{servingsLabel(max)} available</span>
              </div>
            </div>

            {offersPickup && offersDelivery ? (
              <div className={ui.field}>
                <span className={ui.label} id="mode-label">
                  How do you want it?
                </span>
                <div className={ui.segments} role="group" aria-labelledby="mode-label">
                  {(['pickup', 'delivery'] as const).map((option) => (
                    <button
                      key={option}
                      type="button"
                      className={
                        mode === option ? `${ui.segment} ${ui.segmentActive}` : ui.segment
                      }
                      aria-pressed={mode === option}
                      onClick={() => setMode(option)}
                    >
                      {option === 'pickup' ? 'I will collect' : 'Deliver to me'}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <p className={ui.hint}>
                {offersPickup ? 'Pickup only on this listing.' : 'Delivery only on this listing.'}
              </p>
            )}

            {mode === 'delivery' ? (
              <div className={ui.field}>
                <label className={ui.label} htmlFor="dropoff">
                  Dropoff details
                </label>
                <input
                  id="dropoff"
                  className={ui.input}
                  value={address}
                  maxLength={240}
                  placeholder="Flat 3, blue gate opposite the school"
                  onChange={(event) => setAddress(event.target.value)}
                  onFocus={(event) => {
                    // The sheet is bottom-anchored; when the mobile keyboard
                    // opens it can cover this field. Nudge it into view within
                    // the scrollable dialog once the keyboard has settled.
                    const el = event.currentTarget;
                    window.setTimeout(() => el.scrollIntoView({ block: 'center' }), 100);
                  }}
                />
                <p className={ui.hint}>
                  Only the donor sees this, and only while the handover is live.
                </p>
              </div>
            ) : null}

            {error ? (
              <p className={ui.formError} role="alert">
                {error}
              </p>
            ) : null}

            <button
              type="button"
              className="btn btn-primary btn-block"
              onClick={() => void submit()}
              disabled={pending || max < 1}
            >
              {pending ? 'Sending…' : `Request ${servingsLabel(servings)}`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
