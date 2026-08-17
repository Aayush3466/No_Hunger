import { useEffect } from 'react';

/**
 * Locks background scrolling while `active` is true.
 *
 * The app shell (see globals.css `.app-shell`) makes `.app-main` the scroll
 * container — the document body itself does not scroll on app routes. So a
 * plain `body { overflow: hidden }` lock would do nothing here. Instead we lock
 * whichever element is actually scrolling: `.app-main` when present, otherwise
 * the body (landing page).
 *
 * A per-target ref count keeps stacked overlays from unlocking the page while
 * another overlay is still open, and each target's previous inline overflow is
 * restored exactly on release.
 *
 * Modals are `position: fixed`, so `overflow: hidden` on the scroller never
 * clips them.
 */
const locks = new Map<HTMLElement, { count: number; prevOverflow: string }>();

function scrollTarget(): HTMLElement {
  return (document.querySelector('.app-main') as HTMLElement | null) ?? document.body;
}

export function useScrollLock(active = true): void {
  useEffect(() => {
    if (!active) return;

    const target = scrollTarget();
    const existing = locks.get(target);
    if (existing) {
      existing.count += 1;
    } else {
      locks.set(target, { count: 1, prevOverflow: target.style.overflow });
      target.style.overflow = 'hidden';
    }

    return () => {
      const entry = locks.get(target);
      if (!entry) return;
      entry.count -= 1;
      if (entry.count <= 0) {
        target.style.overflow = entry.prevOverflow;
        locks.delete(target);
      }
    };
  }, [active]);
}
