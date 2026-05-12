'use client';

import * as React from 'react';
import grammyData from '@/data/grammy-aoty.json';
import Card from '@components/Card';
import Input from '@components/Input';
import ActionButton from '@components/ActionButton';
import ButtonGroup from '@components/ButtonGroup';
import YoutubePlayer, { YoutubePlayerActions } from '@components/YoutubePlayer';
import Tooltip from '@components/Tooltip';
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

const EDITION_WORDS = /remaster(ed)?|deluxe|expanded|special|anniversary|bonus|live|extended|vol\.?\s*\d+|edition|version|mono|stereo|super/i;

function normalizeTitle(name: string): string {
  return name
    .toLowerCase()
    // Only strip parentheticals that contain edition-type words (e.g. "(Deluxe Edition)")
    // Preserve descriptive parentheticals like "(Blue Album)" or "(From the Basement)"
    .replace(/\s*[\(\[][^\)\]]*[\)\]]\s*/g, (match) => EDITION_WORDS.test(match) ? ' ' : match)
    .replace(new RegExp(`\\b(${EDITION_WORDS.source})\\b`, 'gi'), '')
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
  isSelected?: boolean;
  onClick?: () => void;
}

function AlbumRow({ label, album, artist, count, showArtist = true, imageUrl, year, fadeListened, isVariant, isSelected, onClick }: AlbumRowProps) {
  const isResolved = count != null;
  const scrobbled = isResolved && count > 0;
  const hasImage = imageUrl != null;
  const rowClass = [
    hasImage ? styles.rowWithImage : styles.row,
    fadeListened && scrobbled ? styles.faded : '',
    isVariant ? styles.variant : '',
    isSelected ? styles.rowSelected : '',
    onClick ? styles.rowClickable : '',
  ].join(' ');
  return (
    <div className={rowClass} onClick={onClick}>
      <span className={styles.label}>{label}</span>
      <Tooltip content={scrobbled ? `${count!.toLocaleString()} scrobbles` : undefined}>
        <span className={`${styles.check} ${!isResolved ? '' : scrobbled ? styles.checkYes : styles.checkNo}`}>
          {!isResolved ? '·' : scrobbled ? '✓' : '✗'}
        </span>
      </Tooltip>
      {hasImage && (
        <span className={styles.thumb}>
          {imageUrl ? <img src={imageUrl} alt="" className={styles.thumbImg} /> : null}
        </span>
      )}
      <span className={styles.album}>{album}</span>
      {showArtist && <span className={styles.artist}>{artist}</span>}
      {year && <span className={styles.year}>{year}</span>}
    </div>
  );
}

function fmtDur(s: number): string {
  if (!s) return '';
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

interface DiscoTrack { rank: number; name: string; duration: number; playcount: number; }

function TrackPlayBtn({ artist, track, onPlay }: { artist: string; track: string; onPlay: (videoId: string) => void }) {
  const [loading, setLoading] = React.useState(false);
  const [videoId, setVideoId] = React.useState<string | null>(null);
  const handleClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (videoId) { onPlay(videoId); return; }
    setLoading(true);
    try {
      const res = await fetch(`/api/yt-link?artist=${encodeURIComponent(artist)}&track=${encodeURIComponent(track)}`);
      const data = await res.json();
      if (data.videoId) { setVideoId(data.videoId); onPlay(data.videoId); }
    } finally { setLoading(false); }
  };
  return (
    <button className={styles.trackPlayBtn} onClick={handleClick} disabled={loading} title="Play">
      {loading ? '…' : '▶'}
    </button>
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
  const [discoSearchResults, setDiscoSearchResults] = React.useState<{ name: string; listeners: number; imageUrl: string | null }[] | null>(null);
  const [discoSearching, setDiscoSearching] = React.useState(false);
  const [discoArtist, setDiscoArtist] = React.useState('');
  const [discoAlbums, setDiscoAlbums] = React.useState<{ name: string; imageUrl: string | null; year: string | null; releaseType: string }[]>([]);
  const [discoTypeFilter, setDiscoTypeFilter] = React.useState<'all' | 'album' | 'ep-single'>('all');
  const [fadeListened, setFadeListened] = React.useState(false);
  const [discoPlaycounts, setDiscoPlaycounts] = React.useState<Record<string, number | null>>({});
  const [discoLoading, setDiscoLoading] = React.useState(false);
  const [discoError, setDiscoError] = React.useState('');

  // Tracklist / player state
  const [tracklistAlbum, setTracklistAlbum] = React.useState<{ name: string; artist: string } | null>(null);
  const [tracklist, setTracklist] = React.useState<DiscoTrack[] | null>(null);
  const [tracklistLoading, setTracklistLoading] = React.useState(false);
  const [ytEmbed, setYtEmbed] = React.useState<{ videoId: string; title: string; trackIdx: number } | null>(null);
  const [ytPlaying, setYtPlaying] = React.useState(false);
  const ytActionsRef = React.useRef<YoutubePlayerActions | null>(null);

  React.useEffect(() => {
    const saved = localStorage.getItem('lastfm-username');
    if (saved) setUsername(saved);
  }, []);

  const resetDisco = () => {
    setDiscoSearchResults(null);
    setDiscoArtist('');
    setDiscoAlbums([]);
    setDiscoPlaycounts({});
    setDiscoError('');
  };

  const handleAlbumClick = async (artist: string, album: string) => {
    setTracklistAlbum({ name: album, artist });
    setTracklist(null);
    setTracklistLoading(true);
    setYtEmbed(null);
    const res = await fetch(`/api/album-info?artist=${encodeURIComponent(artist)}&album=${encodeURIComponent(album)}`);
    const data = await res.json();
    setTracklist(data.tracks ?? []);
    setTracklistLoading(false);
  };

  const handleYtNavigate = (trackIdx: number) => {
    if (!tracklist || !tracklistAlbum) return;
    const t = tracklist[trackIdx];
    if (!t) return;
    fetch(`/api/yt-link?artist=${encodeURIComponent(tracklistAlbum.artist)}&track=${encodeURIComponent(t.name)}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.videoId) setYtEmbed({ videoId: data.videoId, title: `${tracklistAlbum.artist} — ${t.name}`, trackIdx });
      });
  };

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

  const handleArtistSearch = async () => {
    if (!artistQuery.trim()) return;
    setDiscoSearching(true);
    resetDisco();
    const res = await fetch(`/api/artist-search?q=${encodeURIComponent(artistQuery.trim())}`);
    const data = await res.json();
    setDiscoSearchResults(data.artists ?? []);
    setDiscoSearching(false);
  };

  const handleSelectArtist = async (artistName: string) => {
    if (!username.trim()) return;
    setDiscoLoading(true);
    setDiscoSearchResults(null);
    setDiscoError('');
    setDiscoAlbums([]);
    setDiscoPlaycounts({});
    setDiscoArtist('');

    const res = await fetch(`/api/artist-discography?artist=${encodeURIComponent(artistName)}`);
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

  const isLoading = mode === 'grammy' ? grammyLoading : (discoLoading || discoSearching);

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
                isSelected={tracklistAlbum?.artist === entry.artist && tracklistAlbum?.name === entry.album}
                onClick={() => handleAlbumClick(entry.artist, entry.album)}
              />
            ))}
            {mode === 'discography' && !discoSearchResults && discoAlbums.length === 0 && !discoLoading && !discoSearching && (
              <div className={styles.empty}>Search an artist to see their discography.</div>
            )}
            {mode === 'discography' && discoSearchResults && (
              discoSearchResults.length === 0
                ? <div className={styles.empty}>No artists found.</div>
                : discoSearchResults.map((a) => (
                    <div
                      key={a.name}
                      className={styles.searchResult}
                      onClick={() => { setArtistQuery(a.name); handleSelectArtist(a.name); }}
                    >
                      {a.imageUrl && <img src={a.imageUrl} alt="" className={styles.searchResultImg} />}
                      <span className={styles.searchResultName}>{a.name}</span>
                      <span className={styles.searchResultListeners}>{a.listeners.toLocaleString()} listeners</span>
                    </div>
                  ))
            )}
            {mode === 'discography' && (() => {
              const byYear = (a: DiscoAlbum, b: DiscoAlbum) =>
                (a.year ?? '9999').localeCompare(b.year ?? '9999');

              const renderGroup = (group: AlbumGroup, index: number) => {
                const primaryRaw = discoPlaycounts[entryKey(discoArtist, group.primary.name)];
                const aggregatedCount = primaryRaw === undefined
                  ? null
                  : group.variants.reduce((sum, v) => sum + (discoPlaycounts[entryKey(discoArtist, v.name)] ?? 0), primaryRaw ?? 0);
                const isGroupSelected = group.variants.some(
                  (v) => tracklistAlbum?.artist === discoArtist && tracklistAlbum?.name === v.name
                ) || (tracklistAlbum?.artist === discoArtist && tracklistAlbum?.name === group.primary.name);
                return (
                  <AlbumRow
                    key={entryKey(discoArtist, group.primary.name)}
                    label={String(index + 1)}
                    album={group.primary.name}
                    artist={discoArtist}
                    showArtist={false}
                    imageUrl={group.primary.imageUrl}
                    year={group.primary.year}
                    count={aggregatedCount}
                    fadeListened={fadeListened}
                    isSelected={isGroupSelected}
                    onClick={() => handleAlbumClick(discoArtist, group.primary.name)}
                  />
                );
              };

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
                  onKeyDown={(e: React.KeyboardEvent) => { if (e.key === 'Enter') handleArtistSearch(); }}
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
              {mode === 'grammy' && (
                <ActionButton
                  onClick={() => { if (!isLoading && username.trim()) handleGrammyCheck(); }}
                >
                  {grammyLoading ? `${grammyResolved}/${GRAMMY_LIST.length}` : 'CHECK'}
                </ActionButton>
              )}
              {mode === 'discography' && !discoArtist && (
                <ActionButton
                  onClick={() => { if (!isLoading && artistQuery.trim()) handleArtistSearch(); }}
                >
                  {discoSearching ? '...' : 'SEARCH'}
                </ActionButton>
              )}
              {mode === 'discography' && (discoArtist || discoSearchResults) && (
                <ActionButton
                  onClick={() => { if (!isLoading) { resetDisco(); setArtistQuery(''); } }}
                >
                  BACK
                </ActionButton>
              )}
              {mode === 'discography' && discoArtist && (
                <ActionButton
                  onClick={() => {
                    if (isLoading || !username.trim()) return;
                    setDiscoPlaycounts({});
                    const user = username.trim();
                    setDiscoLoading(true);
                    Promise.all(
                      discoAlbums.map(async (album) => {
                        const count = await fetchPlaycount(discoArtist, album.name, user);
                        setDiscoPlaycounts((prev) => ({ ...prev, [entryKey(discoArtist, album.name)]: count }));
                      })
                    ).then(() => setDiscoLoading(false));
                  }}
                >
                  {discoLoading ? `${discoResolved}/${discoAlbums.length}` : 'CHECK'}
                </ActionButton>
              )}
              <ActionButton isSelected={fadeListened} onClick={() => setFadeListened((v) => !v)}>
                FADE LISTENED
              </ActionButton>
            </div>
            {score && <span className={styles.score}>{score}</span>}
          </div>
        </Card>

        {ytEmbed && (
          <Card title={ytEmbed.title}>
            <div className={styles.ytEmbedWrapper}>
              <YoutubePlayer
                videoId={ytEmbed.videoId}
                onPlayingChange={setYtPlaying}
                onPlayerReady={(a) => { ytActionsRef.current = a; }}
                onEnded={() => { if (tracklist && ytEmbed.trackIdx < tracklist.length - 1) handleYtNavigate(ytEmbed.trackIdx + 1); }}
              />
            </div>
            <div className={styles.ytControls}>
              <div className={styles.ytNavButtons}>
                {ytEmbed.trackIdx > 0 && <ActionButton onClick={() => handleYtNavigate(ytEmbed.trackIdx - 1)}>PREV</ActionButton>}
                {tracklist?.[ytEmbed.trackIdx + 1] && <ActionButton onClick={() => handleYtNavigate(ytEmbed.trackIdx + 1)}>NEXT</ActionButton>}
              </div>
              <div className={styles.ytNavButtons}>
                <ActionButton onClick={() => ytPlaying ? ytActionsRef.current?.pause() : ytActionsRef.current?.play()}>
                  {ytPlaying ? 'PAUSE' : 'PLAY'}
                </ActionButton>
                <ActionButton onClick={() => setYtEmbed(null)}>STOP</ActionButton>
              </div>
            </div>
          </Card>
        )}

        {tracklistAlbum && (
          <Card title={`${tracklistAlbum.name.toUpperCase()} — TRACKLIST`}>
            {tracklistLoading && <div className={styles.tracklistLoading}>LOADING...</div>}
            {tracklist && tracklist.length === 0 && <div className={styles.empty}>No tracks found.</div>}
            {tracklist && tracklist.length > 0 && (() => {
              const withPlays = tracklist.filter((t) => t.playcount > 0);
              const hotSet = new Set(
                [...withPlays].sort((a, b) => b.playcount - a.playcount).slice(0, 3).map((t) => t.rank)
              );
              return (
                <div className={styles.tracklist}>
                  {tracklist.map((t, i) => (
                    <div key={t.rank} className={[styles.trackRow, ytEmbed?.trackIdx === i ? styles.trackRowPlaying : ''].join(' ')}>
                      <span className={styles.trackNum}>{t.rank}.</span>
                      <span className={styles.trackName}>{t.name}</span>
                      {hotSet.has(t.rank) && (
                        <Tooltip content={`${t.playcount.toLocaleString()} plays`}>
                          <span className={styles.hotDot} />
                        </Tooltip>
                      )}
                      {t.duration > 0 && <span className={styles.trackDur}>{fmtDur(t.duration)}</span>}
                      <TrackPlayBtn
                        artist={tracklistAlbum.artist}
                        track={t.name}
                        onPlay={(videoId) => setYtEmbed({ videoId, title: `${tracklistAlbum.artist} — ${t.name}`, trackIdx: i })}
                      />
                    </div>
                  ))}
                </div>
              );
            })()}
          </Card>
        )}
      </div>
    </div>
  );
}
