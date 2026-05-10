'use client';

import * as React from 'react';
import grammyData from '@/data/grammy-aoty.json';
import Card from '@components/Card';
import Input from '@components/Input';
import ActionButton from '@components/ActionButton';
import ButtonGroup from '@components/ButtonGroup';
import styles from './Lists.module.css';

interface AlbumEntry {
  year: number;
  artist: string;
  album: string;
}

const GRAMMY_LIST: AlbumEntry[] = grammyData;

function entryKey(artist: string, album: string) {
  return `${artist}::${album}`;
}

function normalizeTitle(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s*[\(\[].*?[\)\]]\s*/g, ' ')
    .replace(/\b(remaster(ed)?|deluxe|expanded|special|anniversary|bonus|live|extended|vol\.?\s*\d+|edition|version)\b/g, '')
    .replace(/[^a-z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

type DiscoAlbum = { name: string; imageUrl: string | null; year: string | null; releaseType: string };
interface AlbumGroup { primary: DiscoAlbum; variants: DiscoAlbum[] }

function buildGroups(albums: DiscoAlbum[]): AlbumGroup[] {
  const assigned = new Set<string>();
  const groups: AlbumGroup[] = [];

  for (const album of albums) {
    if (assigned.has(album.name)) continue;
    const norm = normalizeTitle(album.name);
    const similar = norm
      ? albums.filter((b) => b.name !== album.name && !assigned.has(b.name) && normalizeTitle(b.name) === norm)
      : [];

    assigned.add(album.name);
    similar.forEach((b) => assigned.add(b.name));

    const all = [album, ...similar].sort((a, b) => {
      if (a.releaseType === 'album' && b.releaseType !== 'album') return -1;
      if (b.releaseType === 'album' && a.releaseType !== 'album') return 1;
      return (a.year ?? '9999').localeCompare(b.year ?? '9999');
    });

    groups.push({ primary: all[0], variants: all.slice(1) });
  }

  return groups;
}

async function fetchPlaycount(artist: string, album: string, username: string): Promise<number> {
  try {
    const res = await fetch(
      `/api/album-userplaycount?artist=${encodeURIComponent(artist)}&album=${encodeURIComponent(album)}&username=${encodeURIComponent(username)}`
    );
    const data = await res.json();
    return parseInt(data.userplaycount, 10) || 0;
  } catch {
    return 0;
  }
}

interface AlbumRowProps {
  label: string;
  album: string;
  artist: string;
  count: number | null;
  showArtist?: boolean;
  imageUrl?: string | null;
  year?: string | null;
  fadeListened?: boolean;
  isVariant?: boolean;
}

function AlbumRow({ label, album, artist, count, showArtist = true, imageUrl, year, fadeListened, isVariant }: AlbumRowProps) {
  const isResolved = count != null;
  const scrobbled = isResolved && count > 0;
  const hasImage = imageUrl != null;
  const rowClass = [
    hasImage ? styles.rowWithImage : styles.row,
    fadeListened && scrobbled ? styles.faded : '',
    isVariant ? styles.variant : '',
  ].join(' ');
  return (
    <div className={rowClass}>
      <span className={styles.label}>{label}</span>
      <span className={`${styles.check} ${!isResolved ? '' : scrobbled ? styles.checkYes : styles.checkNo}`}>
        {!isResolved ? '·' : scrobbled ? '✓' : '✗'}
      </span>
      {hasImage && (
        <span className={styles.thumb}>
          {imageUrl ? <img src={imageUrl} alt="" className={styles.thumbImg} /> : null}
        </span>
      )}
      <span className={styles.album}>{album}</span>
      {showArtist && <span className={styles.artist}>{artist}</span>}
      {year && <span className={styles.year}>{year}</span>}
      {scrobbled && <span className={styles.count}>{count.toLocaleString()}</span>}
    </div>
  );
}

type ListMode = 'grammy' | 'discography';

export default function Lists() {
  const [username, setUsername] = React.useState('');
  const [mode, setMode] = React.useState<ListMode>('grammy');

  // Grammy state
  const [grammyPlaycounts, setGrammyPlaycounts] = React.useState<Record<string, number | null>>({});
  const [grammyLoading, setGrammyLoading] = React.useState(false);

  // Discography state
  const [artistQuery, setArtistQuery] = React.useState('');
  const [discoArtist, setDiscoArtist] = React.useState('');
  const [discoAlbums, setDiscoAlbums] = React.useState<{ name: string; imageUrl: string | null; year: string | null; releaseType: string }[]>([]);
  const [discoTypeFilter, setDiscoTypeFilter] = React.useState<'all' | 'album' | 'ep-single'>('all');
  const [fadeListened, setFadeListened] = React.useState(false);
  const [discoPlaycounts, setDiscoPlaycounts] = React.useState<Record<string, number | null>>({});
  const [discoLoading, setDiscoLoading] = React.useState(false);
  const [discoError, setDiscoError] = React.useState('');

  React.useEffect(() => {
    const saved = localStorage.getItem('lastfm-username');
    if (saved) setUsername(saved);
  }, []);

  const handleGrammyCheck = async () => {
    if (!username.trim()) return;
    setGrammyLoading(true);
    setGrammyPlaycounts({});
    const user = username.trim();
    await Promise.all(
      GRAMMY_LIST.map(async (entry) => {
        const count = await fetchPlaycount(entry.artist, entry.album, user);
        setGrammyPlaycounts((prev) => ({ ...prev, [entryKey(entry.artist, entry.album)]: count }));
      })
    );
    setGrammyLoading(false);
  };

  const handleDiscoCheck = async () => {
    if (!artistQuery.trim() || !username.trim()) return;
    setDiscoLoading(true);
    setDiscoError('');
    setDiscoAlbums([]);
    setDiscoPlaycounts({});
    setDiscoArtist('');

    const res = await fetch(`/api/artist-discography?artist=${encodeURIComponent(artistQuery.trim())}`);
    const data = await res.json();

    if (!res.ok || data.error) {
      setDiscoError(data.error || 'Failed to fetch discography.');
      setDiscoLoading(false);
      return;
    }

    const albums: { name: string; imageUrl: string | null; year: string | null; releaseType: string }[] = data.albums;
    setDiscoArtist(data.artist);
    setDiscoAlbums(albums);

    const user = username.trim();
    await Promise.all(
      albums.map(async (album) => {
        const count = await fetchPlaycount(data.artist, album.name, user);
        setDiscoPlaycounts((prev) => ({ ...prev, [entryKey(data.artist, album.name)]: count }));
      })
    );
    setDiscoLoading(false);
  };

  const isLoading = mode === 'grammy' ? grammyLoading : discoLoading;

  const grammyResolved = Object.keys(grammyPlaycounts).length;
  const grammyChecked = Object.values(grammyPlaycounts).filter((v) => (v ?? 0) > 0).length;

  const discoResolved = Object.keys(discoPlaycounts).length;
  const discoChecked = Object.values(discoPlaycounts).filter((v) => (v ?? 0) > 0).length;

  const cardTitle = mode === 'grammy'
    ? 'GRAMMY — ALBUM OF THE YEAR'
    : discoArtist ? discoArtist.toUpperCase() : 'DISCOGRAPHY';

  const score = mode === 'grammy'
    ? (grammyResolved > 0 ? `${grammyChecked}/${GRAMMY_LIST.length} SCROBBLED` : null)
    : (discoResolved > 0 ? `${discoChecked}/${discoAlbums.length} SCROBBLED` : null);

  return (
    <div className={styles.pageRow}>
      <div className={styles.mainCol}>
        <Card title={cardTitle}>
          <div className={styles.list}>
            {mode === 'grammy' && GRAMMY_LIST.map((entry) => (
              <AlbumRow
                key={entryKey(entry.artist, entry.album)}
                label={String(entry.year)}
                album={entry.album}
                artist={entry.artist}
                count={grammyPlaycounts[entryKey(entry.artist, entry.album)] ?? null}
                fadeListened={fadeListened}
              />
            ))}
            {mode === 'discography' && discoAlbums.length === 0 && !discoLoading && (
              <div className={styles.empty}>Search an artist to see their discography.</div>
            )}
            {mode === 'discography' && (() => {
              const byYear = (a: DiscoAlbum, b: DiscoAlbum) =>
                (a.year ?? '9999').localeCompare(b.year ?? '9999');

              const renderGroup = (group: AlbumGroup, index: number) => (
                <React.Fragment key={entryKey(discoArtist, group.primary.name)}>
                  <AlbumRow
                    label={String(index + 1)}
                    album={group.primary.name}
                    artist={discoArtist}
                    showArtist={false}
                    imageUrl={group.primary.imageUrl}
                    year={group.primary.year}
                    count={discoPlaycounts[entryKey(discoArtist, group.primary.name)] ?? null}
                    fadeListened={fadeListened}
                  />
                  {group.variants.map((v) => (
                    <AlbumRow
                      key={entryKey(discoArtist, v.name)}
                      label="↳"
                      album={v.name}
                      artist={discoArtist}
                      showArtist={false}
                      imageUrl={v.imageUrl}
                      year={v.year}
                      count={discoPlaycounts[entryKey(discoArtist, v.name)] ?? null}
                      fadeListened={fadeListened}
                      isVariant
                    />
                  ))}
                </React.Fragment>
              );

              if (discoTypeFilter !== 'all') {
                const filtered = discoAlbums.filter((a) =>
                  discoTypeFilter === 'album' ? a.releaseType === 'album' :
                  a.releaseType === 'ep' || a.releaseType === 'single'
                );
                return buildGroups(filtered).sort((a, b) => byYear(a.primary, b.primary)).map(renderGroup);
              }

              // ALL view: build groups across full list, then section by primary type
              const groups = buildGroups(discoAlbums);
              const albumGroups  = groups.filter((g) => g.primary.releaseType === 'album').sort((a, b) => byYear(a.primary, b.primary));
              const epGroups     = groups.filter((g) => g.primary.releaseType === 'ep' || g.primary.releaseType === 'single').sort((a, b) => byYear(a.primary, b.primary));
              const otherGroups  = groups.filter((g) => g.primary.releaseType === 'other').sort((a, b) => byYear(a.primary, b.primary));

              return (
                <>
                  {albumGroups.length > 0  && <div className={styles.sectionHeader}>ALBUMS</div>}
                  {albumGroups.map(renderGroup)}
                  {epGroups.length > 0     && <div className={styles.sectionHeader}>EPS & SINGLES</div>}
                  {epGroups.map((g, i) => renderGroup(g, i))}
                  {otherGroups.length > 0  && <div className={styles.sectionHeader}>OTHER</div>}
                  {otherGroups.map((g, i) => renderGroup(g, i))}
                </>
              );
            })()}
          </div>
        </Card>
      </div>

      <div className={styles.sidebarCol}>
        <Card title="LISTS">
          <div className={styles.sidebar}>
            <Input
              label="USERNAME"
              prefix="@"
              placeholder="e.g. rj"
              value={username}
              onChange={(e) => {
                setUsername(e.target.value);
                localStorage.setItem('lastfm-username', e.target.value);
              }}
              isBlink
            />

            <div className={styles.modeRow}>
              <ButtonGroup
                isFull
                items={[
                  { body: 'GRAMMY AOTY', selected: mode === 'grammy', onClick: () => setMode('grammy') },
                  { body: 'DISCOGRAPHY', selected: mode === 'discography', onClick: () => setMode('discography') },
                ]}
              />
            </div>

            {mode === 'discography' && (
              <>
                <Input
                  label="ARTIST"
                  placeholder="e.g. Radiohead"
                  value={artistQuery}
                  onChange={(e) => setArtistQuery(e.target.value)}
                  onKeyDown={(e: React.KeyboardEvent) => { if (e.key === 'Enter') handleDiscoCheck(); }}
                  isBlink
                />
                {discoAlbums.length > 0 && (
                  <ButtonGroup
                    isFull
                    items={[
                      { body: 'ALL', selected: discoTypeFilter === 'all', onClick: () => setDiscoTypeFilter('all') },
                      { body: 'ALBUMS', selected: discoTypeFilter === 'album', onClick: () => setDiscoTypeFilter('album') },
                      { body: 'EPS & SINGLES', selected: discoTypeFilter === 'ep-single', onClick: () => setDiscoTypeFilter('ep-single') },
                    ]}
                  />
                )}
              </>
            )}

            {discoError && <div className={styles.error}>{discoError}</div>}

            <div className={styles.actions}>
              <ActionButton
                onClick={mode === 'grammy' ? handleGrammyCheck : handleDiscoCheck}
                disabled={isLoading || !username.trim() || (mode === 'discography' && !artistQuery.trim())}
              >
                {isLoading
                  ? (mode === 'grammy' ? `${grammyResolved}/${GRAMMY_LIST.length}` : `${discoResolved}/${discoAlbums.length || '?'}`)
                  : 'CHECK'}
              </ActionButton>
              <ActionButton isSelected={fadeListened} onClick={() => setFadeListened((v) => !v)}>
                FADE LISTENED
              </ActionButton>
            </div>
            {score && <span className={styles.score}>{score}</span>}
          </div>
        </Card>
      </div>
    </div>
  );
}
