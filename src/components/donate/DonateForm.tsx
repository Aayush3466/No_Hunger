'use client';

/* eslint-disable @next/next/no-img-element */
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { SafetyNotice } from '@/components/ui/SafetyNotice';
import { useGeolocation } from '@/hooks/useGeolocation';
import { compressToWebp, formatBytes, ImageError, TARGET_BYTES } from '@/lib/image';
import { CATEGORY_LABELS, FOOD_TYPE_LABELS } from '@/lib/format';
import type { DonationCategory, FoodType, FulfilmentMode } from '@/lib/supabase/database.types';
import type { LatLng } from '@/lib/geo';
import { createDonationAction } from '@/server/actions/donations';
import ui from '@/components/ui/ui.module.css';
import mapStyles from '@/components/map/Map.module.css';
import styles from './Donate.module.css';

const MapCanvas = dynamic(() => import('@/components/map/MapCanvas'), {
  ssr: false,
  loading: () => <div className={mapStyles.mapSkeleton}>Loading the map…</div>,
});

/** value for <input type="datetime-local">, in the browser's own timezone. */
function toLocalInput(date: Date): string {
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

const FULFILMENT_LABELS: Record<FulfilmentMode, string> = {
  pickup: 'Pickup only',
  delivery: 'I will deliver',
  both: 'Either',
};

export function DonateForm() {
  const router = useRouter();
  const { position, status, center } = useGeolocation();
  const fileInput = useRef<HTMLInputElement>(null);

  const [pickup, setPickup] = useState<LatLng | null>(null);
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [photoBytes, setPhotoBytes] = useState(0);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [compressing, setCompressing] = useState(false);

  const [category, setCategory] = useState<DonationCategory>('veg');
  const [foodType, setFoodType] = useState<FoodType>('cooked');
  const [mode, setMode] = useState<FulfilmentMode>('pickup');
  const [expiresAt, setExpiresAt] = useState(() => toLocalInput(new Date(Date.now() + 3 * 3_600_000)));

  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Seed the pin from GPS the first time we hear back, then leave it to the user.
  useEffect(() => {
    if (!pickup && status === 'granted' && position) setPickup(position);
  }, [pickup, position, status]);

  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview);
  }, [preview]);

  async function handleFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setPhotoError(null);
    setCompressing(true);
    try {
      const compressed = await compressToWebp(file);
      if (preview) URL.revokeObjectURL(preview);
      setPhoto(compressed.file);
      setPreview(compressed.previewUrl);
      setPhotoBytes(compressed.bytes);
    } catch (cause) {
      setPhotoError(cause instanceof ImageError ? cause.message : 'That photo could not be used.');
      setPhoto(null);
      setPreview(null);
    } finally {
      setCompressing(false);
      // Let the same file be chosen again after an error.
      if (fileInput.current) fileInput.current.value = '';
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const point = pickup ?? (status === 'granted' ? position : null);
    if (!point) {
      setError('Set the pickup point on the map before posting.');
      return;
    }

    const formData = new FormData(event.currentTarget);
    formData.set('pickup_lat', String(point.lat));
    formData.set('pickup_lng', String(point.lng));
    formData.set('expires_at', new Date(expiresAt).toISOString());
    if (mode === 'pickup') formData.delete('delivery_radius_km');
    if (photo) formData.set('photo', photo);
    else formData.delete('photo');

    setSubmitting(true);
    const result = await createDonationAction(formData);
    setSubmitting(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.push('/map');
    router.refresh();
  }

  return (
    <form className={ui.stack} onSubmit={handleSubmit}>
      {/* ---------------------------------------------------------------- photo */}
      <div className={ui.field}>
        <span className={ui.label}>Photo</span>
        <input
          ref={fileInput}
          id="photo"
          name="photo"
          type="file"
          accept="image/*"
          capture="environment"
          className="sr-only"
          onChange={handleFile}
        />
        {preview ? (
          <div>
            <img src={preview} alt="The food you are about to share" className={styles.photoPreview} />
            <div className={styles.photoMeta}>
              <span>
                WebP · {formatBytes(photoBytes)}
                {photoBytes <= TARGET_BYTES * 1.2 ? '' : ' (a little over target)'}
              </span>
              <button
                type="button"
                className={ui.hint}
                onClick={() => fileInput.current?.click()}
                style={{ textDecoration: 'underline' }}
              >
                Replace
              </button>
            </div>
          </div>
        ) : (
          <button type="button" className={styles.photoDrop} onClick={() => fileInput.current?.click()}>
            <span style={{ fontSize: '1.6rem' }} aria-hidden="true">
              📷
            </span>
            <span>{compressing ? 'Preparing your photo…' : 'Add one photo'}</span>
            <span className={ui.hint}>
              Shrunk to about 50 KB in your browser. Location data is stripped before it leaves your
              phone.
            </span>
          </button>
        )}
        {photoError ? <p className={ui.error}>{photoError}</p> : null}
      </div>

      {/* ----------------------------------------------------------------- what */}
      <div className={ui.field}>
        <label className={ui.label} htmlFor="food_name">
          What is it?
        </label>
        <input id="food_name" name="food_name" required maxLength={80} className={ui.input} />
      </div>

      <div className={ui.field}>
        <label className={ui.label} htmlFor="description">
          Anything worth knowing?
        </label>
        <textarea id="description" name="description" maxLength={500} className={ui.textarea} />
        <p className={ui.hint}>When it was cooked, how spicy it is, what to bring.</p>
      </div>

      <div className={ui.field}>
        <span className={ui.label} id="category-label">
          Diet
        </span>
        <div className={ui.segments} role="group" aria-labelledby="category-label">
          {(Object.keys(CATEGORY_LABELS) as DonationCategory[]).map((option) => (
            <button
              key={option}
              type="button"
              className={category === option ? `${ui.segment} ${ui.segmentActive}` : ui.segment}
              aria-pressed={category === option}
              onClick={() => setCategory(option)}
            >
              {CATEGORY_LABELS[option]}
            </button>
          ))}
        </div>
        <input type="hidden" name="category" value={category} />
      </div>

      <div className={ui.field}>
        <span className={ui.label} id="type-label">
          Kind
        </span>
        <div className={ui.segments} role="group" aria-labelledby="type-label">
          {(Object.keys(FOOD_TYPE_LABELS) as FoodType[]).map((option) => (
            <button
              key={option}
              type="button"
              className={foodType === option ? `${ui.segment} ${ui.segmentActive}` : ui.segment}
              aria-pressed={foodType === option}
              onClick={() => setFoodType(option)}
            >
              {FOOD_TYPE_LABELS[option]}
            </button>
          ))}
        </div>
        <input type="hidden" name="food_type" value={foodType} />
      </div>

      <div className={ui.field}>
        <label className={ui.label} htmlFor="allergens">
          Allergens
        </label>
        <input
          id="allergens"
          name="allergens"
          maxLength={200}
          placeholder="Peanuts, dairy, gluten"
          className={ui.input}
        />
        <p className={ui.hint}>Name everything you know of, even the obvious ones.</p>
      </div>

      <div className={ui.field}>
        <label className={ui.label} htmlFor="total_servings">
          Feeds how many?
        </label>
        <input
          id="total_servings"
          name="total_servings"
          type="number"
          min={1}
          max={500}
          defaultValue={2}
          required
          className={ui.input}
        />
        <p className={ui.hint}>People can claim part of this. The rest stays on the map.</p>
      </div>

      {/* ------------------------------------------------------------- location */}
      <div className={ui.field}>
        <span className={ui.label}>Pickup point</span>
        <div className={styles.picker}>
          <MapCanvas
            center={pickup ?? center}
            pickerPosition={pickup ?? center}
            onPickerMove={setPickup}
            userPosition={status === 'granted' ? position : null}
          />
          <p className={styles.pickerHint}>Drag the pin to the exact spot.</p>
        </div>
        {status === 'denied' ? (
          <p className={ui.hint}>
            Location is off, so the pin starts at a default spot. Drag it where it belongs.
          </p>
        ) : null}
      </div>

      <div className={ui.field}>
        <label className={ui.label} htmlFor="pickup_address">
          Landmark or address
        </label>
        <input
          id="pickup_address"
          name="pickup_address"
          maxLength={240}
          placeholder="Green gate beside the pharmacy"
          className={ui.input}
        />
        <p className={ui.hint}>Shown publicly, so keep it approximate if you would rather.</p>
      </div>

      {/* ------------------------------------------------------------ fulfilment */}
      <div className={ui.field}>
        <span className={ui.label} id="mode-label">
          How does it get there?
        </span>
        <div className={ui.segments} role="group" aria-labelledby="mode-label">
          {(Object.keys(FULFILMENT_LABELS) as FulfilmentMode[]).map((option) => (
            <button
              key={option}
              type="button"
              className={mode === option ? `${ui.segment} ${ui.segmentActive}` : ui.segment}
              aria-pressed={mode === option}
              onClick={() => setMode(option)}
            >
              {FULFILMENT_LABELS[option]}
            </button>
          ))}
        </div>
        <input type="hidden" name="fulfilment_mode" value={mode} />
      </div>

      {mode !== 'pickup' ? (
        <div className={ui.field}>
          <label className={ui.label} htmlFor="delivery_radius_km">
            How far will you go?
          </label>
          <input
            id="delivery_radius_km"
            name="delivery_radius_km"
            type="number"
            min={0.5}
            max={50}
            step={0.5}
            defaultValue={3}
            className={ui.input}
          />
          <p className={ui.hint}>Kilometres from the pickup point.</p>
        </div>
      ) : null}

      <div className={ui.field}>
        <label className={ui.label} htmlFor="expires_at">
          Good until
        </label>
        <input
          id="expires_at"
          type="datetime-local"
          value={expiresAt}
          onChange={(event) => setExpiresAt(event.target.value)}
          className={ui.input}
          required
        />
        <p className={ui.hint}>
          It drops off the map automatically at this time. Between 15 minutes and 48 hours away.
        </p>
      </div>

      <SafetyNotice variant="donor" />

      {error ? (
        <p className={ui.formError} role="alert">
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        className="btn btn-primary btn-block"
        disabled={submitting || compressing}
      >
        {submitting ? 'Posting…' : 'Post this food'}
      </button>
    </form>
  );
}
