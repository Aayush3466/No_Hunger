import { NextResponse, type NextRequest } from 'next/server';
import { STORAGE_BUCKET } from '@/lib/env';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const BATCH = 50;

/**
 * Drains public.storage_gc.
 *
 * SQL cannot delete a Storage object, so every terminal path (completion,
 * expiry, cancellation, the orphan sweep) queues the path instead and this
 * endpoint removes it with the service-role key.
 *
 * Call it from a scheduler, or hit it manually. It is guarded by CRON_SECRET
 * rather than a session because no user is involved.
 */
export async function POST(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const provided =
    request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ??
    request.nextUrl.searchParams.get('key');

  if (!secret || provided !== secret) {
    return NextResponse.json({ error: 'unauthorised' }, { status: 401 });
  }

  const admin = createAdminClient();

  const { data: queue, error } = await admin
    .from('storage_gc')
    .select('id, bucket, path')
    .is('deleted_at', null)
    .order('enqueued_at', { ascending: true })
    .limit(BATCH);

  if (error) {
    return NextResponse.json({ error: 'queue_read_failed' }, { status: 500 });
  }
  if (!queue || queue.length === 0) {
    return NextResponse.json({ deleted: 0, remaining: 0 });
  }

  const paths = queue
    .filter((row) => row.bucket === STORAGE_BUCKET)
    .map((row) => row.path);

  const { error: removeError } = await admin.storage.from(STORAGE_BUCKET).remove(paths);

  const ids = queue.map((row) => row.id);

  if (removeError) {
    await admin
      .from('storage_gc')
      .update({ attempts: 1, last_error: removeError.message })
      .in('id', ids);
    return NextResponse.json({ error: 'delete_failed', attempted: paths.length }, { status: 502 });
  }

  await admin.from('storage_gc').update({ deleted_at: new Date().toISOString() }).in('id', ids);

  return NextResponse.json({ deleted: paths.length });
}
