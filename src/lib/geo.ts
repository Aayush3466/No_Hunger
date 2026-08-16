export interface LatLng {
  lat: number;
  lng: number;
}

/**
 * Fallback map centre used only until we know where the user is, and only when
 * geolocation is denied or unavailable. Override in .env.local.
 */
export const FALLBACK_CENTER: LatLng = {
  lat: Number(process.env.NEXT_PUBLIC_DEFAULT_CENTER_LAT ?? 27.7172),
  lng: Number(process.env.NEXT_PUBLIC_DEFAULT_CENTER_LNG ?? 85.324),
};

export const RADIUS_OPTIONS_KM = [1, 3, 5, 10, 25] as const;
export const DEFAULT_RADIUS_KM = 5;

/** Same formula as public.nh_haversine_km, so client and server agree. */
export function haversineKm(a: LatLng, b: LatLng): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 6371.0088 * 2 * Math.asin(Math.sqrt(h));
}

export function isValidLatLng(value: unknown): value is LatLng {
  if (typeof value !== 'object' || value === null) return false;
  const { lat, lng } = value as Partial<LatLng>;
  return (
    typeof lat === 'number' &&
    typeof lng === 'number' &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
}

export function formatDistance(km: number | null | undefined): string {
  if (km === null || km === undefined || !Number.isFinite(km)) return '';
  if (km < 1) return `${Math.round(km * 1000)} m away`;
  return `${km.toFixed(1)} km away`;
}

/** Zoom level that roughly frames a given radius on a phone-sized viewport. */
export function zoomForRadius(radiusKm: number): number {
  if (radiusKm <= 1) return 15;
  if (radiusKm <= 3) return 14;
  if (radiusKm <= 5) return 13;
  if (radiusKm <= 10) return 12;
  return 11;
}
