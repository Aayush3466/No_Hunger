'use client';

import { createBrowserClient } from '@supabase/ssr';
import { publicEnv } from '@/lib/env';
import type { Database } from './database.types';

let browserClient: ReturnType<typeof createBrowserClient<Database>> | undefined;

/** Singleton browser client. Safe to call from any client component. */
export function createClient() {
  browserClient ??= createBrowserClient<Database>(publicEnv.supabaseUrl, publicEnv.supabaseAnonKey);
  return browserClient;
}

export type SupabaseBrowserClient = ReturnType<typeof createClient>;
