import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const artist = searchParams.get('artist');
  const album = searchParams.get('album');
  const username = searchParams.get('username');

  if (!artist || !album || !username) {
    return NextResponse.json({ error: 'artist, album, and username are required' }, { status: 400 });
  }

  const apiKey = process.env.LASTFM_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'Last.fm API key not configured' }, { status: 500 });
  }

  const res = await fetch(
    `https://ws.audioscrobbler.com/2.0/?method=album.getInfo&artist=${encodeURIComponent(artist)}&album=${encodeURIComponent(album)}&username=${encodeURIComponent(username)}&autocorrect=1&api_key=${apiKey}&format=json`
  );

  if (!res.ok) return NextResponse.json({ userplaycount: 0 });
  const data = await res.json();
  if (data.error) return NextResponse.json({ userplaycount: 0 });

  const userplaycount = parseInt(data.album?.userplaycount, 10) || 0;
  return NextResponse.json({ userplaycount });
}
