'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { publicEnv } from '@/lib/env';
import { createServerSupabase } from '@/lib/supabase/server';
import {
  credentialsSchema,
  fieldErrors,
  magicLinkSchema,
  onboardingSchema,
} from '@/lib/validation';
import type { FormState } from './form-state';

/** Whitelist redirect targets so an attacker cannot bounce the user off-site. */
function safeNext(next: string | undefined | null): string {
  if (!next) return '/map';
  return next.startsWith('/') && !next.startsWith('//') ? next : '/map';
}

export async function signInAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const raw = Object.fromEntries(formData) as Record<string, string>;
  const parsed = credentialsSchema.safeParse({ email: raw.email, password: raw.password });
  if (!parsed.success) {
    return { error: 'Check the details and try again.', fields: fieldErrors(parsed.error) };
  }

  const supabase = await createServerSupabase();
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });
  if (error) {
    return { error: 'Those details did not match. Try again or use a one-time link.' };
  }

  redirect(safeNext(raw.next));
}

export async function signUpAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const raw = Object.fromEntries(formData) as Record<string, string>;
  const parsed = credentialsSchema.safeParse({ email: raw.email, password: raw.password });
  if (!parsed.success) {
    return { error: 'Check the details and try again.', fields: fieldErrors(parsed.error) };
  }

  const supabase = await createServerSupabase();
  const origin = (await headers()).get('origin') ?? publicEnv.siteUrl;
  const nextPath = safeNext(raw.next);
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: { emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent(nextPath)}` },
  });

  if (error) {
    return {
      error:
        error.message === 'User already registered'
          ? 'That email already has an account. Sign in instead.'
          : error.message,
    };
  }

  if (data.session) {
    redirect('/onboarding?next=' + encodeURIComponent(nextPath));
  }

  return {
    notice:
      'Check your inbox and open the confirmation link. Then come back and sign in.',
  };
}

export async function magicLinkAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const raw = Object.fromEntries(formData) as Record<string, string>;
  const parsed = magicLinkSchema.safeParse({ email: raw.email });
  if (!parsed.success) {
    return { error: 'Enter a valid email.', fields: fieldErrors(parsed.error) };
  }

  const supabase = await createServerSupabase();
  const origin = (await headers()).get('origin') ?? publicEnv.siteUrl;
  const nextPath = safeNext(raw.next);
  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data.email,
    options: { emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent(nextPath)}` },
  });

  if (error) return { error: 'Could not send the link. Try again shortly.' };

  return { notice: 'Sent. Open the link on the same device.' };
}

export async function completeOnboardingAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const raw = Object.fromEntries(formData) as Record<string, string>;
  const parsed = onboardingSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: 'Something in the form is off.', fields: fieldErrors(parsed.error) };
  }

  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/onboarding');

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

  if (error) return { error: 'Could not save your details. Try again.' };

  redirect(safeNext(raw.next));
}