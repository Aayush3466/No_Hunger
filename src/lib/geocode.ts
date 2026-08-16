'use client';

import type { LatLng } from './geo';

export interface Place extends LatLng {
  label: string;
  /** Short label for the first line of the dropdown row. */
  primary: string;
  /** Rest of the address, shown as a second line in muted text. */
  secondary: string;
}

export interface SearchOptions {
  /**
   * The point Nominatim should prefer results near. Usually the user's GPS,
   * else the current map centre. Without this, Nominatim matches globally and
   * "Balaju" could resolve to a village 8000 km away.
   */
  bias?: LatLng;
  /**
   * Rough radius, in km, around `bias` where results are preferred. This is a
   * soft preference, not a hard filter — a strong text match outside the box
   * can still win, which is what you want when the user searches somewhere
   * they are planning to visit.
   */
  biasRadiusKm?: number;
  /** ISO 3166-1 alpha-2 code (e.g. 'np', 'in'). Optional hard filter. */
  countryCode?: string;
  signal?: AbortSignal;
}

/**
 * Nominatim, with location bias. Called on explicit submit or from a debounced
 * autocomplete. Their usage policy asks for no autocomplete-style bursts and a
 * max of one request per second; the caller throttles at 700 ms.
 *
 * PHASE 5: swap in Photon behind the same signature if volume grows.
 */
export async function searchPlaces(
  query: string,
  options: SearchOptions = {},
): Promise<Place[]> {
  const trimmed = query.trim();
  if (trimmed.length < 3) return [];

  const url = new URL('https://nominatim.openstreetmap.org/search');
  url.searchParams.set('q', trimmed);
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('limit', '5');
  url.searchParams.set('addressdetails', '1');

  // Bias by a bounding box around the user's location. `bounded=0` means it's
  // a preference, not a hard filter — matches outside the box are still
  // allowed, just ranked lower.
  if (options.bias) {
    const km = options.biasRadiusKm ?? 25;
    const dLat = km / 111; // 1 degree of latitude ≈ 111 km
    const dLng = km / (111 * Math.cos((options.bias.lat * Math.PI) / 180));
    const left = options.bias.lng - dLng;
    const right = options.bias.lng + dLng;
    const top = options.bias.lat + dLat;
    const bottom = options.bias.lat - dLat;
    url.searchParams.set('viewbox', `${left},${top},${right},${bottom}`);
    url.searchParams.set('bounded', '0');
  }

  if (options.countryCode) {
    url.searchParams.set('countrycodes', options.countryCode);
  }

  const response = await fetch(url, {
    signal: options.signal,
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) return [];

  const results = (await response.json()) as Array<{
    display_name?: string;
    lat?: string;
    lon?: string;
    name?: string;
    address?: Record<string, string>;
  }>;

  return results
    .map((item) => {
      const lat = Number(item.lat);
      const lng = Number(item.lon);
      const address = item.address ?? {};
      const primary =
        item.name ||
        address.suburb ||
        address.neighbourhood ||
        address.village ||
        address.town ||
        address.city ||
        (item.display_name ?? '').split(',')[0] ||
        'Unknown';
      // Everything after the primary, without repeating it.
      const rest = (item.display_name ?? '')
        .split(',')
        .map((s) => s.trim())
        .filter((s) => s && s !== primary);
      const secondary = rest.join(', ');
      return {
        label: item.display_name ?? '',
        primary,
        secondary,
        lat,
        lng,
      };
    })
    .filter((item) => item.label && Number.isFinite(item.lat) && Number.isFinite(item.lng));
}