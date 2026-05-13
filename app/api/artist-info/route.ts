import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const artist = searchParams.get('artist');

  if (!artist) {
    return NextResponse.json({ error: 'Artist is required' }, { status: 400 });
  }

  const apiKey = process.env.LASTFM_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'Last.fm API key not configured' }, { status: 500 });
  }

  const [infoRes, tracksRes] = await Promise.all([
    fetch(`https://ws.audioscrobbler.com/2.0/?method=artist.getInfo&artist=${encodeURIComponent(artist)}&autocorrect=1&api_key=${apiKey}&format=json`),
    fetch(`https://ws.audioscrobbler.com/2.0/?method=artist.getTopTracks&artist=${encodeURIComponent(artist)}&autocorrect=1&limit=5&api_key=${apiKey}&format=json`),
  ]);

  if (!infoRes.ok) return NextResponse.json({ error: 'Failed to fetch from Last.fm' }, { status: infoRes.status });

  const infoData = await infoRes.json();
  if (infoData.error) return NextResponse.json({ error: infoData.message || 'Last.fm error' }, { status: 400 });

  const a = infoData.artist;
  const rawSummary: string = a.bio?.summary ?? '';
  const summary = rawSummary.replace(/<a\b[^>]*>.*?<\/a>/gi, '').replace(/<[^>]+>/g, '').trim() || null;

  let topTracks: { rank: number; name: string; playcount: number; url: string }[] = [];
  if (tracksRes.ok) {
    const tracksData = await tracksRes.json();
    const raw = tracksData.toptracks?.track ?? [];
    const list = Array.isArray(raw) ? raw : [raw];
    topTracks = list.map((t: any, i: number) => ({
      rank: i + 1,
      name: t.name,
      playcount: parseInt(t.playcount, 10) || 0,
      url: t.url ?? null,
    }));
  }

  return NextResponse.json({
    name: a.name,
    url: a.url ?? null,
    listeners: parseInt(a.stats?.listeners, 10) || 0,
    playcount: parseInt(a.stats?.playcount, 10) || 0,
    summary,
    topTracks,
  });
}
