import { AuthTabs } from '@/components/auth/AuthForms';
import styles from '@/components/ui/ui.module.css';

export const metadata = { title: 'Create account · NoHunger' };

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; email?: string }>;
}) {
  const params = await searchParams;
  const next = params.next?.startsWith('/') && !params.next.startsWith('//') ? params.next : '/map';

  return (
    <>
      <p className={styles.eyebrow}>Join your neighbourhood</p>
      <h1 className={`serif ${styles.title}`}>Create your account</h1>
      <p className={styles.lede}>
        One account. Give food, receive food, or both. Switch whenever you like.
      </p>
      <AuthTabs next={next} defaultEmail={params.email} initialTab="signup" />
    </>
  );
}