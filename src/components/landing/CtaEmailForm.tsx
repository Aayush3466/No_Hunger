'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import styles from './Landing.module.css';

/**
 * Extracted from CtaSection so the section can be a server component that
 * reads the session, while the form (which needs useState) stays client-side.
 */
export function CtaEmailForm() {
  const router = useRouter();
  const [email, setEmail] = useState('');

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = email.trim();
    router.push(trimmed ? `/signup?email=${encodeURIComponent(trimmed)}` : '/signup');
  }

  return (
    <form className={styles.ctaForm} onSubmit={handleSubmit}>
      <label htmlFor="cta-email" className="sr-only">
        Email address
      </label>
      <input
        id="cta-email"
        name="email"
        type="email"
        autoComplete="email"
        placeholder="you@neighborhood.com"
        className={styles.ctaInput}
        value={email}
        onChange={(event) => setEmail(event.target.value)}
      />
      <button type="submit" className="btn btn-honey">
        Get Started Free
      </button>
    </form>
  );
}