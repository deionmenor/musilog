import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const artist = searchParams.get('artist');

  if (!artist) {
    return NextResponse.json({ error: 'artist is required' }, { status: 400 });
  }

  const apiKey = process.env.LASTFM_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'Last.fm API key not configured' }, { status: 500 });
  }

  const res = await fetch(
    `https://ws.audioscrobbler.com/2.0/?method=artist.getTopAlbums&artist=${encodeURIComponent(artist)}&autocorrect=1&limit=50&api_key=${apiKey}&format=json`
  );

  if (!res.ok) return NextResponse.json({ error: 'Failed to fetch from Last.fm' }, { status: res.status });

  const data = await res.json();
  if (data.error) return NextResponse.json({ error: data.message || 'Last.fm error' }, { status: 400 });

  const raw: any[] = Array.isArray(data.topalbums?.album) ? data.topalbums.album : [];
  const artistName: string = data.topalbums?.['@attr']?.artist ?? artist;

  return NextResponse.json({
    artist: artistName,
    albums: raw
      .filter((a) => a.name && a.name !== '(null)')
      .map((a) => ({
        name: a.name,
        mbid: a.mbid || null,
        imageUrl: (a.image as any[])?.find((img: any) => img.size === 'medium')?.['#text'] || null,
      })),
  });
}
