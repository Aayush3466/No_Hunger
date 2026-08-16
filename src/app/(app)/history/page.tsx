import { redirect } from 'next/navigation';
import { HistoryClient } from '@/components/history/HistoryClient';
import { getSessionUser } from '@/lib/supabase/server';
import styles from '@/components/ui/ui.module.css';

export const metadata = { title: 'History · NoHunger' };

export default async function HistoryPage() {
  const user = await getSessionUser();
  if (!user) redirect('/login?next=/history');

  return (
    <main className={styles.screen}>
      <p className={styles.eyebrow}>Your record</p>
      <h1 className={`serif ${styles.title}`}>History</h1>
      <p className={styles.lede}>
        Every completed handover, on both sides, with the ratings you exchanged.
      </p>
      <HistoryClient userId={user.id} />
    </main>
  );
}