'use server';

import { revalidatePath } from 'next/cache';
import { STORAGE_BUCKET } from '@/lib/env';
import { actionError, type ActionResult } from '@/lib/errors';
import { createAdminClient } from '@/lib/supabase/admin';
import { createServerSupabase } from '@/lib/supabase/server';
import { donationSchema } from '@/lib/validation';

const MAX_IMAGE_BYTES = 256 * 1024;
const ALLOWED_IMAGE_TYPE = 'image/webp';

export async function createDonationAction(
  formData: FormData,
): Promise<ActionResult<{ donationId: string }>> {
  console.log('[donate] action called');
  let uploadedPath: string | null = null;

  try {
    const supabase = await createServerSupabase();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      console.log('[donate] no user');
      return { ok: false, error: 'Sign in to post food.' };
    }
    console.log('[donate] user:', user.id);

    const raw = {
      food_name: formData.get('food_name'),
      description: formData.get('description'),
      category: formData.get('category'),
      food_type: formData.get('food_type'),
      allergens: formData.get('allergens'),
      total_servings: formData.get('total_servings'),
      pickup_lat: formData.get('pickup_lat'),
      pickup_lng: formData.get('pickup_lng'),
      pickup_address: formData.get('pickup_address'),
      fulfilment_mode: formData.get('fulfilment_mode'),
      delivery_radius_km: formData.get('delivery_radius_km') || null,
      expires_at: formData.get('expires_at'),
    };
    console.log('[donate] raw input:', raw);

    const parsed = donationSchema.safeParse(raw);
    if (!parsed.success) {
      console.log('[donate] validation failed:', JSON.stringify(parsed.error.issues, null, 2));
      return { ok: false, error: parsed.error.issues[0]?.message ?? 'Check the form and retry.' };
    }
    console.log('[donate] validation passed');

    // --- photo ---------------------------------------------------------------
    const photo = formData.get('photo');
    if (photo instanceof File && photo.size > 0) {
      console.log('[donate] photo:', photo.type, photo.size, 'bytes');
      if (photo.type !== ALLOWED_IMAGE_TYPE) {
        return { ok: false, error: 'The photo must be a WebP produced by the app.' };
      }
      if (photo.size > MAX_IMAGE_BYTES) {
        return { ok: false, error: 'That photo is still too large. Try a simpler shot.' };
      }

      const admin = createAdminClient();
      const path = `${user.id}/${crypto.randomUUID()}.webp`;
      const { error: uploadError } = await admin.storage
        .from(STORAGE_BUCKET)
        .upload(path, photo, { contentType: ALLOWED_IMAGE_TYPE, upsert: false });

      if (uploadError) {
        console.log('[donate] upload error:', uploadError);
        return { ok: false, error: 'The photo could not be uploaded. Try again.' };
      }
      uploadedPath = path;
      console.log('[donate] uploaded to:', path);
    } else {
      console.log('[donate] no photo attached');
    }

    // --- row -----------------------------------------------------------------
    console.log('[donate] inserting row');
    const { data, error } = await supabase
      .from('donations')
      .insert({
        donor_id: user.id,
        food_name: parsed.data.food_name,
        description: parsed.data.description || null,
        category: parsed.data.category,
        food_type: parsed.data.food_type,
        allergens: parsed.data.allergens || null,
        image_path: uploadedPath,
        total_servings: parsed.data.total_servings,
        servings_remaining: parsed.data.total_servings,
        pickup_lat: parsed.data.pickup_lat,
        pickup_lng: parsed.data.pickup_lng,
        pickup_address: parsed.data.pickup_address || null,
        fulfilment_mode: parsed.data.fulfilment_mode,
        delivery_radius_km: parsed.data.delivery_radius_km ?? null,
        expires_at: new Date(parsed.data.expires_at).toISOString(),
        status: 'available',
      })
      .select('id')
      .single();

    if (error || !data) {
      console.log('[donate] insert failed:', error);
      if (uploadedPath) {
        await createAdminClient().storage.from(STORAGE_BUCKET).remove([uploadedPath]);
        uploadedPath = null;
      }
      return actionError(error);
    }

    console.log('[donate] success, id:', data.id);
    revalidatePath('/map');
    revalidatePath('/orders');
    return { ok: true, data: { donationId: data.id } };
  } catch (error) {
    console.log('[donate] threw:', error);
    if (uploadedPath) {
      try {
        await createAdminClient().storage.from(STORAGE_BUCKET).remove([uploadedPath]);
      } catch {
        // sweep_orphan_images() is the backstop
      }
    }
    return actionError(error);
  }
}