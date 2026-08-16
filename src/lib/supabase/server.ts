import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { publicEnv } from '@/lib/env';
import type { Database } from './database.types';

/**
 * Request-scoped client that carries the caller's session, so every query runs
 * under that user's RLS. Use in Server Components, Route Handlers and Server
 * Actions.
 */
export async function createServerSupabase() {
  const cookieStore = await cookies();

  return createServerClient<Database>(publicEnv.supabaseUrl, publicEnv.supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Called from a Server Component, where cookies are read-only.
          // middleware.ts already refreshed the session, so this is safe to skip.
        }
      },
    },
  });
}

/** The signed-in user, or null. Always verified against the auth server. */
export async function getSessionUser() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}
