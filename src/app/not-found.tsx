import Link from 'next/link';
import styles from '@/components/ui/ui.module.css';

export default function NotFound() {
  return (
    <main className={styles.screen}>
      <p className={styles.eyebrow}>404</p>
      <h1 className={`serif ${styles.title}`}>That page is not here</h1>
      <p className={styles.lede}>
        The link may be stale, or the listing behind it has already been claimed.
      </p>
      <Link href="/map" className="btn btn-primary">
        Open the map
      </Link>
    </main>
  );
}
