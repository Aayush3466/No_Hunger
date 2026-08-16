import Link from 'next/link';
import styles from './Landing.module.css';

const COLUMNS = [
  {
    title: 'Product',
    links: [
      { label: 'How it works', href: '#how' },
      { label: 'Live map', href: '/map' },
      { label: 'Community', href: '/signup' },
    ],
  },
  {
    title: 'Company',
    links: [
      { label: 'About', href: '#about' },
      { label: 'Impact', href: '#features' },
      { label: 'Contact', href: 'mailto:hello@nohunger.example' },
    ],
  },
  {
    title: 'Legal',
    links: [
      { label: 'Privacy', href: '/privacy' },
      { label: 'Terms', href: '/terms' },
      { label: 'Safety', href: '/safety' },
    ],
  },
] as const;

export function SiteFooter() {
  return (
    <footer className={styles.footer}>
      <div className={styles.footerGrid}>
        <div>
          <div className={styles.footerBrand}>
            <span className={styles.footerBrandMark} aria-hidden="true">
              ◐
            </span>
            NoHunger
          </div>
          <p className={styles.footerBlurb}>
            A community platform for a world where no meal is wasted and no neighbor goes
            hungry.
          </p>
        </div>
        {COLUMNS.map((column) => (
          <div key={column.title}>
            <div className={styles.footerColTitle}>{column.title}</div>
            <div className={styles.footerLinks}>
              {column.links.map((link) =>
                link.href.startsWith('#') || link.href.startsWith('mailto:') ? (
                  <a key={link.label} href={link.href} className={styles.footerLink}>
                    {link.label}
                  </a>
                ) : (
                  <Link key={link.label} href={link.href} className={styles.footerLink}>
                    {link.label}
                  </Link>
                ),
              )}
            </div>
          </div>
        ))}
      </div>
      <div className={styles.footerBottom}>
        <div>Built for UN SDG 2 — Zero Hunger</div>
        <div>© 2026 NoHunger Collective</div>
      </div>
    </footer>
  );
}