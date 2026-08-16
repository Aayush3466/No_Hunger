'use server';

import { revalidatePath } from 'next/cache';
import { createServerSupabase } from '@/lib/supabase/server';

/**
 * Marks a batch of notifications as read for the current user. RLS restricts
 * the UPDATE to their own rows, so passing someone else's id is a no-op.
 */
export async function markNotificationsReadAction(ids: string[]) {
  if (ids.length === 0) return { ok: true as const };
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: 'AUTH_REQUIRED' };

  const { error } = await supabase
    .from('notifications')
    .update({ read: true })
    .in('id', ids)
    .eq('user_id', user.id);

  if (error) return { ok: false as const, error: error.message };

  revalidatePath('/orders');
  return { ok: true as const };
}

export async function markAllNotificationsReadAction() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: 'AUTH_REQUIRED' };

  const { error } = await supabase
    .from('notifications')
    .update({ read: true })
    .eq('user_id', user.id)
    .eq('read', false);

  if (error) return { ok: false as const, error: error.message };
  revalidatePath('/orders');
  return { ok: true as const };
}