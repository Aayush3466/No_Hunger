'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { FALLBACK_CENTER, isValidLatLng, type LatLng } from '@/lib/geo';

export type GeolocationStatus = 'idle' | 'locating' | 'granted' | 'denied' | 'unavailable';

export interface GeolocationState {
  position: LatLng | null;
  status: GeolocationStatus;
  /** Where the map should look right now, even before permission is answered. */
  center: LatLng;
  request: () => void;
}

/**
 * Asks once on mount, like a ride-hailing app. A denial is not a dead end: the
 * caller falls back to manual location search rather than blocking the screen.
 */
export function useGeolocation(): GeolocationState {
  const [position, setPosition] = useState<LatLng | null>(null);
  const [status, setStatus] = useState<GeolocationStatus>('idle');
  const watchId = useRef<number | null>(null);

  const request = useCallback(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setStatus('unavailable');
      return;
    }
    setStatus('locating');
    navigator.geolocation.getCurrentPosition(
      (result) => {
        const next = { lat: result.coords.latitude, lng: result.coords.longitude };
        if (isValidLatLng(next)) {
          setPosition(next);
          setStatus('granted');
        }
      },
      (error) => {
        setStatus(error.code === error.PERMISSION_DENIED ? 'denied' : 'unavailable');
      },
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 30_000 },
    );
  }, []);

  useEffect(() => {
    request();
    return () => {
      if (watchId.current !== null && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchId.current);
      }
    };
  }, [request]);

  return {
    position,
    status,
    center: position ?? FALLBACK_CENTER,
    request,
  };
}
