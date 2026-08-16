import styles from '@/components/ui/ui.module.css';

export const metadata = { title: 'Privacy · NoHunger' };

export default function PrivacyPage() {
  return (
    <>
      <p className={styles.eyebrow}>Your data</p>
      <h1 className={`serif ${styles.title}`}>Privacy</h1>
      <p className={styles.lede}>
        Short version: we hold the least we can, and the sensitive parts expire on their own.
      </p>
      <div className={styles.stack}>
        <section className={styles.card}>
          <h2 className={`serif ${styles.cardTitle}`}>What we store</h2>
          <p className={styles.cardBody}>
            Your name, email, optional avatar and phone number. For each listing: the food details,
            a pickup point, and one photo. For each claim: how many servings and, for delivery, a
            dropoff point you chose.
          </p>
        </section>
        <section className={styles.card}>
          <h2 className={`serif ${styles.cardTitle}`}>Your phone number</h2>
          <p className={styles.cardBody}>
            Never public. It is readable only by the one person you are matched with, only while
            that handover is active, and only through a guarded database function. When the order
            completes or cancels, that access stops. It is enforced in the database, not in the app.
          </p>
        </section>
        <section className={styles.card}>
          <h2 className={`serif ${styles.cardTitle}`}>Photos and location</h2>
          <p className={styles.cardBody}>
            Photos are re-encoded in your browser before upload, which strips EXIF and GPS data, so
            the original never leaves your device. The photo is deleted when the listing ends. Live
            location is shared only during an active handover and is deleted when it finishes.
          </p>
        </section>
        <section className={styles.card}>
          <h2 className={`serif ${styles.cardTitle}`}>Deleting your account</h2>
          <p className={styles.cardBody}>
            Write to the contact address in the footer. Removing your account removes your profile,
            listings, requests and ratings.
          </p>
        </section>
      </div>
    </>
  );
}