import styles from './Landing.module.css';

export function HowItWorks() {
  return (
    <section id="how" className={styles.how}>
      <div className={styles.howInner}>
        <div className={styles.howHead}>
          <div className={styles.sectionEyebrow}>How it works</div>
          <h2 className={`serif ${styles.howTitle}`}>Three simple steps to zero waste.</h2>
        </div>
        <div className={styles.steps}>
          <svg
            className={styles.stepsConnector}
            viewBox="0 0 800 20"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <path
              d="M0,10 Q200,-10 400,10 T800,10"
              stroke="#4A6741"
              strokeWidth="2"
              fill="none"
              strokeDasharray="2 8"
              opacity=".5"
            />
          </svg>

          <div className={styles.step}>
            <div className={styles.stepRing}>
              <svg
                width="44"
                height="44"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#4A6741"
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            </div>
            <h3 className={`serif ${styles.stepTitle}`}>Sign up as donor or receiver</h3>
            <p className={styles.stepText}>
              Create your profile in under a minute. Switch roles anytime.
            </p>
          </div>

          <div className={styles.step}>
            <div className={`${styles.stepRing} ${styles.stepRingHoney}`}>
              <svg
                width="44"
                height="44"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#C8963E"
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                <circle cx="12" cy="10" r="3" />
              </svg>
            </div>
            <h3 className={`serif ${styles.stepTitle}`}>List your extra food live</h3>
            <p className={styles.stepText}>
              Snap a photo, add portions and a pickup window. It goes straight to the map.
            </p>
          </div>

          <div className={styles.step}>
            <div className={styles.stepRing}>
              <svg
                width="44"
                height="44"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#4A6741"
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
              </svg>
            </div>
            <h3 className={`serif ${styles.stepTitle}`}>Neighbors claim &amp; collect</h3>
            <p className={styles.stepText}>
              A neighbor picks it up in person. No apps for delivery, no middlemen.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
