import { NextResponse, type NextRequest } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';

/**
 * Landing point for magic links and email confirmations. Exchanges the code for
 * a session, then returns the user to whatever they were doing.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get('code');
  const rawNext = searchParams.get('next') ?? '/map';
  const next = rawNext.startsWith('/') && !rawNext.startsWith('//') ? rawNext : '/map';

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=missing_code`);
  }

  const supabase = await createServerSupabase();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(`${origin}/login?error=expired_link`);
  }

  return NextResponse.redirect(`${origin}${next}`);
}
