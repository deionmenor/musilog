import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const artist = searchParams.get('artist');
  const track = searchParams.get('track');
  const album = searchParams.get('album');

  if (!artist || !track) {
    return NextResponse.json({ error: 'artist and track are required' }, { status: 400 });
  }

  const params = new URLSearchParams({ artist_name: artist, track_name: track });
  if (album) params.set('album_name', album);

  const res = await fetch(`https://lrclib.net/api/get?${params}`, {
    headers: { 'Lrclib-Client': 'musilog/1.0 (https://github.com/deionmenor/musilog)' },
  });

  if (res.status === 404) return NextResponse.json({ notFound: true });
  if (!res.ok) return NextResponse.json({ error: 'Failed to fetch lyrics' }, { status: res.status });

  const data = await res.json();
  return NextResponse.json({
    plainLyrics: data.plainLyrics ?? null,
    syncedLyrics: data.syncedLyrics ?? null,
    instrumental: data.instrumental ?? false,
  });
}
