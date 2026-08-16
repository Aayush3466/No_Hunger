'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Avatar } from '@/components/ui/Avatar';
import { Countdown } from '@/components/ui/Countdown';
import { DonationCardSkeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { createClient } from '@/lib/supabase/client';
import { MODE_LABELS, formatAge, formatRating, servingsLabel } from '@/lib/format';
import type { IncomingRequest, MyRequest } from '@/lib/supabase/database.types';
import {
  acceptRequestAction,
  cancelRequestAction,
  rejectRequestAction,
} from '@/server/actions/requests';
import ui from '@/components/ui/ui.module.css';

type Busy = Record<string, boolean>;

export function OrdersClient() {
  const supabase = useMemo(() => createClient(), []);
  const [incoming, setIncoming] = useState<IncomingRequest[]>([]);
  const [mine, setMine] = useState<MyRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<Busy>({});
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [inbox, requests] = await Promise.all([
      supabase.rpc('get_incoming_requests'),
      supabase.rpc('get_my_requests'),
    ]);
    setIncoming((inbox.data ?? []) as IncomingRequest[]);
    setMine((requests.data ?? []) as MyRequest[]);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const channel = supabase
      .channel('orders')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'requests' }, () => {
        void load();
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [supabase, load]);

  async function run(id: string, work: () => Promise<{ ok: boolean; error?: string }>) {
    setBusy((state) => ({ ...state, [id]: true }));
    setMessage(null);
    const result = await work();
    setBusy((state) => ({ ...state, [id]: false }));
    if (!result.ok) setMessage(result.error ?? 'That did not work.');
    await load();
  }

  if (loading) {
    return (
      <div className={ui.stack}>
        <DonationCardSkeleton />
        <DonationCardSkeleton />
      </div>
    );
  }

  return (
    <div className={ui.stack}>
      {message ? (
        <p className={ui.formError} role="alert">
          {message}
        </p>
      ) : null}

      <section aria-labelledby="inbox-heading" className={ui.stack}>
        <h2 id="inbox-heading" className={`serif ${ui.cardTitle}`}>
          Requests for your food
        </h2>

        {incoming.length === 0 ? (
          <div className={ui.card}>
            <EmptyState
              title="No requests yet"
              body="When someone claims a portion of your listing it lands here, in real time."
              action={
                <Link href="/donate" className="btn btn-primary">
                  Post food
                </Link>
              }
            />
          </div>
        ) : (
          incoming.map((request) => (
            <article key={request.request_id} className={ui.card}>
              <div className={ui.row}>
                <Avatar name={request.receiver_name} url={request.receiver_avatar_url} />
                <div className={ui.grow}>
                  <div style={{ fontWeight: 600 }}>{request.receiver_name}</div>
                  <div className={ui.cardMeta}>
                    {formatRating(request.receiver_avg_rating, request.receiver_ratings_count)}
                  </div>
                </div>
                <Countdown expiresAt={request.expires_at} />
              </div>

              <p className={ui.cardBody} style={{ marginTop: '.75rem' }}>
                Wants {servingsLabel(request.servings_requested)} of{' '}
                <strong>{request.food_name}</strong> · {MODE_LABELS[request.fulfilment_mode]} ·{' '}
                {formatAge(request.created_at)}
              </p>
              <p className={ui.cardMeta}>
                {servingsLabel(request.servings_remaining)} still unclaimed on this listing
              </p>

              {request.status === 'pending' ? (
                <div className={ui.formActions}>
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={busy[request.request_id]}
                    onClick={() =>
                      void run(request.request_id, () => acceptRequestAction(request.request_id))
                    }
                  >
                    {busy[request.request_id] ? 'Working…' : 'Accept'}
                  </button>
                  <button
                    type="button"
                    className="btn btn-outline"
                    disabled={busy[request.request_id]}
                    onClick={() =>
                      void run(request.request_id, () => rejectRequestAction(request.request_id))
                    }
                  >
                    Decline
                  </button>
                </div>
              ) : (
                <div className={ui.formActions}>
                  <span className={ui.chip}>Accepted</span>
                  <Link href={`/orders/${request.request_id}`} className="btn btn-primary">
                    Open order
                  </Link>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    disabled={busy[request.request_id]}
                    onClick={() =>
                      void run(request.request_id, () =>
                        cancelRequestAction(request.request_id, 'donor_cancelled'),
                      )
                    }
                  >
                    Cancel order
                  </button>
                </div>
              )}
            </article>
          ))
        )}
      </section>

      <section aria-labelledby="mine-heading" className={ui.stack}>
        <h2 id="mine-heading" className={`serif ${ui.cardTitle}`}>
          Food you asked for
        </h2>

        {mine.length === 0 ? (
          <div className={ui.card}>
            <EmptyState
              title="Nothing claimed yet"
              body="Open the map, pick something nearby, and ask for the portion you need."
              action={
                <Link href="/map" className="btn btn-primary">
                  Find food nearby
                </Link>
              }
            />
          </div>
        ) : (
          mine.map((request) => (
            <article key={request.request_id} className={ui.card}>
              <div className={ui.row}>
                <Avatar name={request.donor_name} url={request.donor_avatar_url} />
                <div className={ui.grow}>
                  <div style={{ fontWeight: 600 }}>{request.food_name}</div>
                  <div className={ui.cardMeta}>
                    {servingsLabel(request.servings_requested)} ·{' '}
                    {MODE_LABELS[request.fulfilment_mode]} · from {request.donor_name}
                  </div>
                </div>
                <span
                  className={
                    request.status === 'accepted' ? ui.chip : `${ui.chip} ${ui.chipHoney}`
                  }
                >
                  {request.status === 'accepted' ? 'Accepted' : 'Waiting'}
                </span>
              </div>

              <div className={ui.formActions}>
                {request.status === 'accepted' ? (
                  <Link href={`/orders/${request.request_id}`} className="btn btn-primary">
                    Open order
                  </Link>
                ) : null}
                <button
                  type="button"
                  className="btn btn-ghost"
                  disabled={busy[request.request_id]}
                  onClick={() =>
                    void run(request.request_id, () =>
                      cancelRequestAction(request.request_id, 'receiver_cancelled'),
                    )
                  }
                >
                  {request.status === 'accepted' ? 'Cancel order' : 'Withdraw request'}
                </button>
              </div>
            </article>
          ))
        )}
      </section>
    </div>
  );
}