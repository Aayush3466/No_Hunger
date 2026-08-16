import { SafetyNotice } from '@/components/ui/SafetyNotice';
import styles from '@/components/ui/ui.module.css';

export const metadata = { title: 'Safety · NoHunger' };

export default function SafetyPage() {
  return (
    <>
      <p className={styles.eyebrow}>Sharing food</p>
      <h1 className={`serif ${styles.title}`}>Safety</h1>
      <p className={styles.lede}>
        Food shared here goes straight from one neighbour to another, with nobody inspecting it in
        between. These are the rules that keep that safe.
      </p>
      <div className={styles.stack}>
        <SafetyNotice variant="donor" />
        <SafetyNotice variant="receiver" />
        <section className={styles.card}>
          <h2 className={`serif ${styles.cardTitle}`}>Meeting people</h2>
          <p className={styles.cardBody}>
            Phone numbers are shared only between two matched people, only while a handover is
            live, and access is revoked the moment it completes. Meet somewhere you are comfortable.
            Either side can cancel at any point, and either side can report or block the other.
          </p>
        </section>
        <section className={styles.card}>
          <h2 className={`serif ${styles.cardTitle}`}>If something goes wrong</h2>
          <p className={styles.cardBody}>
            Do not eat anything that looks or smells off. Report the listing, block the person, and
            tell us at the contact address in the footer. Anything involving illness or a threat to
            someone&apos;s safety is a matter for local authorities first, and us second.
          </p>
        </section>
      </div>
    </>
  );
}