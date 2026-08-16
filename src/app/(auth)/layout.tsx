import Link from 'next/link';
import styles from '@/components/ui/ui.module.css';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: '100dvh', background: 'var(--nh-cream)' }}>
      <header className={styles.topBar}>
        <div className={styles.topBarInner}>
          <Link href="/" className={styles.brand}>
            <span className={styles.brandMark} aria-hidden="true">
              ◐
            </span>
            NoHunger
          </Link>
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
  <Link href="/signup" className={styles.hint}>
    Create account
  </Link>
  <Link href="/map" className={styles.hint}>
    Browse without an account
  </Link>
</div>
        </div>
      </header>
      <main style={{ maxWidth: 460, margin: '0 auto', padding: '2rem var(--nh-gutter) 3rem' }}>
        {children}
      </main>
    </div>
  );
}
