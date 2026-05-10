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

async function mbFetch(url: string) {
  return fetch(url, { headers: { 'User-Agent': MB_USER_AGENT } });
}

// If Last.fm doesn't provide an MBID, search MusicBrainz by artist name
async function resolveMBArtistId(lastfmMbid: string | null, artistName: string): Promise<string | null> {
  if (lastfmMbid) return lastfmMbid;
  const res = await mbFetch(
    `https://musicbrainz.org/ws/2/artist?query=artist:${encodeURIComponent(artistName)}&limit=1&fmt=json`
  );
  if (!res.ok) return null;
  const data = await res.json();
  return data.artists?.[0]?.id ?? null;
}

// Paginate through all release groups for an artist
async function fetchAllReleaseGroups(mbid: string): Promise<Map<string, { year: string | null; releaseType: ReleaseType }>> {
  const map = new Map<string, { year: string | null; releaseType: ReleaseType }>();
  const limit = 100;
  let offset = 0;
  let total = Infinity;

  while (offset < total) {
    const res = await mbFetch(
      `https://musicbrainz.org/ws/2/release-group?artist=${mbid}&limit=${limit}&offset=${offset}&fmt=json`
    );
    if (!res.ok) break;
    const data = await res.json();
    const groups: any[] = data['release-groups'] ?? [];
    total = data['release-group-count'] ?? 0;

    const priority: Record<ReleaseType, number> = { album: 3, ep: 2, single: 1, other: 0 };
    for (const rg of groups) {
      const key = rg.title?.toLowerCase().trim();
      if (!key) continue;
      const releaseType = classifyType(rg['primary-type'] ?? null, rg['secondary-types'] ?? []);
      const existing = map.get(key);
      if (existing && priority[existing.releaseType] >= priority[releaseType]) continue;
      map.set(key, {
        year: rg['first-release-date']?.slice(0, 4) ?? null,
        releaseType,
      });
    }

    offset += groups.length;
    if (groups.length === 0) break;
  }

  return map;
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
    const lastfmMbid: string | null = artistData?.artist?.mbid || null;
    const mbid = await resolveMBArtistId(lastfmMbid, artistName);

    if (mbid) {
      const releaseGroups = await fetchAllReleaseGroups(mbid);
      releaseGroups.forEach((value, key) => mbReleaseMap.set(key, value));
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
          releaseType: mb?.releaseType ?? ('other' as ReleaseType),
        };
      }),
  });
}
