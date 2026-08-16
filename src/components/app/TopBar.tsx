import Link from 'next/link';
import { NotificationBell } from '@/components/app/NotificationBell';
import { getSessionUser } from '@/lib/supabase/server';
import styles from '@/components/ui/ui.module.css';

export async function TopBar() {
  const user = await getSessionUser();

  return (
    <header className={styles.topBar}>
      <div className={styles.topBarInner}>
        <Link href="/" className={styles.brand}>
          <span className={styles.brandMark} aria-hidden="true">
            ◐
          </span>
          NoHunger
        </Link>

        {user ? (
          <div style={{ display: 'flex', gap: '.5rem', alignItems: 'center' }}>
            <NotificationBell userId={user.id} />
            <Link
              href="/profile"
              className="btn btn-ghost"
              style={{ padding: '.5rem .9rem', fontSize: '.9rem' }}
            >
              Account
            </Link>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: '.5rem' }}>
            <Link
              href="/signup"
              className="btn btn-outline"
              style={{ padding: '.5rem 1rem', fontSize: '.9rem' }}
            >
              Sign up
            </Link>
            <Link
              href="/login"
              className="btn btn-primary"
              style={{ padding: '.5rem 1rem', fontSize: '.9rem' }}
            >
              Sign in
            </Link>
          </div>
        )}
      </div>
    </header>
  );
}