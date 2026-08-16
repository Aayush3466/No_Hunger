import styles from '@/components/ui/ui.module.css';

export const metadata = { title: 'Terms · NoHunger' };

export default function TermsPage() {
  return (
    <>
      <p className={styles.eyebrow}>The deal</p>
      <h1 className={`serif ${styles.title}`}>Terms</h1>
      <p className={styles.lede}>
        NoHunger introduces neighbours to each other. It does not handle, store, inspect or
        transport any food.
      </p>
      <div className={styles.stack}>
        <section className={styles.card}>
          <h2 className={`serif ${styles.cardTitle}`}>What you agree to</h2>
          <p className={styles.cardBody}>
            List only food you would eat yourself. Describe it honestly, including allergens and
            when it was made. Show up when you say you will, and cancel promptly if you cannot, so
            the servings go back on the map for someone else.
          </p>
        </section>
        <section className={styles.card}>
          <h2 className={`serif ${styles.cardTitle}`}>No money changes hands</h2>
          <p className={styles.cardBody}>
            Food here is given, not sold. Asking for payment, or using the platform to advertise,
            gets the account removed.
          </p>
        </section>
        <section className={styles.card}>
          <h2 className={`serif ${styles.cardTitle}`}>Liability</h2>
          <p className={styles.cardBody}>
            The person who prepared the food is responsible for it. The person who accepts it does
            so at their own risk. NoHunger provides the introduction and nothing more.
          </p>
        </section>
        <section className={styles.card}>
          <h2 className={`serif ${styles.cardTitle}`}>Removal</h2>
          <p className={styles.cardBody}>
            Unsafe food, dishonest listings, harassment or repeated no-shows end an account.
          </p>
        </section>
      </div>
    </>
  );
}