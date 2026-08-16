import { BottomNav } from '@/components/app/BottomNav';
import { Toaster } from '@/components/app/Toaster';
import { TopBar } from '@/components/app/TopBar';
import { getSessionUser } from '@/lib/supabase/server';

/**
 * Shell for every signed-in-or-browsing screen. Grid: header + main + nav.
 * Mobile stacks them; desktop puts the nav as a left rail.
 *
 * Toasts mount inside the shell for signed-in users, so they follow the user
 * across every app screen without being duplicated by the landing page.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();

  return (
    <div className="app-shell">
      <TopBar />
      <main className="app-main">{children}</main>
      <BottomNav />
      {user ? <Toaster userId={user.id} /> : null}
    </div>
  );
}