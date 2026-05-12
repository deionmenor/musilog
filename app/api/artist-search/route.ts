import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q');
  if (!q) return NextResponse.json({ error: 'Query required' }, { status: 400 });

  const apiKey = process.env.LASTFM_API_KEY;
  if (!apiKey) return NextResponse.json({ error: 'API key not configured' }, { status: 500 });

  const res = await fetch(
    `https://ws.audioscrobbler.com/2.0/?method=artist.search&artist=${encodeURIComponent(q)}&limit=8&api_key=${apiKey}&format=json`
  );
  if (!res.ok) return NextResponse.json({ error: 'Search failed' }, { status: res.status });

  const data = await res.json();
  const raw: any[] = data.results?.artistmatches?.artist ?? [];

  return NextResponse.json({
    artists: raw.map((a) => ({
      name: a.name,
      listeners: parseInt(a.listeners, 10) || 0,
      imageUrl: (a.image as any[])?.find((img) => img.size === 'large')?.['#text'] || null,
    })),
  });
}
