'use client';

/* eslint-disable @next/next/no-img-element */
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Countdown } from '@/components/ui/Countdown';
import { DonationCardSkeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { DEFAULT_FILTERS, useNearbyDonations, type NearbyFilters } from '@/hooks/useNearbyDonations';
import { useGeolocation } from '@/hooks/useGeolocation';
import { publicImageUrl } from '@/lib/env';
import { formatAge, servingsLabel } from '@/lib/format';
import { formatDistance, type LatLng } from '@/lib/geo';
import { searchPlaces, type Place } from '@/lib/geocode';
import type { AvailableDonation } from '@/lib/supabase/database.types';
import { DonationSheet } from './DonationSheet';
import { FilterPanel } from './FilterPanel';
import ui from '@/components/ui/ui.module.css';
import styles from './Map.module.css';

const MapCanvas = dynamic(() => import('./MapCanvas'), {
  ssr: false,
  loading: () => <div className={styles.mapSkeleton}>Loading the map…</div>,
});

/**
 * Delay between the user pausing typing and firing an autocomplete request.
 * Nominatim's usage policy is one request per second, so this stays well over
 * that even when the user types fast.
 */
const AUTOCOMPLETE_DEBOUNCE_MS = 700;

export function MapBrowse({ isAuthenticated }: { isAuthenticated: boolean }) {
  const { position, status, center: initialCenter, request: requestLocation } = useGeolocation();

  const [center, setCenter] = useState<LatLng | null>(null);
  const [recenterTick, setRecenterTick] = useState(0);
  const [filters, setFilters] = useState<NearbyFilters>(DEFAULT_FILTERS);
  const [showFilters, setShowFilters] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Search
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<Place[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const searchAbortRef = useRef<AbortController | null>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  const lookingAt = center ?? (status === 'granted' ? position : initialCenter) ?? initialCenter;
  const bias = position ?? lookingAt;

  const { donations, loading, error, removeLocally } = useNearbyDonations(lookingAt, filters);

  const selected = useMemo(
    () => donations.find((item) => item.id === selectedId) ?? null,
    [donations, selectedId],
  );

  const handleExpire = useCallback(
    (id: string) => {
      removeLocally(id);
      setSelectedId((current) => (current === id ? null : current));
    },
    [removeLocally],
  );

  // Debounced autocomplete. Fires AUTOCOMPLETE_DEBOUNCE_MS after the user
  // stops typing. Cancels any in-flight request when a new one starts, so
  // slow responses don't overwrite fresh ones.
  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 3) {
      setSuggestions([]);
      return;
    }

    const handle = window.setTimeout(async () => {
      searchAbortRef.current?.abort();
      const controller = new AbortController();
      searchAbortRef.current = controller;

      try {
        const results = await searchPlaces(trimmed, {
          bias,
          biasRadiusKm: 25,
          signal: controller.signal,
        });
        if (!controller.signal.aborted) {
          setSuggestions(results);
        }
      } catch {
        // Aborted or network fail — either way, leave whatever suggestions
        // were on screen alone.
      }
    }, AUTOCOMPLETE_DEBOUNCE_MS);

    return () => window.clearTimeout(handle);
    // Deliberately not including `bias` here — bias changes constantly as GPS
    // ticks. We only refetch when the query changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  // Close the dropdown when clicking outside it.
  useEffect(() => {
    if (!showSuggestions) return;
    function onClick(e: MouseEvent) {
      if (!suggestionsRef.current?.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [showSuggestions]);

  function selectPlace(place: Place) {
    setCenter({ lat: place.lat, lng: place.lng });
    setRecenterTick((n) => n + 1);
    setQuery(place.primary);
    setShowSuggestions(false);
    setSearchError(null);
  }

  async function runSearch(event: React.FormEvent) {
    event.preventDefault();
    setSearchError(null);
    setShowSuggestions(false);
    if (query.trim().length < 3) return;

    // If suggestions are already loaded, use the first one — it's the best
    // biased match, and we've already paid the network cost.
    if (suggestions[0]) {
      selectPlace(suggestions[0]);
      return;
    }

    setSearching(true);
    try {
      const results = await searchPlaces(query, { bias, biasRadiusKm: 25 });
      const first = results[0];
      if (!first) {
        setSearchError('No match for that place. Try a different spelling.');
      } else {
        selectPlace(first);
      }
    } catch {
      setSearchError('Place search is unavailable right now.');
    } finally {
      setSearching(false);
    }
  }

  return (
    <div className={styles.wrap}>
      <MapCanvas
        center={lookingAt}
        radiusKm={filters.radiusKm}
        donations={donations}
        selectedId={selectedId}
        onSelect={(id) => {
          setSelectedId(id);
          setExpanded(true);
        }}
        userPosition={status === 'granted' ? position : null}
        onMoveEnd={(next) => setCenter(next)}
        recenterTrigger={recenterTick}
      />

      <div className={styles.controls}>
        <div ref={suggestionsRef} className={styles.searchWrap}>
          <form className={styles.searchBox} onSubmit={runSearch} role="search">
            <label className="sr-only" htmlFor="place-search">
              Search for a place
            </label>
            <input
              id="place-search"
              className={styles.searchInput}
              value={query}
              placeholder="Search a neighbourhood"
              onChange={(event) => {
                setQuery(event.target.value);
                setShowSuggestions(true);
              }}
              onFocus={() => setShowSuggestions(true)}
              autoComplete="off"
            />
            <button
              type="submit"
              className={styles.iconButton}
              disabled={searching}
              aria-label="Search"
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                aria-hidden="true"
              >
                <circle cx="11" cy="11" r="7" />
                <path d="m20 20-3.5-3.5" />
              </svg>
            </button>
          </form>

          {showSuggestions && suggestions.length > 0 ? (
            <ul className={styles.suggestions} role="listbox">
              {suggestions.map((place, i) => (
                <li key={`${place.lat}-${place.lng}-${i}`}>
                  <button
                    type="button"
                    className={styles.suggestion}
                    onClick={() => selectPlace(place)}
                    role="option"
                    aria-selected="false"
                  >
                    <span className={styles.suggestionPrimary}>{place.primary}</span>
                    {place.secondary ? (
                      <span className={styles.suggestionSecondary}>{place.secondary}</span>
                    ) : null}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        <button
          type="button"
          className={styles.iconButton}
          onClick={() => {
            setCenter(null);
            requestLocation();
            setRecenterTick((n) => n + 1);
          }}
          aria-label="Centre on my location"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="7" />
            <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
          </svg>
        </button>

        <button
          type="button"
          className={
            showFilters ? `${styles.iconButton} ${styles.iconButtonActive}` : styles.iconButton
          }
          onClick={() => setShowFilters((value) => !value)}
          aria-expanded={showFilters}
          aria-label="Filters"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            aria-hidden="true"
          >
            <path d="M4 6h16M7 12h10M10 18h4" />
          </svg>
        </button>
      </div>

      {showFilters ? (
        <FilterPanel filters={filters} onChange={setFilters} onClose={() => setShowFilters(false)} />
      ) : null}

      <section
        className={expanded ? styles.sheet : `${styles.sheet} ${styles.sheetCollapsed}`}
        aria-label="Food nearby"
      >
        <button
          type="button"
          className={styles.sheetHandle}
          onClick={() => setExpanded((value) => !value)}
          aria-expanded={expanded}
        >
          <span className={styles.sheetGrip} aria-hidden="true" />
          <span className={styles.sheetTitle}>
            {loading
              ? 'Looking around you…'
              : donations.length === 0
                ? 'Nothing nearby yet'
                : `${donations.length} nearby`}
          </span>
        </button>

        <div className={styles.sheetBody}>
          {searchError ? (
            <p className={ui.formError} role="alert">
              {searchError}
            </p>
          ) : null}

          {status === 'denied' ? (
            <p className={ui.hint}>
              Location is off, so the map is showing a default area. Search a neighbourhood above to
              move it.
            </p>
          ) : null}

          {error ? (
            <p className={ui.formError} role="alert">
              {error}
            </p>
          ) : null}

          {loading ? (
            <>
              <DonationCardSkeleton />
              <DonationCardSkeleton />
              <DonationCardSkeleton />
            </>
          ) : donations.length === 0 ? (
            <EmptyState
              title="No food within this radius"
              body="Widen the distance filter, move the map, or be the first to share something here."
              action={
                <Link href="/donate" className="btn btn-primary">
                  Donate food
                </Link>
              }
            />
          ) : (
            donations.map((donation) => (
              <ListingCard
                key={donation.id}
                donation={donation}
                active={donation.id === selectedId}
                onSelect={() => setSelectedId(donation.id)}
                onExpire={() => handleExpire(donation.id)}
              />
            ))
          )}
        </div>
      </section>

      {selected ? (
        <DonationSheet
          donation={selected}
          userPosition={position}
          isAuthenticated={isAuthenticated}
          onClose={() => setSelectedId(null)}
          onRequested={() => undefined}
        />
      ) : null}
    </div>
  );
}

function ListingCard({
  donation,
  active,
  onSelect,
  onExpire,
}: {
  donation: AvailableDonation;
  active: boolean;
  onSelect: () => void;
  onExpire: () => void;
}) {
  const imageUrl = publicImageUrl(donation.image_path);

  return (
    <button
      type="button"
      className={active ? `${styles.listing} ${styles.listingActive}` : styles.listing}
      onClick={onSelect}
      aria-label={`${donation.food_name}, ${servingsLabel(donation.servings_remaining)} left`}
    >
      {imageUrl ? (
        <img src={imageUrl} alt="" className={styles.thumb} loading="lazy" />
      ) : (
        <span className={styles.thumb} aria-hidden="true">
          {donation.food_name.charAt(0).toUpperCase()}
        </span>
      )}
      <span className={styles.listingBody}>
        <span className={styles.listingName}>{donation.food_name}</span>
        <span className={styles.listingMeta}>
          {formatDistance(donation.distance_km)} · {formatAge(donation.created_at)} ·{' '}
          {servingsLabel(donation.servings_remaining)}
        </span>
        <span>
          <Countdown expiresAt={donation.expires_at} onExpire={onExpire} />
        </span>
      </span>
    </button>
  );
}