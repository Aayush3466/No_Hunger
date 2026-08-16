'use server';

import { revalidatePath } from 'next/cache';
import { actionError, type ActionResult } from '@/lib/errors';
import { createServerSupabase } from '@/lib/supabase/server';
import { profileEditSchema } from '@/lib/validation';

export async function updateProfileAction(input: {
  full_name: string;
  phone?: string;
  usual_donation_times?: string;
  bio?: string;
}): Promise<ActionResult<undefined>> {
  try {
    const parsed = profileEditSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? 'Check the form.' };
    }

    const supabase = await createServerSupabase();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { ok: false, error: 'Sign in to edit your profile.' };

    const { error } = await supabase
      .from('profiles')
      .update({
        full_name: parsed.data.full_name,
        phone: parsed.data.phone || null,
        usual_donation_times: parsed.data.usual_donation_times || null,
        bio: parsed.data.bio || null,
      })
      .eq('id', user.id);

    if (error) return actionError(error);

    revalidatePath('/profile');
    revalidatePath('/', 'layout');
    return { ok: true, data: undefined };
  } catch (error) {
    return actionError(error);
  }
}