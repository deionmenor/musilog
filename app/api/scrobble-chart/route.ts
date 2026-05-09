import { NextRequest, NextResponse } from 'next/server';

const MAX_PAGES = 75; // 15,000 tracks max

async function fetchPage(apiKey: string, username: string, from: number, to: number, page: number) {
  const res = await fetch(
    `https://ws.audioscrobbler.com/2.0/?method=user.getRecentTracks&user=${encodeURIComponent(username)}&from=${from}&to=${to}&limit=200&page=${page}&api_key=${apiKey}&format=json`
  );
  if (!res.ok) throw new Error(`Last.fm ${res.status}`);
  return res.json();
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const username = searchParams.get('username');
  const from = parseInt(searchParams.get('from') ?? '');
  const to = parseInt(searchParams.get('to') ?? '');

  if (!username || isNaN(from) || isNaN(to)) {
    return NextResponse.json({ error: 'username, from, and to are required' }, { status: 400 });
  }

  const apiKey = process.env.LASTFM_API_KEY;
  if (!apiKey) return NextResponse.json({ error: 'API key not configured' }, { status: 500 });

  try {
    const first = await fetchPage(apiKey, username, from, to, 1);
    if (first.error) return NextResponse.json({ error: first.message }, { status: 400 });

    const attr = first.recenttracks?.['@attr'];
    const totalPages = Math.min(parseInt(attr?.totalPages ?? '1', 10), MAX_PAGES);

    let rawTracks: any[] = Array.isArray(first.recenttracks?.track)
      ? first.recenttracks.track
      : first.recenttracks?.track ? [first.recenttracks.track] : [];

    if (totalPages > 1) {
      const rest = await Promise.all(
        Array.from({ length: totalPages - 1 }, (_, i) =>
          fetchPage(apiKey, username, from, to, i + 2).catch(() => null)
        )
      );
      for (const page of rest) {
        if (!page?.recenttracks?.track) continue;
        const tracks = Array.isArray(page.recenttracks.track)
          ? page.recenttracks.track
          : [page.recenttracks.track];
        rawTracks = rawTracks.concat(tracks);
      }
    }

    // Aggregate by day
    const dayCounts: Record<string, number> = {};
    for (const track of rawTracks) {
      if (track['@attr']?.nowplaying) continue;
      const uts = parseInt(track.date?.uts, 10);
      if (!uts) continue;
      const date = new Date(uts * 1000).toISOString().slice(0, 10);
      dayCounts[date] = (dayCounts[date] ?? 0) + 1;
    }

    // Fill every day in the range with 0 if missing
    const days: { date: string; count: number }[] = [];
    const cursor = new Date(from * 1000);
    const end = new Date(to * 1000);
    cursor.setUTCHours(0, 0, 0, 0);
    end.setUTCHours(23, 59, 59, 999);
    while (cursor <= end) {
      const key = cursor.toISOString().slice(0, 10);
      days.push({ date: key, count: dayCounts[key] ?? 0 });
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }

    return NextResponse.json({ days, total: parseInt(attr?.total ?? '0', 10) });
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? 'Failed to fetch scrobble data' }, { status: 500 });
  }
}
