/**
 * Environment access. Read through these helpers, never process.env directly,
 * so a missing variable fails with a sentence you can act on instead of
 * `undefined is not a valid URL`.
 */

function required(name: string, value: string | undefined): string {
  if (!value || value.trim() === '') {
    throw new Error(
      `Missing environment variable ${name}. Copy .env.example to .env.local and fill it in.`,
    );
  }
  return value;
}

export const publicEnv = {
  get supabaseUrl(): string {
    return required('NEXT_PUBLIC_SUPABASE_URL', process.env.NEXT_PUBLIC_SUPABASE_URL);
  },
  get supabaseAnonKey(): string {
    return required('NEXT_PUBLIC_SUPABASE_ANON_KEY', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  },
  get siteUrl(): string {
    return process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') ?? 'http://localhost:3000';
  },
  get nominatimContact(): string {
    return process.env.NEXT_PUBLIC_NOMINATIM_APP_CONTACT ?? 'nohunger@example.com';
  },
  /** Read on the client to build the PushManager subscription. Public by design. */
  get vapidPublicKey(): string | undefined {
    return process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || undefined;
  },
};

/** Server-only. Importing this from a client component is a build error. */
export const serverEnv = {
  get serviceRoleKey(): string {
    return required('SUPABASE_SERVICE_ROLE_KEY', process.env.SUPABASE_SERVICE_ROLE_KEY);
  },
  get cronSecret(): string {
    return required('CRON_SECRET', process.env.CRON_SECRET);
  },
  get openRouteServiceKey(): string | undefined {
    return process.env.OPENROUTESERVICE_API_KEY || undefined;
  },
  get vapidPrivateKey(): string | undefined {
    return process.env.VAPID_PRIVATE_KEY || undefined;
  },
  get vapidSubject(): string | undefined {
    return process.env.VAPID_SUBJECT || undefined;
  },
};

export const STORAGE_BUCKET = 'food-images';

/** Public URL for an object in the food-images bucket. */
export function publicImageUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  return `${publicEnv.supabaseUrl}/storage/v1/object/public/${STORAGE_BUCKET}/${path}`;
}