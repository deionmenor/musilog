import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const username = searchParams.get('username');

  if (!username) {
    return NextResponse.json({ error: 'Username is required' }, { status: 400 });
  }

  const apiKey = process.env.LASTFM_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'Last.fm API key not configured' }, { status: 500 });
  }

  const res = await fetch(
    `https://ws.audioscrobbler.com/2.0/?method=user.getInfo&user=${encodeURIComponent(username)}&api_key=${apiKey}&format=json`
  );

  const data = await res.json();
  if (data.error) return NextResponse.json({ error: data.message || 'Last.fm error' }, { status: 400 });

  const u = data.user;
  return NextResponse.json({
    username: u.name,
    realname: u.realname || null,
    scrobbles: parseInt(u.playcount, 10) || 0,
    artists: parseInt(u.artist_count, 10) || 0,
    albums: parseInt(u.album_count, 10) || 0,
    tracks: parseInt(u.track_count, 10) || 0,
    country: (u.country && u.country !== 'None') ? u.country : null,
    registered: parseInt(u.registered?.unixtime, 10) || null,
  });
}
