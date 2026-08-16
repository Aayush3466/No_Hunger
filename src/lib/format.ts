import type { DonationCategory, FoodType, RequestMode } from '@/lib/supabase/database.types';

export const CATEGORY_LABELS: Record<DonationCategory, string> = {
  veg: 'Vegetarian',
  non_veg: 'Non-vegetarian',
  vegan: 'Vegan',
};

export const FOOD_TYPE_LABELS: Record<FoodType, string> = {
  cooked: 'Cooked',
  packaged: 'Packaged',
};

export const MODE_LABELS: Record<RequestMode, string> = {
  pickup: 'Pickup',
  delivery: 'Delivery',
};

/** "1h 20m left", "8m left", "Expired". Recomputed on a ticker, never cached. */
export function formatCountdown(expiresAt: string | Date, now: number = Date.now()): string {
  const target = typeof expiresAt === 'string' ? Date.parse(expiresAt) : expiresAt.getTime();
  const ms = target - now;
  if (!Number.isFinite(ms) || ms <= 0) return 'Expired';

  const totalMinutes = Math.floor(ms / 60_000);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;

  if (days > 0) return `${days}d ${hours}h left`;
  if (hours > 0) return `${hours}h ${minutes}m left`;
  if (totalMinutes > 0) return `${totalMinutes}m left`;
  return 'Under a minute left';
}

export function isExpired(expiresAt: string, now: number = Date.now()): boolean {
  return Date.parse(expiresAt) <= now;
}

/** "5m ago", "2h ago". Matches the "5m ago" copy in the hero card. */
export function formatAge(createdAt: string, now: number = Date.now()): string {
  const minutes = Math.max(0, Math.floor((now - Date.parse(createdAt)) / 60_000));
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function formatRating(value: number | null | undefined, count?: number | null): string {
  if (value === null || value === undefined) return 'No ratings yet';
  return count ? `${value.toFixed(1)} ★ (${count})` : `${value.toFixed(1)} ★`;
}

export function servingsLabel(count: number): string {
  return count === 1 ? '1 serving' : `${count} servings`;
}
