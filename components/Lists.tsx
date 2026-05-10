'use client';

import * as React from 'react';
import grammyData from '@/data/grammy-aoty.json';
import Card from '@components/Card';
import Input from '@components/Input';
import ActionButton from '@components/ActionButton';
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
}

function AlbumRow({ label, album, artist, count }: AlbumRowProps) {
  const isResolved = count != null;
  const scrobbled = isResolved && count > 0;
  return (
    <div className={`${styles.row} ${scrobbled ? styles.scrobbled : isResolved ? styles.unscrobbled : ''}`}>
      <span className={styles.year}>{label}</span>
      <span className={styles.check}>{!isResolved ? '·' : scrobbled ? '✓' : '✗'}</span>
      <span className={styles.album}>{album}</span>
      <span className={styles.artist}>{artist}</span>
      {scrobbled && <span className={styles.count}>{count.toLocaleString()}</span>}
    </div>
  );
}

export default function Lists() {
  const [username, setUsername] = React.useState('');

  // Grammy state
  const [grammyPlaycounts, setGrammyPlaycounts] = React.useState<Record<string, number | null>>({});
  const [grammyLoading, setGrammyLoading] = React.useState(false);

  // Discography state
  const [artistQuery, setArtistQuery] = React.useState('');
  const [discoArtist, setDiscoArtist] = React.useState('');
  const [discoAlbums, setDiscoAlbums] = React.useState<{ name: string }[]>([]);
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

    const albums: { name: string }[] = data.albums;
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

  const grammyChecked = Object.values(grammyPlaycounts).filter((v) => (v ?? 0) > 0).length;
  const grammyResolved = Object.keys(grammyPlaycounts).length;

  const discoChecked = Object.values(discoPlaycounts).filter((v) => (v ?? 0) > 0).length;
  const discoResolved = Object.keys(discoPlaycounts).length;

  return (
    <div className={styles.container}>
      <div className={styles.usernameRow}>
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
      </div>

      <Card title="GRAMMY — ALBUM OF THE YEAR">
        <div className={styles.header}>
          <ActionButton onClick={handleGrammyCheck} disabled={grammyLoading || !username.trim()}>
            {grammyLoading ? `${grammyResolved}/${GRAMMY_LIST.length}` : 'CHECK'}
          </ActionButton>
          {grammyResolved > 0 && (
            <span className={styles.score}>{grammyChecked}/{GRAMMY_LIST.length} SCROBBLED</span>
          )}
        </div>
        <div className={styles.list}>
          {GRAMMY_LIST.map((entry) => (
            <AlbumRow
              key={entryKey(entry.artist, entry.album)}
              label={String(entry.year)}
              album={entry.album}
              artist={entry.artist}
              count={grammyPlaycounts[entryKey(entry.artist, entry.album)] ?? null}
            />
          ))}
        </div>
      </Card>

      <Card title="ARTIST DISCOGRAPHY">
        <div className={styles.header}>
          <Input
            label="ARTIST"
            placeholder="e.g. Radiohead"
            value={artistQuery}
            onChange={(e) => setArtistQuery(e.target.value)}
            onKeyDown={(e: React.KeyboardEvent) => { if (e.key === 'Enter') handleDiscoCheck(); }}
            isBlink
          />
          <ActionButton onClick={handleDiscoCheck} disabled={discoLoading || !artistQuery.trim() || !username.trim()}>
            {discoLoading ? `${discoResolved}/${discoAlbums.length || '?'}` : 'CHECK'}
          </ActionButton>
          {discoResolved > 0 && (
            <span className={styles.score}>{discoChecked}/{discoAlbums.length} SCROBBLED</span>
          )}
        </div>
        {discoError && <div className={styles.error}>{discoError}</div>}
        {discoAlbums.length > 0 && (
          <div className={styles.list}>
            {discoAlbums.map((album, i) => (
              <AlbumRow
                key={entryKey(discoArtist, album.name)}
                label={String(i + 1)}
                album={album.name}
                artist={discoArtist}
                count={discoPlaycounts[entryKey(discoArtist, album.name)] ?? null}
              />
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
