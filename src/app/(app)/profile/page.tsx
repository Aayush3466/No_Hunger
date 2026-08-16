import { redirect } from 'next/navigation';
import { Avatar } from '@/components/ui/Avatar';
import { ProfileEditForm } from '@/components/profile/ProfileEditForm';
import { PushNotifications } from '@/components/profile/PushNotifications';
import { createServerSupabase } from '@/lib/supabase/server';
import { formatRating } from '@/lib/format';
import styles from '@/components/ui/ui.module.css';

export const metadata = { title: 'Account · NoHunger' };

export default async function ProfilePage() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/profile');

  const [{ data: profile }, { data: stats }] = await Promise.all([
    supabase
      .from('profiles')
      .select('full_name, avatar_url, usual_donation_times, bio, phone')
      .eq('id', user.id)
      .maybeSingle(),
    supabase.from('profile_stats').select('*').eq('user_id', user.id).maybeSingle(),
  ]);

  const name = profile?.full_name || 'You';

  return (
    <main className={styles.screen}>
      <p className={styles.eyebrow}>Account</p>
      <h1 className={`serif ${styles.title}`}>{name}</h1>
      <p className={styles.lede}>{user.email}</p>

      <div className={styles.stack}>
        <section className={styles.card}>
          <div className={styles.row}>
            <Avatar name={name} url={profile?.avatar_url} size={48} />
            <div className={styles.grow}>
              <h2 className={`serif ${styles.cardTitle}`}>As a donor</h2>
              <p className={styles.cardMeta}>
                {stats?.donor_donations_count ?? 0} listings ·{' '}
                {stats?.donor_servings_total ?? 0} servings shared ·{' '}
                {formatRating(stats?.donor_avg_rating, stats?.donor_ratings_count)}
              </p>
            </div>
          </div>
          {profile?.usual_donation_times ? (
            <p className={styles.cardBody} style={{ marginTop: '.75rem' }}>
              Usually shares: {profile.usual_donation_times}
            </p>
          ) : null}
        </section>

        <section className={styles.card}>
          <h2 className={`serif ${styles.cardTitle}`}>As a receiver</h2>
          <p className={styles.cardMeta}>
            {stats?.receiver_receipts_count ?? 0} collections ·{' '}
            {stats?.receiver_servings_total ?? 0} servings received ·{' '}
            {formatRating(stats?.receiver_avg_rating, stats?.receiver_ratings_count)}
          </p>
        </section>

        <section className={styles.card}>
          <h2 className={`serif ${styles.cardTitle}`}>Push notifications</h2>
          <p className={styles.cardMeta} style={{ marginBottom: '.75rem' }}>
            Even when NoHunger is closed.
          </p>
          <PushNotifications />
        </section>

        <section className={styles.card}>
          <h2 className={`serif ${styles.cardTitle}`}>Edit your profile</h2>
          <p className={styles.cardMeta} style={{ marginBottom: '.75rem' }}>
            Update your name, phone or bio. Changes take effect immediately.
          </p>
          <ProfileEditForm
            initial={{
              full_name: profile?.full_name ?? '',
              phone: profile?.phone ?? '',
              usual_donation_times: profile?.usual_donation_times ?? '',
              bio: profile?.bio ?? '',
            }}
          />
        </section>

        <form action="/auth/signout" method="post">
          <button type="submit" className="btn btn-outline btn-block">
            Sign out
          </button>
        </form>
      </div>
    </main>
  );
}