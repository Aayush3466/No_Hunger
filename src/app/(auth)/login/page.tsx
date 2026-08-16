import { AuthTabs } from '@/components/auth/AuthForms';
import styles from '@/components/ui/ui.module.css';

export const metadata = { title: 'Sign in or create account · NoHunger' };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; email?: string; mode?: string }>;
}) {
  const params = await searchParams;
  const next = params.next?.startsWith('/') && !params.next.startsWith('//') ? params.next : '/map';
  const initialTab = params.mode === 'signup' ? 'signup' : 'signin';

  return (
    <>
      <p className={styles.eyebrow}>Welcome</p>
      <h1 className={`serif ${styles.title}`}>Sign in or create an account</h1>
      <p className={styles.lede}>
        Browsing the map needs no account. Donating and claiming food does.
      </p>
      <AuthTabs next={next} defaultEmail={params.email} initialTab={initialTab} />
    </>
  );
}