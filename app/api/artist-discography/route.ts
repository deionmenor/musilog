import { NextRequest, NextResponse } from 'next/server';

const MB_USER_AGENT = 'musilog/1.0 (https://github.com/deionmenor/musilog)';

type ReleaseType = 'album' | 'ep' | 'single' | 'other';

function classifyType(primaryType: string | null, secondaryTypes: string[]): ReleaseType {
  if (!primaryType) return 'other';
  const pt = primaryType.toLowerCase();
  if (pt === 'ep') return 'ep';
  if (pt === 'single') return 'single';
  if (pt === 'album') {
    const secondary = secondaryTypes.map((s) => s.toLowerCase());
    if (secondary.some((s) => ['compilation', 'live', 'remix', 'mixtape/street', 'dj-mix'].includes(s))) {
      return 'other';
    }
    return 'album';
  }
  return 'other';
}

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

  const [albumsRes, artistRes] = await Promise.all([
    fetch(`https://ws.audioscrobbler.com/2.0/?method=artist.getTopAlbums&artist=${encodeURIComponent(artist)}&autocorrect=1&limit=50&api_key=${apiKey}&format=json`),
    fetch(`https://ws.audioscrobbler.com/2.0/?method=artist.getInfo&artist=${encodeURIComponent(artist)}&autocorrect=1&api_key=${apiKey}&format=json`),
  ]);

  if (!albumsRes.ok) return NextResponse.json({ error: 'Failed to fetch from Last.fm' }, { status: albumsRes.status });

  const albumsData = await albumsRes.json();
  if (albumsData.error) return NextResponse.json({ error: albumsData.message || 'Last.fm error' }, { status: 400 });

  const raw: any[] = Array.isArray(albumsData.topalbums?.album) ? albumsData.topalbums.album : [];
  const artistName: string = albumsData.topalbums?.['@attr']?.artist ?? artist;

  // MusicBrainz lookup for release year + type (best-effort)
  const mbReleaseMap = new Map<string, { year: string | null; releaseType: ReleaseType }>();

  try {
    const artistData = artistRes.ok ? await artistRes.json() : null;
    const mbid: string | null = artistData?.artist?.mbid || null;

    if (mbid) {
      const mbRes = await fetch(
        `https://musicbrainz.org/ws/2/release-group?artist=${mbid}&limit=100&fmt=json`,
        { headers: { 'User-Agent': MB_USER_AGENT } }
      );
      if (mbRes.ok) {
        const mbData = await mbRes.json();
        for (const rg of (mbData['release-groups'] ?? [])) {
          const key = rg.title?.toLowerCase().trim();
          if (!key) continue;
          mbReleaseMap.set(key, {
            year: rg['first-release-date']?.slice(0, 4) ?? null,
            releaseType: classifyType(rg['primary-type'] ?? null, rg['secondary-types'] ?? []),
          });
        }
      }
    }
  } catch {
    // MB lookup is best-effort, continue without it
  }

  return NextResponse.json({
    artist: artistName,
    albums: raw
      .filter((a) => a.name && a.name !== '(null)')
      .map((a) => {
        const mb = mbReleaseMap.get(a.name.toLowerCase().trim());
        return {
          name: a.name,
          mbid: a.mbid || null,
          imageUrl: (a.image as any[])?.find((img: any) => img.size === 'medium')?.['#text'] || null,
          year: mb?.year ?? null,
          releaseType: mb?.releaseType ?? 'other' as ReleaseType,
        };
      }),
  });
}
