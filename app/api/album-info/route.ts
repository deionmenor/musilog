import { NextRequest, NextResponse } from 'next/server';

const MB_USER_AGENT = 'lastfm-charts-tool/1.0 (https://github.com/user/lastfm-tool)';

interface MBResult {
  artUrl: string | null;
  releaseDate: string | null;
}

async function resolveMBData(mbid: string | null, artist: string, album: string): Promise<MBResult> {
  try {
    if (mbid) {
      // We already have the mbid — fetch the release directly for the date
      const res = await fetch(
        `https://musicbrainz.org/ws/2/release/${mbid}?fmt=json`,
        { headers: { 'User-Agent': MB_USER_AGENT } }
      );
      const date = res.ok ? (await res.json()).date ?? null : null;
      return {
        artUrl: `https://coverartarchive.org/release/${mbid}/front-500`,
        releaseDate: date,
      };
    }

    // Search for release by artist + album name
    const res = await fetch(
      `https://musicbrainz.org/ws/2/release/?query=release:"${encodeURIComponent(album)}"+artist:"${encodeURIComponent(artist)}"&fmt=json&limit=1`,
      { headers: { 'User-Agent': MB_USER_AGENT } }
    );
    if (!res.ok) return { artUrl: null, releaseDate: null };

    const data = await res.json();
    const release = data.releases?.[0];
    if (!release) return { artUrl: null, releaseDate: null };

    return {
      artUrl: `https://coverartarchive.org/release/${release.id}/front-500`,
      releaseDate: release.date ?? null,
    };
  } catch {
    return { artUrl: null, releaseDate: null };
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const artist = searchParams.get('artist');
  const album = searchParams.get('album');

  if (!artist || !album) {
    return NextResponse.json({ error: 'Artist and album are required' }, { status: 400 });
  }

  const apiKey = process.env.LASTFM_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'Last.fm API key not configured' }, { status: 500 });
  }

  const res = await fetch(`https://ws.audioscrobbler.com/2.0/?method=album.getInfo&artist=${encodeURIComponent(artist)}&album=${encodeURIComponent(album)}&autocorrect=1&api_key=${apiKey}&format=json`);
  if (!res.ok) return NextResponse.json({ error: 'Failed to fetch from Last.fm' }, { status: res.status });

  const data = await res.json();
  if (data.error) return NextResponse.json({ error: data.message || 'Last.fm error' }, { status: 400 });

  const a = data.album;
  const mbid: string | null = a.mbid || null;

  const [mbData, tracks, tags] = await Promise.all([
    resolveMBData(mbid, artist, album),
    Promise.resolve((() => {
      const rawTracks = a.tracks?.track ?? [];
      const trackList: any[] = Array.isArray(rawTracks) ? rawTracks : [rawTracks];
      return trackList.map((t: any, i: number) => ({
        rank: i + 1,
        name: t.name,
        duration: parseInt(t.duration, 10) || 0,
      }));
    })()),
    Promise.resolve((() => {
      const rawTags = a.tags?.tag ?? [];
      return (Array.isArray(rawTags) ? rawTags : [rawTags]).map((t: any) => t.name as string);
    })()),
  ]);

  const totalDuration = tracks.reduce((sum, t) => sum + t.duration, 0);

  return NextResponse.json({
    artUrl: mbData.artUrl,
    releaseDate: mbData.releaseDate,
    tracks,
    totalDuration,
    listeners: parseInt(a.listeners, 10) || 0,
    playcount: parseInt(a.playcount, 10) || 0,
    tags,
  });
}
