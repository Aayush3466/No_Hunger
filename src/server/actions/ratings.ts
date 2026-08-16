'use server';

import { revalidatePath } from 'next/cache';
import { actionError, type ActionResult } from '@/lib/errors';
import { createServerSupabase } from '@/lib/supabase/server';
import { ratingSchema } from '@/lib/validation';

/**
 * Submits or updates a rating for a completed order.
 *
 * The database enforces:
 *   - the order is completed
 *   - the caller is a party to it
 *   - they are not rating themselves
 * We just call insert with an on-conflict clause so a second rating from the
 * same rater on the same request overwrites, rather than failing.
 */
export async function submitRatingAction(input: {
  request_id: string;
  ratee_id: string;
  stars: number;
  comment?: string;
}): Promise<ActionResult<{ ratingId: string }>> {
  try {
    const parsed = ratingSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? 'Check your rating.' };
    }

    const supabase = await createServerSupabase();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { ok: false, error: 'Sign in to leave a rating.' };

    const { data, error } = await supabase
      .from('ratings')
      .upsert(
        {
          request_id: parsed.data.request_id,
          rater_id: user.id,
          ratee_id: parsed.data.ratee_id,
          stars: parsed.data.stars,
          comment: parsed.data.comment || null,
        },
        { onConflict: 'request_id,rater_id' },
      )
      .select('id')
      .single();

    if (error || !data) return actionError(error);

    revalidatePath('/history');
    revalidatePath('/profile');
    return { ok: true, data: { ratingId: data.id } };
  } catch (error) {
    return actionError(error);
  }
}