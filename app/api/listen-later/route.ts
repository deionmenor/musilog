import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import db from '@/lib/db';

async function getSession() {
  const cookieStore = await cookies();
  const raw = cookieStore.get('lastfm_session');
  if (!raw) return null;
  try {
    return JSON.parse(raw.value) as { key: string; username: string };
  } catch {
    return null;
  }
}

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Not logged in' }, { status: 401 });

  const items = db
    .prepare('SELECT artist, album, added_at FROM listen_later WHERE provider = ? AND user_id = ? ORDER BY added_at DESC')
    .all('lastfm', session.username);

  return NextResponse.json({ items });
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Not logged in' }, { status: 401 });

  const { artist, album } = await request.json() as { artist: string; album: string };
  if (!artist || !album) return NextResponse.json({ error: 'artist and album required' }, { status: 400 });

  db.prepare('INSERT OR IGNORE INTO listen_later (provider, user_id, artist, album) VALUES (?, ?, ?, ?)')
    .run('lastfm', session.username, artist, album);

  return NextResponse.json({ success: true });
}

export async function DELETE(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Not logged in' }, { status: 401 });

  const { artist, album } = await request.json() as { artist: string; album: string };

  db.prepare('DELETE FROM listen_later WHERE provider = ? AND user_id = ? AND artist = ? AND album = ?')
    .run('lastfm', session.username, artist, album);

  return NextResponse.json({ success: true });
}
