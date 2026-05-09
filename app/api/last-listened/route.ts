import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const username = searchParams.get('username');
  const album = searchParams.get('album');

  if (!username || !album) {
    return NextResponse.json({ error: 'username and album are required' }, { status: 400 });
  }

  const apiKey = process.env.LASTFM_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'Last.fm API key not configured' }, { status: 500 });
  }

  const res = await fetch(`https://ws.audioscrobbler.com/2.0/?method=user.getRecentTracks&user=${encodeURIComponent(username)}&limit=200&api_key=${apiKey}&format=json`);
  if (!res.ok) return NextResponse.json({ lastListened: null });

  const data = await res.json();
  const rawTracks = data.recenttracks?.track ?? [];
  const tracks: any[] = Array.isArray(rawTracks) ? rawTracks : [rawTracks];
  const albumLower = album.toLowerCase();
  const match = tracks.find(
    (t: any) => !t['@attr']?.nowplaying && (t.album?.['#text'] ?? '').toLowerCase() === albumLower
  );

  return NextResponse.json({ lastListened: match?.date?.uts ? parseInt(match.date.uts, 10) : null });
}
