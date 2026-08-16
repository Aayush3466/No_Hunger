import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ActiveOrder } from '@/components/orders/ActiveOrder';
import { getSessionUser } from '@/lib/supabase/server';
import styles from '@/components/ui/ui.module.css';

export const metadata = { title: 'Active order · NoHunger' };

export default async function ActiveOrderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getSessionUser();
  if (!user) redirect(`/login?next=/orders/${id}`);

  // The database is the security boundary. get_order_details() returns NULL if
  // the caller isn't a party to this order, so ActiveOrder renders the
  // "order has ended" empty state and never leaks anything.

  return (
    <main className={styles.screen}>
      <p className={styles.eyebrow}>
        <Link href="/orders">← All orders</Link>
      </p>
      <h1 className={`serif ${styles.title}`}>Active order</h1>
      <p className={styles.lede}>
        Live details while the handover is in progress. Contact info stays visible only until the
        handover is confirmed or the order is cancelled.
      </p>
      <ActiveOrder requestId={id} />
    </main>
  );
}