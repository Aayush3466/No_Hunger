'use client';

import { useEffect } from 'react';
import styles from '@/components/ui/ui.module.css';

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // PHASE 6: forward to whatever error reporting you settle on.
    console.error(error);
  }, [error]);

  return (
    <main className={styles.screen}>
      <p className={styles.eyebrow}>Something broke</p>
      <h1 className={`serif ${styles.title}`}>That did not load</h1>
      <p className={styles.lede}>
        The page hit an error on the way in. Trying again usually clears it.
      </p>
      <button type="button" className="btn btn-primary" onClick={reset}>
        Try again
      </button>
    </main>
  );
}
