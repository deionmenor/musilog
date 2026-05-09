import { NextRequest, NextResponse } from 'next/server';
import { GetListByKeyword } from 'youtube-search-api';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const artist = searchParams.get('artist');
  const track = searchParams.get('track');

  if (!artist || !track) {
    return NextResponse.json({ error: 'artist and track are required' }, { status: 400 });
  }

  try {
    const results = await GetListByKeyword(`${artist} ${track}`, false, 1);
    const id = results?.items?.[0]?.id;
    if (!id) return NextResponse.json({ error: 'No results found' }, { status: 404 });
    return NextResponse.json({ videoId: id, url: `https://www.youtube.com/watch?v=${id}` });
  } catch {
    return NextResponse.json({ error: 'YouTube search failed' }, { status: 500 });
  }
}
