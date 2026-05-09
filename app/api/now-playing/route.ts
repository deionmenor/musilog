import { NextRequest, NextResponse } from 'next/server';

function pickImage(images: any[]): string | null {
  if (!Array.isArray(images)) return null;
  for (const size of ['extralarge', 'large', 'medium', 'small']) {
    const found = images.find((img: any) => img.size === size);
    if (found?.['#text']) return found['#text'];
  }
  return null;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const username = searchParams.get('username');

  if (!username) {
    return NextResponse.json({ error: 'Username is required' }, { status: 400 });
  }

  const apiKey = process.env.LASTFM_API_KEY;
  if (!apiKey) return NextResponse.json({ error: 'API key not configured' }, { status: 500 });

  const res = await fetch(
    `https://ws.audioscrobbler.com/2.0/?method=user.getRecentTracks&user=${encodeURIComponent(username)}&limit=1&api_key=${apiKey}&format=json`
  );
  if (!res.ok) return NextResponse.json({ nowPlaying: null });

  const data = await res.json();
  if (data.error) return NextResponse.json({ nowPlaying: null });

  const raw = data.recenttracks?.track;
  const track = Array.isArray(raw) ? raw[0] : raw;
  if (!track || !track['@attr']?.nowplaying) return NextResponse.json({ nowPlaying: null });

  return NextResponse.json({
    nowPlaying: {
      track: track.name ?? '',
      artist: track.artist?.['#text'] ?? track.artist ?? '',
      album: track.album?.['#text'] ?? null,
      imageUrl: pickImage(track.image),
    },
  });
}
