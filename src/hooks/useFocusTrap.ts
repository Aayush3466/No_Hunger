import { useEffect, type RefObject } from 'react';

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'textarea:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

/**
 * Traps Tab focus inside `ref` while `active`, moving initial focus into the
 * container and restoring it to the previously focused element on release.
 *
 * Escape is intentionally NOT handled here — each caller owns its own close key,
 * so this hook composes with existing keydown handlers instead of fighting them.
 * The container should carry `tabIndex={-1}` so it can receive focus as a last
 * resort when it holds no focusable children.
 */
export function useFocusTrap<T extends HTMLElement>(ref: RefObject<T | null>, active = true): void {
  useEffect(() => {
    if (!active) return;
    const node = ref.current;
    if (!node) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;

    const focusable = (): HTMLElement[] =>
      Array.from(node.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) => el.offsetParent !== null || el === document.activeElement,
      );

    if (!node.contains(document.activeElement)) {
      (focusable()[0] ?? node).focus();
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Tab') return;
      const items = focusable();
      if (items.length === 0) {
        event.preventDefault();
        node!.focus();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      if (!first || !last) return;
      const current = document.activeElement;
      if (event.shiftKey) {
        if (current === first || !node!.contains(current)) {
          event.preventDefault();
          last.focus();
        }
      } else if (current === last || !node!.contains(current)) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      previouslyFocused?.focus?.();
    };
  }, [ref, active]);
}
