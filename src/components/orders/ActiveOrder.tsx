'use client';

/* eslint-disable @next/next/no-img-element */
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Avatar } from '@/components/ui/Avatar';
import { EmptyState } from '@/components/ui/EmptyState';
import { RatingModal } from '@/components/orders/RatingModal';
import type { LatLng } from '@/lib/geo';
import { formatDistance, haversineKm } from '@/lib/geo';
import { MODE_LABELS, servingsLabel } from '@/lib/format';
import { fetchRoute, useActiveOrder } from '@/hooks/useActiveOrder';
import { cancelRequestAction, completeRequestAction } from '@/server/actions/requests';
import ui from '@/components/ui/ui.module.css';
import styles from '@/components/map/Map.module.css';

const MapCanvas = dynamic(() => import('@/components/map/MapCanvas'), {
  ssr: false,
  loading: () => <div className={styles.mapSkeleton}>Loading the map…</div>,
});

export function ActiveOrder({ requestId }: { requestId: string }) {
  const { details, loading, error, gone, refresh } = useActiveOrder(requestId);
  const [route, setRoute] = useState<LatLng[] | null>(null);
  const [routeTick, setRouteTick] = useState(0);
  const [busy, setBusy] = useState<'complete' | 'cancel' | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  // Once completion succeeds we keep a stripped-down record so the rating
  // modal can still identify the counterpart, even after the order 'goes'.
  const [ratingCtx, setRatingCtx] = useState<{
    requestId: string;
    rateeId: string;
    rateeName: string;
  } | null>(null);

  const { pickup, dropoff } = useMemo(() => {
    if (!details) return { pickup: null as LatLng | null, dropoff: null as LatLng | null };
    return {
      pickup: { lat: details.pickup.lat, lng: details.pickup.lng },
      dropoff: details.dropoff ? { lat: details.dropoff.lat, lng: details.dropoff.lng } : null,
    };
  }, [details]);

  useEffect(() => {
    if (!details || !pickup) return;
    const from = details.mode === 'delivery' ? pickup : pickup;
    const to = details.mode === 'delivery' ? (dropoff ?? pickup) : pickup;
    if (from.lat === to.lat && from.lng === to.lng) {
      setRoute(null);
      return;
    }
    let cancelled = false;
    void fetchRoute(from, to).then((r) => {
      if (!cancelled) {
        setRoute(r);
        setRouteTick((n) => n + 1);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [details, pickup, dropoff]);

  const fitPoints = useMemo<LatLng[]>(() => {
    if (!pickup) return [];
    if (dropoff) return [pickup, dropoff];
    return [pickup];
  }, [pickup, dropoff]);

  const orderMarkers = useMemo(() => {
    if (!pickup) return [];
    const out: Array<{ position: LatLng; label: string; tone: 'green' | 'honey' }> = [
      { position: pickup, label: 'Pickup', tone: 'green' },
    ];
    if (dropoff) out.push({ position: dropoff, label: 'Dropoff', tone: 'honey' });
    return out;
  }, [pickup, dropoff]);

  const distanceKm = useMemo(() => {
    if (!pickup || !dropoff) return null;
    return haversineKm(pickup, dropoff);
  }, [pickup, dropoff]);

  const canConfirm = useMemo(() => {
    if (!details) return false;
    if (details.mode === 'pickup') return details.role === 'donor';
    return details.role === 'receiver';
  }, [details]);

  const handleComplete = useCallback(async () => {
    if (!details) return;
    setBusy('complete');
    setActionMessage(null);

    // Capture counterpart before we lose access — the order goes null the
    // moment status flips off 'accepted'.
    const capture = {
      requestId: details.request_id,
      rateeId: details.counterpart.id,
      rateeName: details.counterpart.full_name,
    };

    const result = await completeRequestAction(details.request_id);
    setBusy(null);
    if (!result.ok) {
      setActionMessage(result.error ?? 'Could not complete the order.');
      return;
    }
    setRatingCtx(capture);
    void refresh();
  }, [details, refresh]);

  const handleCancel = useCallback(async () => {
    if (!details) return;
    const reason = details.role === 'donor' ? 'donor_cancelled' : 'receiver_cancelled';
    if (!window.confirm('Cancel this order? The servings go back on the map.')) return;
    setBusy('cancel');
    setActionMessage(null);
    const result = await cancelRequestAction(details.request_id, reason);
    setBusy(null);
    if (!result.ok) {
      setActionMessage(result.error ?? 'Could not cancel.');
      return;
    }
    void refresh();
  }, [details, refresh]);

  if (loading) {
    return (
      <div className={ui.stack}>
        <div className={ui.card}>
          <p className={ui.cardMeta}>Loading the order…</p>
        </div>
      </div>
    );
  }

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

  if (gone || !details) {
    return (
      <div className={ui.stack}>
        <div className={ui.card}>
          <EmptyState
            title="This order has ended"
            body="It was completed, cancelled, or you are no longer a party to it. Contact details and tracking are no longer available."
            action={
              <Link href="/orders" className="btn btn-primary">
                Back to orders
              </Link>
            }
          />
        </div>
        {ratingCtx ? (
          <RatingModal
            requestId={ratingCtx.requestId}
            rateeId={ratingCtx.rateeId}
            rateeName={ratingCtx.rateeName}
            onClose={() => setRatingCtx(null)}
            onDone={() => setRatingCtx(null)}
          />
        ) : null}
      </div>
    );
  }

  const { counterpart } = details;
  const centre = pickup ?? { lat: 27.7172, lng: 85.324 };

  return (
    <div className={ui.stack}>
      {actionMessage ? (
        <p className={ui.formError} role="alert">
          {actionMessage}
        </p>
      ) : null}

      <div
        style={{
          position: 'relative',
          height: 'min(320px, 45dvh)',
          borderRadius: 'var(--nh-radius-2xl)',
          overflow: 'hidden',
          border: '1px solid var(--nh-ink-08)',
        }}
      >
        <MapCanvas
          center={centre}
          orderMarkers={orderMarkers}
          route={route ?? undefined}
          fitPoints={fitPoints}
          fitTrigger={routeTick}
        />
      </div>

      <section className={ui.card}>
        <div className={ui.row}>
          <Avatar name={counterpart.full_name} url={counterpart.avatar_url} size={48} />
          <div className={ui.grow}>
            <div style={{ fontWeight: 600 }}>{counterpart.full_name}</div>
            <div className={ui.cardMeta}>
              {details.role === 'donor' ? 'Receiver' : 'Donor'} · {MODE_LABELS[details.mode]}
            </div>
          </div>
          <span className={ui.chip}>Active</span>
        </div>

        <p className={ui.cardBody} style={{ marginTop: '.75rem' }}>
          <strong>{details.food_name}</strong> · {servingsLabel(details.servings)}
        </p>

        {details.pickup.address ? (
          <p className={ui.cardMeta}>Pickup: {details.pickup.address}</p>
        ) : null}
        {details.dropoff?.address ? (
          <p className={ui.cardMeta}>Dropoff: {details.dropoff.address}</p>
        ) : null}
        {distanceKm !== null ? (
          <p className={ui.cardMeta}>Straight-line distance: {formatDistance(distanceKm)}</p>
        ) : null}

        <div className={ui.formActions}>
          {counterpart.phone ? (
            <a href={`tel:${counterpart.phone}`} className="btn btn-primary">
              Call {counterpart.full_name.split(' ')[0]}
            </a>
          ) : (
            <span className={ui.hint}>No phone number shared for this account.</span>
          )}
          <button
            type="button"
            className="btn btn-outline"
            onClick={() => void refresh()}
            disabled={busy !== null}
          >
            Refresh
          </button>
        </div>
      </section>

      <section className={ui.card}>
        <h2 className={`serif ${ui.cardTitle}`}>Handover</h2>
        {canConfirm ? (
          <>
            <p className={ui.cardBody}>
              {details.mode === 'pickup'
                ? 'Confirm once the receiver has collected the food.'
                : 'Confirm once you have handed the food to the receiver.'}
            </p>
            <div className={ui.formActions}>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => void handleComplete()}
                disabled={busy !== null}
              >
                {busy === 'complete' ? 'Confirming…' : 'Mark as handed over'}
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => void handleCancel()}
                disabled={busy !== null}
              >
                {busy === 'cancel' ? 'Cancelling…' : 'Cancel order'}
              </button>
            </div>
          </>
        ) : (
          <>
            <p className={ui.cardBody}>
              {details.mode === 'pickup'
                ? 'The donor will confirm once you collect the food.'
                : 'The receiver will confirm once you arrive with the food.'}
            </p>
            <div className={ui.formActions}>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => void handleCancel()}
                disabled={busy !== null}
              >
                {busy === 'cancel' ? 'Cancelling…' : 'Cancel order'}
              </button>
            </div>
          </>
        )}
      </section>
    </div>
  );
}