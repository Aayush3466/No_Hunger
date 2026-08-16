import Link from 'next/link';
import { getSessionUser } from '@/lib/supabase/server';
import { createServerSupabase } from '@/lib/supabase/server';
import styles from './Landing.module.css';

/**
 * Ported from the <header> in NoHunger-Organic.html.
 * The "Get started" CTA is swapped in and out based on auth:
 *   - signed out: "Sign in"  →  /login
 *   - signed in : avatar → /profile, plus a Logout button
 * Everything else — structure, copy, style values — unchanged.
 */
export async function SiteHeader() {
  const user = await getSessionUser();

  // Read the profile so we can render the avatar image or initial. Two extra
  // fields, no privacy concern: avatar_url is a public field, full_name is too.
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
    <header className={styles.header}>
      <nav className={styles.nav} aria-label="Main">
        <Link href="/" className={styles.brand}>
          <span className={styles.brandMark} aria-hidden="true">
            ◐
          </span>
          NoHunger
        </Link>
        <div className={styles.navLinks}>
          <a href="#how">How it works</a>
          <a href="#features">Features</a>
          <a href="#about">About</a>

          {user ? (
            <div className={styles.authGroup}>
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
                <button type="submit" className={`btn btn-outline ${styles.headerCta}`}>
                  Logout
                </button>
              </form>
            </div>
          ) : (
            <Link href="/login" className={`btn btn-primary ${styles.headerCta}`}>
              Sign in
            </Link>
          )}
        </div>
      </nav>
    </header>
  );
}