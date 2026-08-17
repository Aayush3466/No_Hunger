'use client';

import { RADIUS_OPTIONS_KM } from '@/lib/geo';
import type { DonationCategory, FoodType, RequestMode } from '@/lib/supabase/database.types';
import { CATEGORY_LABELS, FOOD_TYPE_LABELS } from '@/lib/format';
import type { NearbyFilters } from '@/hooks/useNearbyDonations';
import ui from '@/components/ui/ui.module.css';
import styles from './Map.module.css';

function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
}

export function FilterPanel({
  filters,
  onChange,
  onClose,
}: {
  filters: NearbyFilters;
  onChange: (next: NearbyFilters) => void;
  onClose: () => void;
}) {
  return (
    <>
      {/* Dimmed backdrop — only shown on mobile, where the panel is a bottom
          sheet. On desktop the panel is a dropdown and this stays display:none. */}
      <div className={styles.filtersBackdrop} onClick={onClose} aria-hidden="true" />
      <div className={styles.filters} role="group" aria-label="Filters">
      <div className={styles.filterRow}>
        <span className={styles.filterLabel}>Within</span>
        <div className={ui.segments}>
          {RADIUS_OPTIONS_KM.map((km) => (
            <button
              key={km}
              type="button"
              className={filters.radiusKm === km ? `${ui.segment} ${ui.segmentActive}` : ui.segment}
              aria-pressed={filters.radiusKm === km}
              onClick={() => onChange({ ...filters, radiusKm: km })}
            >
              {km} km
            </button>
          ))}
        </div>
      </div>

      <div className={styles.filterRow}>
        <span className={styles.filterLabel}>Diet</span>
        <div className={ui.segments}>
          {(Object.keys(CATEGORY_LABELS) as DonationCategory[]).map((category) => (
            <button
              key={category}
              type="button"
              className={
                filters.categories.includes(category)
                  ? `${ui.segment} ${ui.segmentActive}`
                  : ui.segment
              }
              aria-pressed={filters.categories.includes(category)}
              onClick={() => onChange({ ...filters, categories: toggle(filters.categories, category) })}
            >
              {CATEGORY_LABELS[category]}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.filterRow}>
        <span className={styles.filterLabel}>Kind</span>
        <div className={ui.segments}>
          {(Object.keys(FOOD_TYPE_LABELS) as FoodType[]).map((type) => (
            <button
              key={type}
              type="button"
              className={
                filters.foodTypes.includes(type) ? `${ui.segment} ${ui.segmentActive}` : ui.segment
              }
              aria-pressed={filters.foodTypes.includes(type)}
              onClick={() => onChange({ ...filters, foodTypes: toggle(filters.foodTypes, type) })}
            >
              {FOOD_TYPE_LABELS[type]}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.filterRow}>
        <span className={styles.filterLabel}>Fulfilment</span>
        <div className={ui.segments}>
          {([null, 'pickup', 'delivery'] as Array<RequestMode | null>).map((mode) => (
            <button
              key={mode ?? 'any'}
              type="button"
              className={filters.mode === mode ? `${ui.segment} ${ui.segmentActive}` : ui.segment}
              aria-pressed={filters.mode === mode}
              onClick={() => onChange({ ...filters, mode })}
            >
              {mode === null ? 'Any' : mode === 'pickup' ? 'Pickup' : 'Delivery'}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.filterRow}>
        <label className={styles.filterLabel} htmlFor="min-servings">
          At least
        </label>
        <input
          id="min-servings"
          type="number"
          inputMode="numeric"
          min={1}
          max={50}
          value={filters.minServings}
          className={ui.input}
          onChange={(event) =>
            onChange({ ...filters, minServings: Math.max(1, Number(event.target.value) || 1) })
          }
        />
      </div>

        <button type="button" className="btn btn-outline btn-block" onClick={onClose}>
          Done
        </button>
      </div>
    </>
  );
}
