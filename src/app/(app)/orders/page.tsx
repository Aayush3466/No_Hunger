import { redirect } from 'next/navigation';
import { OrdersClient } from '@/components/orders/OrdersClient';
import { getSessionUser } from '@/lib/supabase/server';
import styles from '@/components/ui/ui.module.css';

export const metadata = { title: 'Orders · NoHunger' };

export default async function OrdersPage() {
  const user = await getSessionUser();
  if (!user) redirect('/login?next=/orders');

  return (
    <main className={styles.screen}>
      <p className={styles.eyebrow}>Live</p>
      <h1 className={`serif ${styles.title}`}>Orders</h1>
      <p className={styles.lede}>
        Requests waiting on your answer, and the food you have claimed from neighbours.
      </p>
      <OrdersClient />
    </main>
  );
}
