import styles from './Landing.module.css';

export function StatsBand() {
  return (
    <section id="about" className={styles.band}>      <div className={styles.bandGrid}>
        <div>
          <div className={`serif ${styles.bandValue}`}>2.3B</div>
          <div className={styles.bandLabel}>meals wasted daily worldwide</div>
        </div>
        <div className={styles.bandCellDivided}>
          <div className={`serif ${styles.bandValue}`}>828M</div>
          <div className={styles.bandLabel}>people go hungry each night</div>
        </div>
        <div>
          <div className={`serif ${styles.bandValue}`}>10,000+</div>
          <div className={styles.bandLabel}>community food shares this month</div>
        </div>
      </div>
    </section>
  );
}
