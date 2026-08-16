import { redirect } from 'next/navigation';
import { OnboardingForm } from '@/components/auth/OnboardingForm';
import { createServerSupabase } from '@/lib/supabase/server';
import styles from '@/components/ui/ui.module.css';

export const metadata = { title: 'Set up your profile · NoHunger' };

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const params = await searchParams;
  const next = params.next?.startsWith('/') && !params.next.startsWith('//') ? params.next : '/map';

  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/onboarding?next=${next}`)}`);

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, onboarded_at')
    .eq('id', user.id)
    .maybeSingle();

  if (profile?.onboarded_at) redirect(next);

  return (
    <>
      <p className={styles.eyebrow}>Almost there</p>
      <h1 className={`serif ${styles.title}`}>Set up your profile</h1>
      <p className={styles.lede}>
        Two of these are required, the rest help neighbours trust you faster.
      </p>
      <OnboardingForm next={next} defaultName={profile?.full_name} />
    </>
  );
}
