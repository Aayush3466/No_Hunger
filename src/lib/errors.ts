/**
 * The database raises bare error codes (RATE_LIMITED, NOT_ENOUGH_SERVINGS, ...).
 * This is the single place they become sentences a person can act on. Anything
 * unrecognised falls back to a generic message rather than leaking SQL.
 */
const MESSAGES: Record<string, string> = {
  AUTH_REQUIRED: 'Sign in to continue.',
  ALREADY_REQUESTED: 'You already have a request on this listing.',
  BLOCKED: 'This listing is not available to you.',
  CANNOT_REQUEST_OWN_FOOD: 'This is your own listing.',
  DONATION_EXPIRED: 'This food just expired.',
  DONATION_NOT_FOUND: 'This listing is no longer available.',
  DONATION_UNAVAILABLE: 'This listing was fully claimed.',
  DONOR_CONFIRMS_PICKUP: 'The donor confirms handover for pickup orders.',
  DROPOFF_REQUIRED: 'Add a dropoff location for delivery.',
  EXPIRY_TOO_FAR: 'Pick a pickup window within the next 48 hours.',
  EXPIRY_TOO_SOON: 'Give people at least 15 minutes to reach you.',
  INVALID_SERVINGS: 'Enter how many servings you need.',
  MODE_NOT_OFFERED: 'The donor does not offer that option on this listing.',
  NOT_A_PARTY: 'This order is not yours.',
  NOT_DONOR: 'Only the donor can do that.',
  NOT_ENOUGH_SERVINGS: 'Someone claimed those servings first. Try a smaller amount.',
  ORDER_NOT_ACTIVE: 'This order is already finished.',
  ORDER_NOT_COMPLETED: 'You can rate once the handover is confirmed.',
  OUTSIDE_DELIVERY_RADIUS: 'That address is outside the donor’s delivery range.',
  RATE_LIMITED: 'That is a lot of requests in one hour. Try again shortly.',
  REQUEST_NOT_FOUND: 'That request no longer exists.',
  REQUEST_NOT_PENDING: 'That request was already answered.',
  RECEIVER_CONFIRMS_DELIVERY: 'The receiver confirms handover for delivery orders.',
  SERVINGS_ARE_SERVER_MANAGED: 'Servings cannot be edited directly.',
  STATUS_IS_SERVER_MANAGED: 'That status change is not allowed.',
};

export function friendlyError(error: unknown): string {
  const raw =
    typeof error === 'string'
      ? error
      : error && typeof error === 'object' && 'message' in error
        ? String((error as { message: unknown }).message)
        : '';

  for (const code of Object.keys(MESSAGES)) {
    if (raw.includes(code)) return MESSAGES[code] as string;
  }
  if (raw.includes('duplicate key')) return MESSAGES.ALREADY_REQUESTED as string;
  return 'Something went wrong. Try again.';
}

export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export function actionError(error: unknown): { ok: false; error: string } {
  return { ok: false, error: friendlyError(error) };
}
