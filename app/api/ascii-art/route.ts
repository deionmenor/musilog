import { NextRequest, NextResponse } from 'next/server';
import Jimp from 'jimp';

const UA = 'lastfm-charts-tool/1.0 (https://github.com/user/lastfm-tool)';

const RAMPS = {
  fine: ' .,:;i1tfLCG08@#',
  std:  ' .:-=+*#%@',
  bold: '   ...---###@@@',
};

const COLS = 64;
const ROWS = 32; // half of COLS to compensate for ~2:1 char height:width ratio

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const artUrl = searchParams.get('artUrl');
  if (!artUrl) return NextResponse.json({ error: 'artUrl required' }, { status: 400 });

  const style = (searchParams.get('style') ?? 'std') as keyof typeof RAMPS;
  const ramp = RAMPS[style] ?? RAMPS.std;

  const imgRes = await fetch(artUrl, { headers: { 'User-Agent': UA }, redirect: 'follow' });
  if (!imgRes.ok) return NextResponse.json({ error: `Image fetch failed: ${imgRes.status}` }, { status: 400 });

  const buffer = Buffer.from(await imgRes.arrayBuffer());
  const image = await Jimp.read(buffer);
  image.resize(COLS, ROWS);

  const rows: string[] = [];
  for (let y = 0; y < ROWS; y++) {
    let row = '';
    for (let x = 0; x < COLS; x++) {
      const { r, g, b } = Jimp.intToRGBA(image.getPixelColor(x, y));
      const brightness = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
      row += ramp[Math.round(brightness * (ramp.length - 1))];
    }
    rows.push(row);
  }

  return NextResponse.json({ ascii: rows.join('\n') });
}
