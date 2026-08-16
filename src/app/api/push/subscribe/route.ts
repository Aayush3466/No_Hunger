import { NextResponse, type NextRequest } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';

/**
 * Saves a PushSubscription to the current user's row set. The push_subscriptions
 * table already has RLS locking rows to their owner, so RLS enforces that a
 * user can't insert into someone else's device set.
 *
 * We upsert on `endpoint` because a browser rotates the endpoint periodically;
 * a new endpoint for the same user is a fresh row, but re-subscribing on the
 * same device is idempotent.
 */
export async function POST(request: NextRequest) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'auth_required' }, { status: 401 });

  let body: { endpoint?: string; p256dh?: string; auth?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'bad_json' }, { status: 400 });
  }

  const { endpoint, p256dh, auth } = body;
  if (!endpoint || !p256dh || !auth) {
    return NextResponse.json({ error: 'missing_fields' }, { status: 400 });
  }

  const { error } = await supabase
    .from('push_subscriptions')
    .upsert(
      { user_id: user.id, endpoint, p256dh, auth },
      { onConflict: 'endpoint' },
    );

  if (error) {
    return NextResponse.json({ error: 'save_failed' }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

/** Removes the current user's subscription for a given endpoint. */
export async function DELETE(request: NextRequest) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'auth_required' }, { status: 401 });

  let body: { endpoint?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'bad_json' }, { status: 400 });
  }

  if (!body.endpoint) {
    return NextResponse.json({ error: 'missing_endpoint' }, { status: 400 });
  }

  await supabase
    .from('push_subscriptions')
    .delete()
    .eq('user_id', user.id)
    .eq('endpoint', body.endpoint);

  return NextResponse.json({ ok: true });
}