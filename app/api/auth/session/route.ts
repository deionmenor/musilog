import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function GET() {
  const cookieStore = await cookies();
  const session = cookieStore.get('lastfm_session');

  if (!session) {
    return NextResponse.json({ loggedIn: false, username: null });
  }

  try {
    const { username } = JSON.parse(session.value) as { key: string; username: string };
    return NextResponse.json({ loggedIn: true, username });
  } catch {
    return NextResponse.json({ loggedIn: false, username: null });
  }
}
