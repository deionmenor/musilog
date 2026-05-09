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

  function pickImage(images: any[]): string | null {
    if (!Array.isArray(images)) return null;
    const order = ['extralarge', 'large', 'medium', 'small'];
    for (const size of order) {
      const found = images.find((img: any) => img.size === size);
      if (found?.['#text']) return found['#text'];
    }
    return null;
  }

  let albums: { rank: number; name: string; artist: string; playcount: number; url: string; imageUrl: string | null }[];

  if (from && to) {
    const url = `https://ws.audioscrobbler.com/2.0/?method=user.getWeeklyAlbumChart&user=${encodeURIComponent(username)}&from=${from}&to=${to}&api_key=${apiKey}&format=json`;
    const res = await fetch(url);
    if (!res.ok) return NextResponse.json({ error: 'Failed to fetch from Last.fm' }, { status: res.status });
    const data = await res.json();
    if (data.error) return NextResponse.json({ error: data.message || 'Last.fm error' }, { status: 400 });
    albums = (data.weeklyalbumchart?.album ?? []).slice(0, limit).map((a: any, index: number) => ({
      rank: index + 1,
      name: a.name,
      artist: a.artist?.['#text'] ?? a.artist?.name ?? '',
      playcount: parseInt(a.playcount, 10),
      url: a.url,
      imageUrl: pickImage(a.image),
    }));
  } else {
    const url = `https://ws.audioscrobbler.com/2.0/?method=user.getTopAlbums&user=${encodeURIComponent(username)}&period=${period}&limit=${limit}&api_key=${apiKey}&format=json`;
    const res = await fetch(url);
    if (!res.ok) return NextResponse.json({ error: 'Failed to fetch from Last.fm' }, { status: res.status });
    const data = await res.json();
    if (data.error) return NextResponse.json({ error: data.message || 'Last.fm error' }, { status: 400 });
    albums = (data.topalbums?.album ?? []).map((a: any, index: number) => ({
      rank: index + 1,
      name: a.name,
      artist: a.artist?.name ?? '',
      playcount: parseInt(a.playcount, 10),
      url: a.url,
      imageUrl: pickImage(a.image),
    }));
  }

  return NextResponse.json({ albums, username, period: from && to ? 'custom' : period });
}
