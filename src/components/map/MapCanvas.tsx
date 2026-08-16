'use client';

import 'leaflet/dist/leaflet.css';

import L from 'leaflet';
import { useEffect, useMemo, useRef } from 'react';
import { MapContainer, Marker, Polyline, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import type { AvailableDonation } from '@/lib/supabase/database.types';
import { zoomForRadius, type LatLng } from '@/lib/geo';
import styles from './Map.module.css';

function pinIcon(label: string, tone: 'green' | 'honey', active: boolean) {
  const classes = [styles.markerPin];
  if (tone === 'honey') classes.push(styles.markerPinHoney);
  if (active) classes.push(styles.markerPinActive);
  return L.divIcon({
    className: '',
    html: `<div class="${classes.join(' ')}">${label}</div>`,
    iconSize: [38, 38],
    iconAnchor: [19, 19],
  });
}

const selfIcon = () =>
  L.divIcon({
    className: '',
    html: `<div class="${styles.markerSelf}"></div>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  });

const pickIcon = () =>
  L.divIcon({
    className: '',
    html: `<div class="${styles.markerPick}"></div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 26],
  });

/** Labelled marker used on the active-order screen for pickup/dropoff pins. */
function labelIcon(label: string, tone: 'green' | 'honey') {
  const bg = tone === 'green' ? 'var(--nh-green)' : 'var(--nh-honey)';
  return L.divIcon({
    className: '',
    html: `<div class="${styles.markerLabel}" style="background:${bg}">${label}</div>`,
    iconSize: [80, 34],
    iconAnchor: [40, 34],
  });
}

function Recenter({ center, zoom, trigger }: { center: LatLng; zoom: number; trigger: number }) {
  const map = useMap();
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      map.setView([center.lat, center.lng], zoom, { animate: false });
      return;
    }
    map.setView([center.lat, center.lng], zoom, { animate: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trigger]);
  return null;
}

/**
 * On the active-order screen we want the map to auto-frame both endpoints
 * (donor + receiver, or you + pickup point). Fires once per `trigger` change,
 * so the user can still zoom and pan afterwards.
 */
function FitBounds({ points, trigger }: { points: LatLng[]; trigger: number }) {
  const map = useMap();
  useEffect(() => {
    if (points.length < 2) return;
    const bounds = L.latLngBounds(points.map((p) => [p.lat, p.lng] as [number, number]));
    map.fitBounds(bounds, { padding: [60, 60], maxZoom: 16, animate: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trigger]);
  return null;
}

function MoveWatcher({ onMoveEnd }: { onMoveEnd?: (center: LatLng) => void }) {
  useMapEvents({
    moveend(event) {
      if (!onMoveEnd) return;
      const c = event.target.getCenter();
      onMoveEnd({ lat: c.lat, lng: c.lng });
    },
  });
  return null;
}

export interface OrderMarker {
  position: LatLng;
  label: string;
  tone: 'green' | 'honey';
}

export interface MapCanvasProps {
  center: LatLng;
  radiusKm?: number;
  donations?: AvailableDonation[];
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  userPosition?: LatLng | null;
  /** Draggable pin, used by the donation form to set the pickup point. */
  pickerPosition?: LatLng | null;
  onPickerMove?: (position: LatLng) => void;
  onMoveEnd?: (center: LatLng) => void;
  recenterTrigger?: number;
  /** Route polyline. Array of [lat, lng] points, drawn as a single line. */
  route?: LatLng[];
  /**
   * Labelled markers for the active-order screen. Rendered on top of any
   * donation markers, using their own icon so they stand out.
   */
  orderMarkers?: OrderMarker[];
  /**
   * When set, the map auto-fits these points once. Bump `fitTrigger` to
   * refit (e.g. when the route arrives). Independent from `recenterTrigger`.
   */
  fitPoints?: LatLng[];
  fitTrigger?: number;
}

export default function MapCanvas({
  center,
  radiusKm = 5,
  donations = [],
  selectedId = null,
  onSelect,
  userPosition = null,
  pickerPosition = null,
  onPickerMove,
  onMoveEnd,
  recenterTrigger = 0,
  route,
  orderMarkers,
  fitPoints,
  fitTrigger = 0,
}: MapCanvasProps) {
  const zoom = pickerPosition ? 16 : zoomForRadius(radiusKm);
  const selfMarker = useMemo(() => selfIcon(), []);
  const pickMarker = useMemo(() => pickIcon(), []);

  const routeLatLngs = useMemo<[number, number][]>(
    () => (route ?? []).map((p) => [p.lat, p.lng] as [number, number]),
    [route],
  );

  return (
    <MapContainer
      center={[center.lat, center.lng]}
      zoom={zoom}
      className={styles.canvas}
      zoomControl={false}
      attributionControl
      preferCanvas
    >
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        maxZoom={19}
        detectRetina
      />

      <Recenter center={center} zoom={zoom} trigger={recenterTrigger} />
      <MoveWatcher onMoveEnd={onMoveEnd} />

      {fitPoints && fitPoints.length >= 2 ? (
        <FitBounds points={fitPoints} trigger={fitTrigger} />
      ) : null}

      {routeLatLngs.length > 1 ? (
        <>
          {/* casing behind the main line for legibility */}
          <Polyline
            positions={routeLatLngs}
            pathOptions={{ color: '#F5F0E6', weight: 8, opacity: 0.9 }}
          />
          <Polyline
            positions={routeLatLngs}
            pathOptions={{ color: '#4A6741', weight: 5, opacity: 0.95, lineCap: 'round' }}
          />
        </>
      ) : null}

      {userPosition ? (
        <Marker
          position={[userPosition.lat, userPosition.lng]}
          icon={selfMarker}
          keyboard={false}
          interactive={false}
        />
      ) : null}

      {pickerPosition ? (
        <Marker
          position={[pickerPosition.lat, pickerPosition.lng]}
          icon={pickMarker}
          draggable
          autoPan
          alt="Pickup location. Drag to adjust."
          eventHandlers={{
            dragend(event) {
              const next = (event.target as L.Marker).getLatLng();
              onPickerMove?.({ lat: next.lat, lng: next.lng });
            },
          }}
        />
      ) : null}

      {donations.map((donation) => (
        <Marker
          key={donation.id}
          position={[donation.pickup_lat, donation.pickup_lng]}
          icon={pinIcon(
            String(donation.servings_remaining),
            donation.category === 'non_veg' ? 'honey' : 'green',
            donation.id === selectedId,
          )}
          alt={`${donation.food_name}, ${donation.servings_remaining} servings left`}
          eventHandlers={{
            click() {
              onSelect?.(donation.id);
            },
          }}
        />
      ))}

      {(orderMarkers ?? []).map((m, i) => (
        <Marker
          key={`order-${i}-${m.label}`}
          position={[m.position.lat, m.position.lng]}
          icon={labelIcon(m.label, m.tone)}
          interactive={false}
        />
      ))}
    </MapContainer>
  );
}