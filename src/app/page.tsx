import { CtaSection } from '@/components/landing/CtaSection';
import { Features } from '@/components/landing/Features';
import { Hero } from '@/components/landing/Hero';
import { HowItWorks } from '@/components/landing/HowItWorks';
import { SiteFooter } from '@/components/landing/SiteFooter';
import { SiteHeader } from '@/components/landing/SiteHeader';
import { StatsBand } from '@/components/landing/StatsBand';
import styles from '@/components/landing/Landing.module.css';

/**
 * NoHunger-Organic.html, section for section, in the original order.
 * Server-rendered: no client JavaScript ships for anything except the CTA form.
 */
export default function LandingPage() {
  return (
    <div className={styles.page}>
      <SiteHeader />
      <Hero />
      <StatsBand />
      <HowItWorks />
      <Features />
      <CtaSection />
      <SiteFooter />
    </div>
  );
}
