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
          <Link href="/map" className={`btn btn-ghost ${styles.authHeaderLink}`}>
            Browse the map
          </Link>
        </div>
      </header>
      <main style={{ maxWidth: 460, margin: '0 auto', padding: '2rem var(--nh-gutter) 3rem' }}>
        {children}
      </main>
    </div>
  );
}
