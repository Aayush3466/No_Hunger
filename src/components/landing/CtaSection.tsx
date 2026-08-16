import Link from 'next/link';
import { getSessionUser } from '@/lib/supabase/server';
import { CtaEmailForm } from './CtaEmailForm';
import styles from './Landing.module.css';

/**
 * The green card at the bottom. Two states:
 *   - signed out: the original email-signup form
 *   - signed in : a direct link into the app, since asking a signed-in user
 *     for their email again is a bit of an insult
 */
export async function CtaSection() {
  const user = await getSessionUser();

  return (
    <section id="cta" className={styles.cta}>
      <div className={`blob ${styles.ctaBlobA}`} />
      <div className={`blob ${styles.ctaBlobB}`} />
      <div className={styles.ctaCard}>
        {user ? (
          <>
            <h2 className={`serif ${styles.ctaTitle}`}>You&apos;re in.</h2>
            <p className={styles.ctaText}>
              Open the map to see what neighbours are sharing right now.
            </p>
            <div className={styles.ctaLoggedInActions}>
              <Link href="/map" className="btn btn-honey">
                See what&apos;s near you
              </Link>
              <Link href="/donate" className={`btn btn-outline ${styles.ctaSecondary}`}>
                Post extra food
              </Link>
            </div>
            <div className={styles.ctaFinePrint}>
              Or head to your <Link href="/profile">profile</Link> to update your details.
            </div>
          </>
        ) : (
          <>
            <h2 className={`serif ${styles.ctaTitle}`}>Ready to make a difference?</h2>
            <p className={styles.ctaText}>
              Join thousands of neighbors already sharing meals in their community.
            </p>
            <CtaEmailForm />
            <div className={styles.ctaFinePrint}>
              Free forever · No credit card · Built for community
            </div>
          </>
        )}
      </div>
    </section>
  );
}