import { NextResponse, type NextRequest } from 'next/server';
import webpush from 'web-push';
import { publicEnv, serverEnv } from '@/lib/env';
import { createAdminClient } from '@/lib/supabase/admin';
import type { NotificationType } from '@/lib/supabase/database.types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Only push for events where the user genuinely wants an interruption on their
 * lock screen. In-app-only events still land in the bell, they just don't
 * escalate to a phone buzz.
 */
const PUSHABLE = new Set<NotificationType>([
  'request_created',
  'request_accepted',
  'order_completed',
  'order_timed_out',
]);

function messageFor(
  type: NotificationType,
  payload: Record<string, string | undefined>,
): { title: string; body: string; url: string; tag: string } | null {
  const food = payload.food_name ?? 'a listing';
  const rid = payload.request_id;
  const requestLink = rid ? `/orders/${rid}` : '/orders';

  switch (type) {
    case 'request_created':
      return {
        title: 'NoHunger',
        body: `Someone wants ${payload.servings ?? ''} of ${food}`.trim(),
        url: '/orders',
        tag: `request-${rid ?? 'x'}`,
      };
    case 'request_accepted':
      return {
        title: 'Your request was accepted',
        body: `The donor said yes to ${food}. Head over.`,
        url: requestLink,
        tag: `accepted-${rid ?? 'x'}`,
      };
    case 'order_completed':
      return {
        title: 'Handover confirmed',
        body: `Thanks for sharing. Care to rate the handover of ${food}?`,
        url: '/history',
        tag: `completed-${rid ?? 'x'}`,
      };
    case 'order_timed_out':
      return {
        title: 'Order timed out',
        body: `The order for ${food} auto-cancelled. Servings are back on the map.`,
        url: '/orders',
        tag: `timeout-${rid ?? 'x'}`,
      };
    default:
      return null;
  }
}

/**
 * Supabase Database Webhooks send an Authorization header we set in the
 * webhook config. We reuse CRON_SECRET as that shared secret so we don't need
 * a second env var. If a request lacks it, we refuse — otherwise anyone on the
 * internet could push arbitrary notifications to your users.
 */
function isAuthorized(request: NextRequest): boolean {
  const provided = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  return provided === serverEnv.cronSecret;
}

interface WebhookBody {
  type?: string; // "INSERT" | "UPDATE" | "DELETE"
  table?: string;
  record?: {
    id?: string;
    user_id?: string;
    type?: NotificationType;
    payload?: Record<string, string | undefined>;
  };
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  // Set VAPID details lazily so a missing env at boot doesn't kill the server.
  // The Web Push spec requires a subject (email or URL) plus the two keys.
  const publicKey = publicEnv.vapidPublicKey;
  const privateKey = serverEnv.vapidPrivateKey;
  const subject = serverEnv.vapidSubject;

  if (!publicKey || !privateKey || !subject) {
    return NextResponse.json(
      { error: 'push_not_configured' },
      { status: 500 },
    );
  }

  webpush.setVapidDetails(subject, publicKey, privateKey);

  let body: WebhookBody;
  try {
    body = (await request.json()) as WebhookBody;
  } catch {
    return NextResponse.json({ error: 'bad_json' }, { status: 400 });
  }

  if (body.type !== 'INSERT' || body.table !== 'notifications' || !body.record) {
    return NextResponse.json({ ok: true, skipped: 'not_insert_on_notifications' });
  }

  const { user_id, type, payload } = body.record;
  if (!user_id || !type) {
    return NextResponse.json({ error: 'missing_fields' }, { status: 400 });
  }

  if (!PUSHABLE.has(type)) {
    return NextResponse.json({ ok: true, skipped: 'not_pushable' });
  }

  const message = messageFor(type, payload ?? {});
  if (!message) {
    return NextResponse.json({ ok: true, skipped: 'no_message' });
  }

  // Look up every device this user has registered.
  const admin = createAdminClient();
  const { data: subs, error } = await admin
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth')
    .eq('user_id', user_id);

  if (error) {
    return NextResponse.json({ error: 'lookup_failed' }, { status: 500 });
  }
  if (!subs || subs.length === 0) {
    return NextResponse.json({ ok: true, delivered: 0 });
  }

  let delivered = 0;
  const goneIds: string[] = [];

  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          JSON.stringify(message),
        );
        delivered += 1;
      } catch (pushError) {
        const statusCode = (pushError as { statusCode?: number }).statusCode;
        // 404 / 410 mean the endpoint is gone (user uninstalled, or the push
        // service revoked it). Remove the dead subscription so we don't keep
        // wasting requests on it.
        if (statusCode === 404 || statusCode === 410) {
          goneIds.push(sub.id);
        }
      }
    }),
  );

  if (goneIds.length > 0) {
    await admin.from('push_subscriptions').delete().in('id', goneIds);
  }

  return NextResponse.json({ ok: true, delivered, cleaned: goneIds.length });
}