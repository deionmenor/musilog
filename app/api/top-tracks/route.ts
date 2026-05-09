import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const username = searchParams.get('username');
  const period = searchParams.get('period') || 'overall';
  const from = searchParams.get('from');
  const to = searchParams.get('to');
  const limit = parseInt(searchParams.get('limit') || '10', 10);

  if (!username) {
    return NextResponse.json({ error: 'Username is required' }, { status: 400 });
  }

  const apiKey = process.env.LASTFM_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'Last.fm API key not configured' }, { status: 500 });
  }

  let tracks: { rank: number; name: string; artist: string; playcount: number; url: string }[];

  if (from && to) {
    const url = `https://ws.audioscrobbler.com/2.0/?method=user.getWeeklyTrackChart&user=${encodeURIComponent(username)}&from=${from}&to=${to}&api_key=${apiKey}&format=json`;
    const res = await fetch(url);
    if (!res.ok) return NextResponse.json({ error: 'Failed to fetch from Last.fm' }, { status: res.status });
    const data = await res.json();
    if (data.error) return NextResponse.json({ error: data.message || 'Last.fm error' }, { status: 400 });
    tracks = (data.weeklytrackchart?.track ?? []).slice(0, limit).map((t: any, index: number) => ({
      rank: index + 1,
      name: t.name,
      artist: t.artist?.['#text'] ?? t.artist?.name ?? '',
      playcount: parseInt(t.playcount, 10),
      url: t.url,
    }));
  } else {
    const url = `https://ws.audioscrobbler.com/2.0/?method=user.getTopTracks&user=${encodeURIComponent(username)}&period=${period}&limit=${limit}&api_key=${apiKey}&format=json`;
    const res = await fetch(url);
    if (!res.ok) return NextResponse.json({ error: 'Failed to fetch from Last.fm' }, { status: res.status });
    const data = await res.json();
    if (data.error) return NextResponse.json({ error: data.message || 'Last.fm error' }, { status: 400 });
    tracks = (data.toptracks?.track ?? []).map((t: any, index: number) => ({
      rank: index + 1,
      name: t.name,
      artist: t.artist?.name ?? '',
      playcount: parseInt(t.playcount, 10),
      url: t.url,
    }));
  }

  return NextResponse.json({ tracks, username, period: from && to ? 'custom' : period });
}
