import 'server-only';

import { createClient } from '@supabase/supabase-js';
import { publicEnv, serverEnv } from '@/lib/env';
import type { Database } from './database.types';

/**
 * Service-role client. Bypasses RLS, so it is only used for work the user is
 * not allowed to do themselves: uploading and deleting Storage objects, and
 * draining the image GC queue.
 *
 * The `server-only` import above makes bundling this into client code a build
 * error rather than a leak.
 */
export function createAdminClient() {
  return createClient<Database>(publicEnv.supabaseUrl, serverEnv.serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
