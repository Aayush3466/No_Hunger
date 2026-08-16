'use server';

import { revalidatePath } from 'next/cache';
import { actionError, type ActionResult } from '@/lib/errors';
import { createServerSupabase } from '@/lib/supabase/server';
import { requestSchema, type RequestInput } from '@/lib/validation';

/**
 * Every action here re-checks auth server-side and then hands the real work to
 * a SECURITY DEFINER function. Nothing in this file decrements servings, flips
 * a status or touches another user's row directly: the database owns that, in
 * one transaction, so two simultaneous accepts cannot oversell.
 */

async function requireUser() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('AUTH_REQUIRED');
  return { supabase, user };
}

export async function createRequestAction(
  input: Partial<RequestInput>,
): Promise<ActionResult<{ requestId: string }>> {
  try {
    const parsed = requestSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? 'Check the form and retry.' };
    }

    const { supabase } = await requireUser();

    const { data, error } = await supabase.rpc('create_request', {
      p_donation_id: parsed.data.donation_id,
      p_servings: parsed.data.servings,
      p_mode: parsed.data.mode,
      p_dropoff_lat: parsed.data.dropoff_lat ?? null,
      p_dropoff_lng: parsed.data.dropoff_lng ?? null,
      p_dropoff_address: parsed.data.dropoff_address || null,
    });

    if (error) return actionError(error);

    revalidatePath('/orders');
    return { ok: true, data: { requestId: data as unknown as string } };
  } catch (error) {
    return actionError(error);
  }
}

export async function acceptRequestAction(requestId: string): Promise<ActionResult<unknown>> {
  try {
    const { supabase } = await requireUser();
    const { data, error } = await supabase.rpc('accept_request', { p_request_id: requestId });
    if (error) return actionError(error);

    revalidatePath('/orders');
    revalidatePath('/map');
    return { ok: true, data };
  } catch (error) {
    return actionError(error);
  }
}

export async function rejectRequestAction(requestId: string): Promise<ActionResult<unknown>> {
  try {
    const { supabase } = await requireUser();
    const { data, error } = await supabase.rpc('reject_request', { p_request_id: requestId });
    if (error) return actionError(error);

    revalidatePath('/orders');
    return { ok: true, data };
  } catch (error) {
    return actionError(error);
  }
}

export async function cancelRequestAction(
  requestId: string,
  reason?: string,
): Promise<ActionResult<unknown>> {
  try {
    const { supabase } = await requireUser();
    const { data, error } = await supabase.rpc('cancel_request', {
      p_request_id: requestId,
      p_reason: reason ?? null,
    });
    if (error) return actionError(error);

    revalidatePath('/orders');
    revalidatePath('/map');
    return { ok: true, data };
  } catch (error) {
    return actionError(error);
  }
}

/**
 * Confirms the handover happened. The database function is idempotent, so a
 * simultaneous double-tap by both parties is harmless. It enforces that only
 * the travelling party may confirm (donor for pickup, receiver for delivery).
 */
export async function completeRequestAction(requestId: string): Promise<ActionResult<unknown>> {
  try {
    const { supabase } = await requireUser();
    const { data, error } = await supabase.rpc('complete_request', { p_request_id: requestId });
    if (error) return actionError(error);

    revalidatePath('/orders');
    revalidatePath(`/orders/${requestId}`);
    revalidatePath('/history');
    return { ok: true, data };
  } catch (error) {
    return actionError(error);
  }
}