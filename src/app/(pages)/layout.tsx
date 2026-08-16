import Link from 'next/link';
import { SiteFooter } from '@/components/landing/SiteFooter';
import styles from '@/components/ui/ui.module.css';

export default function PagesLayout({ children }: { children: React.ReactNode }) {
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
          <Link href="/map" className={styles.hint}>
            Open the map
          </Link>
        </div>
      </header>
      <main className={styles.screen}>{children}</main>
      <SiteFooter />
    </div>
  );
}