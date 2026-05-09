import { NextRequest, NextResponse } from 'next/server';
import Jimp from 'jimp';

const UA = 'lastfm-charts-tool/1.0 (https://github.com/user/lastfm-tool)';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const artUrl = searchParams.get('artUrl');
  if (!artUrl) return NextResponse.json({ error: 'artUrl required' }, { status: 400 });

  try {
    const imgRes = await fetch(artUrl, { headers: { 'User-Agent': UA }, redirect: 'follow' });
    if (!imgRes.ok) {
      return NextResponse.json({ error: `Image fetch failed: ${imgRes.status}` }, { status: 400 });
    }

    const buffer = Buffer.from(await imgRes.arrayBuffer());
    const image = await Jimp.read(buffer);
    image.resize(16, 16);

    const pixels: string[] = [];
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        const { r, g, b } = Jimp.intToRGBA(image.getPixelColor(x, y));
        pixels.push(`#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`);
      }
    }

    return NextResponse.json({ pixels });
  } catch (e) {
    console.error('[pixel-art]', e);
    return NextResponse.json({ error: 'Failed to process image' }, { status: 500 });
  }
}
