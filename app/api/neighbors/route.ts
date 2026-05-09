import { NextRequest, NextResponse } from 'next/server';

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

interface Neighbor {
  rank: number;
  username: string;
  sharedArtists: string[];
  avatar: string | null;
  url: string;
}

function decodeEntities(html: string): string {
  return html
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');
}

function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, '');
}

function parseSharedArtists(raw: string): string[] {
  // raw: "You both listen to Mitski, Laufey and The Beatles."
  const m = raw.match(/(?:you|they) both listen to\s+([\s\S]+?)\.?\s*$/i);
  const artistStr = (m ? m[1] : raw).trim().replace(/\.$/, '');
  if (!artistStr) return [];

  const parts = artistStr.split(', ');
  const result: string[] = [];

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i].trim();
    const isLast = i === parts.length - 1;

    if (isLast) {
      const andIdx = part.lastIndexOf(' and ');
      if (andIdx !== -1) {
        const before = part.slice(0, andIdx).trim();
        const after = part.slice(andIdx + 5).trim();
        if (before) result.push(before);
        if (after) result.push(after);
      } else {
        result.push(part);
      }
    } else {
      result.push(part);
    }
  }

  return result.filter(Boolean);
}

function parseNeighbors(html: string, username: string): Neighbor[] {
  const clean = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '');

  const neighbors: Neighbor[] = [];
  const seen = new Set<string>();

  const liRegex = /<li[\s\S]*?<\/li>/gi;
  let li: RegExpExecArray | null;

  while ((li = liRegex.exec(clean)) !== null) {
    const block = li[0];

    const userMatch = block.match(/href="\/user\/([^"/?#]+)"/i);
    if (!userMatch) continue;

    const neighbor = userMatch[1];
    if (neighbor.toLowerCase() === username.toLowerCase()) continue;
    if (seen.has(neighbor.toLowerCase())) continue;
    seen.add(neighbor.toLowerCase());

    // Avatar: <span class="... user-list-avatar ..."><img src="..."></span>
    const DEFAULT_AVATAR = '818148bf682d429dc215c1705eb27b98';
    const avatarSpan = block.match(/<span[^>]*user-list-avatar[\s\S]*?<img[^>]*src="([^"]+)"[^>]*>/i);
    const rawAvatar = avatarSpan?.[1] ?? null;
    const avatar = rawAvatar && !rawAvatar.includes(DEFAULT_AVATAR) ? rawAvatar : null;

    // Shared artists: <p class="user-list-shared-artists">...</p>
    const sharedEl = block.match(/<p[^>]*class="[^"]*user-list-shared-artists[^"]*"[^>]*>([\s\S]*?)<\/p>/i);
    let sharedArtists: string[] = [];
    if (sharedEl) {
      const text = decodeEntities(stripTags(sharedEl[1]));
      sharedArtists = parseSharedArtists(text);
    }

    neighbors.push({
      rank: neighbors.length + 1,
      username: neighbor,
      sharedArtists,
      avatar,
      url: `https://www.last.fm/user/${neighbor}`,
    });

    if (neighbors.length >= 50) break;
  }

  return neighbors;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const username = searchParams.get('username');

  if (!username) {
    return NextResponse.json({ error: 'Username is required' }, { status: 400 });
  }

  try {
    const res = await fetch(
      `https://www.last.fm/user/${encodeURIComponent(username)}/neighbours`,
      {
        headers: {
          'User-Agent': UA,
          Accept: 'text/html,application/xhtml+xml',
          'Accept-Language': 'en-US,en;q=0.9',
        },
      }
    );

    if (!res.ok) {
      return NextResponse.json(
        { error: `Last.fm returned ${res.status}` },
        { status: 400 }
      );
    }

    const html = await res.text();
    const neighbors = parseNeighbors(html, username);

    if (neighbors.length === 0) {
      return NextResponse.json(
        { error: 'No neighbours found — the page may require login or the username is incorrect.' },
        { status: 404 }
      );
    }

    return NextResponse.json({ neighbors, username });
  } catch {
    return NextResponse.json({ error: 'Failed to fetch neighbours page.' }, { status: 500 });
  }
}
