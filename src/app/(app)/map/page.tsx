import { MapBrowse } from '@/components/map/MapBrowse';
import { getSessionUser } from '@/lib/supabase/server';

export const metadata = {
  title: 'Food near you · NoHunger',
  description: 'Live map of surplus food shared by neighbours nearby.',
};

/**
 * Browsing is open to everyone. `isAuthenticated` only changes what the request
 * button does; the listings themselves come from the same public read path.
 */
export default async function MapPage() {
  const user = await getSessionUser();
  return <MapBrowse isAuthenticated={Boolean(user)} />;
}
