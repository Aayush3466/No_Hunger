import { redirect } from 'next/navigation';
import { DonateForm } from '@/components/donate/DonateForm';
import { createServerSupabase } from '@/lib/supabase/server';
import styles from '@/components/ui/ui.module.css';

export const metadata = {
  title: 'Share food · NoHunger',
  description: 'Post surplus food so a neighbour can claim it before it goes to waste.',
};

export default async function DonatePage() {
  // Middleware already redirected an anonymous visitor. This is the second
  // check, server-side, because middleware alone is not an authorisation model.
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/donate');

  const { data: profile } = await supabase
    .from('profiles')
    .select('onboarded_at')
    .eq('id', user.id)
    .maybeSingle();
  if (!profile?.onboarded_at) redirect('/onboarding?next=/donate');

  return (
    <main className={styles.screen}>
      <p className={styles.eyebrow}>Share what you have</p>
      <h1 className={`serif ${styles.title}`}>Post extra food</h1>
      <p className={styles.lede}>
        One photo, how many it feeds, and when it stops being good. It is on the map the moment you
        post.
      </p>
      <DonateForm />
    </main>
  );
}
