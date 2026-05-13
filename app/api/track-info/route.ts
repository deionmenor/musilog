import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const artist = searchParams.get('artist');
  const track = searchParams.get('track');

  if (!artist || !track) {
    return NextResponse.json({ error: 'Artist and track are required' }, { status: 400 });
  }

  const apiKey = process.env.LASTFM_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'Last.fm API key not configured' }, { status: 500 });
  }

  const res = await fetch(
    `https://ws.audioscrobbler.com/2.0/?method=track.getInfo&artist=${encodeURIComponent(artist)}&track=${encodeURIComponent(track)}&autocorrect=1&api_key=${apiKey}&format=json`
  );

  if (!res.ok) return NextResponse.json({ error: 'Failed to fetch from Last.fm' }, { status: res.status });

  const data = await res.json();
  if (data.error) return NextResponse.json({ error: data.message || 'Last.fm error' }, { status: 400 });

  const t = data.track;
  const rawSummary: string = t.wiki?.summary ?? '';
  const summary = rawSummary.replace(/<a\b[^>]*>.*?<\/a>/gi, '').replace(/<[^>]+>/g, '').trim() || null;

  return NextResponse.json({
    listeners: parseInt(t.listeners, 10) || 0,
    playcount: parseInt(t.playcount, 10) || 0,
    url: t.url ?? null,
    summary,
    album: t.album ? { name: t.album.title, artist: t.album.artist, url: t.album.url } : null,
  });
}
