'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { publicEnv } from '@/lib/env';
import { createServerSupabase } from '@/lib/supabase/server';
import { credentialsSchema, fieldErrors, magicLinkSchema, onboardingSchema } from '@/lib/validation';

interface FormState {
  error?: string;
  fields?: Record<string, string>;
  notice?: string;
}

/** Only ever redirect inside our own app. Blocks //evil.com and absolute URLs. */
function safeNext(value: FormDataEntryValue | null, fallback: string): string {
  const next = typeof value === 'string' ? value : '';
  if (!next.startsWith('/') || next.startsWith('//')) return fallback;
  return next;
}

export async function signInAction(_prev: Record<string, unknown>, formData: FormData): Promise<Record<string, unknown>> {
  const parsed = credentialsSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  });
  if (!parsed.success) return { fields: fieldErrors(parsed.error) };

  const supabase = await createServerSupabase();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) {
    return { error: 'That email and password do not match an account.' };
  }

  revalidatePath('/', 'layout');
  redirect(safeNext(formData.get('next'), '/map'));
}

export async function signUpAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = credentialsSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  });
  if (!parsed.success) return { fields: fieldErrors(parsed.error) };

  const next = safeNext(formData.get('next'), '/map');
  const supabase = await createServerSupabase();

  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      emailRedirectTo: `${publicEnv.siteUrl}/auth/callback?next=${encodeURIComponent(
        `/onboarding?next=${next}`,
      )}`,
    },
  });

  if (error) {
    return { error: error.message.includes('already') ? 'That email already has an account.' : error.message };
  }

  // With email confirmation switched on there is no session yet.
  if (!data.session) {
    return { notice: 'Check your inbox to confirm your address, then come back here.' };
  }

  revalidatePath('/', 'layout');
  redirect(`/onboarding?next=${encodeURIComponent(next)}`);
}

export async function magicLinkAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = magicLinkSchema.safeParse({ email: formData.get('email') });
  if (!parsed.success) return { fields: fieldErrors(parsed.error) };

  const next = safeNext(formData.get('next'), '/map');
  const supabase = await createServerSupabase();

  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data.email,
    options: {
      emailRedirectTo: `${publicEnv.siteUrl}/auth/callback?next=${encodeURIComponent(next)}`,
    },
  });

  if (error) return { error: 'That link could not be sent. Try again in a minute.' };
  return { notice: `A sign-in link is on its way to ${parsed.data.email}.` };
}

export async function completeOnboardingAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Re-checked server-side: middleware is the first gate, not the only one.
  if (!user) return { error: 'Your session expired. Sign in again.' };

  const parsed = onboardingSchema.safeParse({
    full_name: formData.get('full_name'),
    phone: formData.get('phone'),
    usual_donation_times: formData.get('usual_donation_times'),
    bio: formData.get('bio'),
  });
  if (!parsed.success) return { fields: fieldErrors(parsed.error) };

  const { error } = await supabase
    .from('profiles')
    .update({
      full_name: parsed.data.full_name,
      phone: parsed.data.phone || null,
      usual_donation_times: parsed.data.usual_donation_times || null,
      bio: parsed.data.bio || null,
      onboarded_at: new Date().toISOString(),
    })
    .eq('id', user.id);

  if (error) return { error: 'Your profile could not be saved. Try again.' };

  revalidatePath('/', 'layout');
  redirect(safeNext(formData.get('next'), '/map'));
}
