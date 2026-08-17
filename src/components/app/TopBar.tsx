import Link from 'next/link';
import { NotificationBell } from '@/components/app/NotificationBell';
import { getSessionUser, createServerSupabase } from '@/lib/supabase/server';
import styles from '@/components/ui/ui.module.css';

export async function TopBar() {
  const user = await getSessionUser();

  // When signed in, show the avatar (photo or initial) + a Logout button,
  // mirroring the landing-page header. avatar_url and full_name are public
  // profile fields, so reading them here carries no privacy concern.
  let avatarUrl: string | null = null;
  let initial = '?';
  if (user) {
    const supabase = await createServerSupabase();
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name, avatar_url')
      .eq('id', user.id)
      .maybeSingle();
    avatarUrl = profile?.avatar_url ?? null;
    initial = (profile?.full_name ?? user.email ?? '?').trim().charAt(0).toUpperCase() || '?';
  }

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
          <div className={styles.userGroup}>
            <NotificationBell userId={user.id} />
            <Link
              href="/profile"
              className={styles.avatarLink}
              aria-label="Your profile"
              title="Your profile"
            >
              {avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={avatarUrl} alt="" className={styles.avatarImg} />
              ) : (
                <span className={styles.avatarInitial} aria-hidden="true">
                  {initial}
                </span>
              )}
            </Link>
            <form action="/auth/signout" method="post">
              <button
                type="submit"
                className="btn btn-outline"
                style={{ padding: '.5rem .9rem', fontSize: '.9rem' }}
              >
                Logout
              </button>
            </form>
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
