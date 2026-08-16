import styles from './Landing.module.css';

const FEATURES = [
  {
    tone: 'green',
    title: 'Live Map',
    body: 'See fresh listings pop up around you in real time — no refresh needed.',
    icon: (
      <>
        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
        <circle cx="12" cy="10" r="3" />
      </>
    ),
  },
  {
    tone: 'honey',
    title: 'Time-aware freshness',
    body: 'Each listing tracks how long ago it was made, with visual freshness signals.',
    icon: (
      <>
        <circle cx="12" cy="12" r="10" />
        <path d="M12 6v6l4 2" />
      </>
    ),
  },
  {
    tone: 'green',
    title: 'Portion control',
    body: 'Claim only what you need — the rest stays available for the next neighbor.',
    icon: (
      <>
        <rect x="3" y="3" width="18" height="18" rx="4" />
        <path d="M9 12h6M12 9v6" />
      </>
    ),
  },
  {
    tone: 'honey',
    title: 'Zero waste auto-removal',
    body: 'Expired listings drop off automatically. Nothing lingers, nothing forgotten.',
    icon: (
      <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
    ),
  },
] as const;

export function Features() {
  return (
    <section id="features" className={styles.features}>
      <div className={`blob ${styles.featuresBlob}`} />
      <div className={styles.featuresInner}>
        <div className={styles.featuresHead}>
          <div className={styles.sectionEyebrow}>What&apos;s inside</div>
          <h2 className={`serif ${styles.featuresTitle}`}>
            Thoughtful features, built around real neighborhoods.
          </h2>
        </div>
        <div className={styles.featureGrid}>
          {FEATURES.map((feature) => (
            <article key={feature.title} className={styles.featureCard}>
              <div
                className={
                  feature.tone === 'honey'
                    ? `${styles.featureIcon} ${styles.featureIconHoney}`
                    : styles.featureIcon
                }
              >
                <svg
                  width="26"
                  height="26"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#F5F0E6"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  {feature.icon}
                </svg>
              </div>
              <h3 className={`serif ${styles.featureTitle}`}>{feature.title}</h3>
              <p className={styles.featureText}>{feature.body}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
