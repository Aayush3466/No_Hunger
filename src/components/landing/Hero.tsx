import Link from 'next/link';
import styles from './Landing.module.css';

/**
 * Ported from the first <section> in NoHunger-Organic.html.
 *
 * The only change: the two primary buttons now point at real routes.
 * "Donate Food" opens the donation form, "Find Food Near You" opens the map.
 */
export function Hero() {
  return (
    <section className={styles.hero}>
      <div className={`blob ${styles.heroBlobA}`} />
      <div className={`blob ${styles.heroBlobB}`} />
      <div className={styles.heroGrid}>
        <div>
          <div className={styles.eyebrow}>
            <span className={styles.eyebrowDot} aria-hidden="true" />
            Farmers-market fresh, neighborhood-wide
          </div>
          <h1 className={`serif ${styles.heroTitle}`}>
            Turn your extra food into someone&apos;s{' '}
            <em className={styles.heroTitleAccent}>next meal.</em>
          </h1>
          <p className={styles.heroLede}>
            NoHunger is a real-time sharing platform that pairs neighbors with extra food with
            people who could use a meal — before anything goes to waste.
          </p>
          <div className={styles.heroActions}>
            <Link href="/donate" className="btn btn-primary">
              Donate Food →
            </Link>
            <Link href="/map" className="btn btn-outline">
              Find Food Near You
            </Link>
          </div>
          <div className={styles.heroStats}>
            <div>
              <div className={`serif ${styles.heroStatValue}`}>2.3B</div>
              <div className={styles.heroStatLabel}>meals wasted daily</div>
            </div>
            <div>
              <div className={`serif ${styles.heroStatValue}`}>828M</div>
              <div className={styles.heroStatLabel}>people hungry</div>
            </div>
            <div>
              <div className={`serif ${styles.heroStatValue}`}>10K+</div>
              <div className={styles.heroStatLabel}>community shares</div>
            </div>
          </div>
        </div>

        <div className={styles.heroArt}>
          <div className={styles.heroArtCanvas}>
            <svg viewBox="0 0 400 420" className={styles.heroArtSvg} aria-hidden="true">
              <defs>
                <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                  <path d="M40 0H0V40" fill="none" stroke="rgba(74,103,65,.12)" strokeWidth="1" />
                </pattern>
              </defs>
              <rect width="400" height="420" fill="#F0EAD6" />
              <rect width="400" height="420" fill="url(#grid)" />
              <path
                d="M-20,140 Q100,80 200,160 T440,120"
                fill="none"
                stroke="#A8BFA0"
                strokeWidth="6"
                opacity=".6"
              />
              <path
                d="M-20,280 Q120,220 240,300 T440,280"
                fill="none"
                stroke="#C8963E"
                strokeWidth="4"
                opacity=".35"
                strokeDasharray="8 8"
              />
              <circle cx="120" cy="130" r="18" fill="#4A6741" opacity=".18" />
              <circle cx="120" cy="130" r="9" fill="#4A6741" />
              <circle cx="260" cy="90" r="18" fill="#C8963E" opacity=".18" />
              <circle cx="260" cy="90" r="9" fill="#C8963E" />
              <circle cx="310" cy="220" r="22" fill="#4A6741" opacity=".18" />
              <circle cx="310" cy="220" r="11" fill="#4A6741" />
              <circle cx="90" cy="290" r="18" fill="#C8963E" opacity=".18" />
              <circle cx="90" cy="290" r="9" fill="#C8963E" />
            </svg>
          </div>
          <div className={styles.heroCard}>
            <div className={styles.heroCardThumb} aria-hidden="true">
              🍲
            </div>
            <div className={styles.heroCardBody}>
              <div className={styles.heroCardTitle}>Dal &amp; Rice</div>
              <div className={styles.heroCardMeta}>0.3 km away · 5m ago · serves 4</div>
            </div>
            <Link href="/map" className={`btn btn-primary ${styles.heroCardBtn}`}>
              Get
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
