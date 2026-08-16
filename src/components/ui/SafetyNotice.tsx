import styles from './ui.module.css';

/**
 * Shown at donation time and again at pickup. Short on purpose: a wall of text
 * gets skipped, and these four lines are the ones that matter.
 */
export function SafetyNotice({ variant = 'donor' }: { variant?: 'donor' | 'receiver' }) {
  return (
    <section className={styles.notice} aria-labelledby="safe-sharing">
      <h2 id="safe-sharing" className={styles.noticeTitle}>
        Sharing food safely
      </h2>
      {variant === 'donor' ? (
        <ul className={styles.noticeList}>
          <li>Keep hot food hot and cold food cold right up to handover.</li>
          <li>Say when it was made. If you would not eat it now, do not list it.</li>
          <li>No food that has already been reheated more than once.</li>
          <li>Name every allergen you know of, even the obvious ones.</li>
        </ul>
      ) : (
        <ul className={styles.noticeList}>
          <li>Check the prep time and allergen note before you travel.</li>
          <li>Meet at the pickup point, and refrigerate or eat it soon after.</li>
          <li>Ask the donor anything you are unsure about before collecting.</li>
          <li>If something looks off, do not take it. Report the listing instead.</li>
        </ul>
      )}
    </section>
  );
}
