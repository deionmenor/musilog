import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { signParams } from '@/lib/lastfm-sign';

export async function POST(request: NextRequest) {
  const cookieStore = await cookies();
  const session = cookieStore.get('lastfm_session');
  if (!session) return NextResponse.json({ error: 'Not logged in' }, { status: 401 });

  const { key: sk } = JSON.parse(session.value) as { key: string; username: string };
  const { artist, track, album } = await request.json() as { artist: string; track: string; album?: string };

  const apiKey = process.env.LASTFM_API_KEY!;
  const secret = process.env.LASTFM_SHARED_SECRET!;

  const params: Record<string, string> = { api_key: apiKey, artist, method: 'track.updateNowPlaying', sk, track };
  if (album) params.album = album;
  const api_sig = signParams(params, secret);

  const body = new URLSearchParams({ ...params, api_sig, format: 'json' });
  const res = await fetch('https://ws.audioscrobbler.com/2.0/', { method: 'POST', body });
  const raw = await res.json();
  const data = typeof raw === 'string' ? JSON.parse(raw) : raw;

  if (data.error) return NextResponse.json({ error: data.message }, { status: 400 });
  return NextResponse.json({ success: true });
}
