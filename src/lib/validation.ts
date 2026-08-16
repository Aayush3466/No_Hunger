import { z } from 'zod';

/**
 * Server-side validation. The client uses the same schemas for instant feedback,
 * but the server action re-parses every time: browser validation is a courtesy,
 * not a guarantee.
 */

export const MAX_EXPIRY_HOURS = 48;
export const MIN_EXPIRY_MINUTES = 15;

const lat = z.coerce.number().min(-90).max(90);
const lng = z.coerce.number().min(-180).max(180);

export const donationSchema = z
  .object({
    food_name: z.string().trim().min(2, 'Give the food a name.').max(80),
    description: z.string().trim().max(500).optional().or(z.literal('')),
    category: z.enum(['veg', 'non_veg', 'vegan']),
    food_type: z.enum(['cooked', 'packaged']),
    allergens: z.string().trim().max(200).optional().or(z.literal('')),
    total_servings: z.coerce.number().int().min(1, 'At least one serving.').max(500),
    pickup_lat: lat,
    pickup_lng: lng,
    pickup_address: z.string().trim().max(240).optional().or(z.literal('')),
    fulfilment_mode: z.enum(['pickup', 'delivery', 'both']),
    delivery_radius_km: z.coerce.number().min(0.5).max(50).optional().nullable(),
    expires_at: z
      .string()
      .refine((value) => Number.isFinite(Date.parse(value)), 'Choose when this expires.'),
  })
  .superRefine((value, ctx) => {
    const expires = Date.parse(value.expires_at);
    const now = Date.now();
    if (expires < now + MIN_EXPIRY_MINUTES * 60_000) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['expires_at'],
        message: `Give people at least ${MIN_EXPIRY_MINUTES} minutes to reach you.`,
      });
    }
    if (expires > now + MAX_EXPIRY_HOURS * 3_600_000) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['expires_at'],
        message: `Pick a window within the next ${MAX_EXPIRY_HOURS} hours.`,
      });
    }
    if (value.fulfilment_mode === 'pickup' && value.delivery_radius_km != null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['delivery_radius_km'],
        message: 'Pickup-only listings have no delivery range.',
      });
    }
    if (value.fulfilment_mode !== 'pickup' && value.delivery_radius_km == null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['delivery_radius_km'],
        message: 'Set how far you are willing to deliver.',
      });
    }
  });

export type DonationInput = z.infer<typeof donationSchema>;

export const requestSchema = z
  .object({
    donation_id: z.string().uuid(),
    servings: z.coerce.number().int().min(1).max(500),
    mode: z.enum(['pickup', 'delivery']),
    dropoff_lat: lat.optional().nullable(),
    dropoff_lng: lng.optional().nullable(),
    dropoff_address: z.string().trim().max(240).optional().or(z.literal('')),
  })
  .superRefine((value, ctx) => {
    if (value.mode === 'delivery' && (value.dropoff_lat == null || value.dropoff_lng == null)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['dropoff_lat'],
        message: 'Add a dropoff location for delivery.',
      });
    }
  });

export type RequestInput = z.infer<typeof requestSchema>;

export const onboardingSchema = z.object({
  full_name: z.string().trim().min(2, 'Tell people what to call you.').max(80),
  phone: z
    .string()
    .trim()
    .regex(/^\+?[0-9 ()-]{6,20}$/, 'Enter a reachable phone number.')
    .optional()
    .or(z.literal('')),
  usual_donation_times: z.string().trim().max(120).optional().or(z.literal('')),
  bio: z.string().trim().max(400).optional().or(z.literal('')),
});

export const credentialsSchema = z.object({
  email: z.string().trim().email('Enter a valid email address.'),
  password: z.string().min(8, 'Use at least 8 characters.').max(72),
});

export const magicLinkSchema = z.object({
  email: z.string().trim().email('Enter a valid email address.'),
});

/**
 * Ratings: stars 1–5, optional short comment. request_id and ratee_id come
 * from the calling context, not the form.
 */
export const ratingSchema = z.object({
  request_id: z.string().uuid(),
  ratee_id: z.string().uuid(),
  stars: z.coerce.number().int().min(1, 'Give at least one star.').max(5),
  comment: z.string().trim().max(400).optional().or(z.literal('')),
});

export type RatingInput = z.infer<typeof ratingSchema>;

/**
 * Profile edit uses the same fields as onboarding, but full_name here can be
 * shorter for people already onboarded who want to switch to a nickname.
 */
export const profileEditSchema = onboardingSchema;
export type ProfileEditInput = z.infer<typeof profileEditSchema>;

/** Turns a ZodError into { field: message } for form rendering. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join('.') || 'form';
    out[key] ??= issue.message;
  }
  return out;
}