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

const LIST: AlbumEntry[] = grammyData;

function entryKey(e: AlbumEntry) {
  return `${e.artist}::${e.album}`;
}

export default function Lists() {
  const [username, setUsername] = React.useState('');
  const [playcounts, setPlaycounts] = React.useState<Record<string, number | null>>({});
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    const saved = localStorage.getItem('lastfm-username');
    if (saved) setUsername(saved);
  }, []);

  const handleCheck = async () => {
    if (!username.trim()) return;
    setLoading(true);
    setPlaycounts({});
    const user = username.trim();

    await Promise.all(
      LIST.map(async (entry) => {
        try {
          const res = await fetch(
            `/api/album-userplaycount?artist=${encodeURIComponent(entry.artist)}&album=${encodeURIComponent(entry.album)}&username=${encodeURIComponent(user)}`
          );
          const data = await res.json();
          const count = parseInt(data.userplaycount, 10) || 0;
          setPlaycounts((prev) => ({ ...prev, [entryKey(entry)]: count }));
        } catch {
          setPlaycounts((prev) => ({ ...prev, [entryKey(entry)]: 0 }));
        }
      })
    );

    setLoading(false);
  };

  const checked = Object.values(playcounts).filter((v) => (v ?? 0) > 0).length;
  const resolved = Object.keys(playcounts).length;
  const hasResults = resolved > 0;

  return (
    <div className={styles.container}>
      <Card title="GRAMMY — ALBUM OF THE YEAR">
        <div className={styles.header}>
          <Input
            label="USERNAME"
            prefix="@"
            placeholder="e.g. rj"
            value={username}
            onChange={(e) => {
              setUsername(e.target.value);
              localStorage.setItem('lastfm-username', e.target.value);
            }}
            onKeyDown={(e: React.KeyboardEvent) => { if (e.key === 'Enter') handleCheck(); }}
            isBlink
          />
          <ActionButton onClick={handleCheck} disabled={loading || !username.trim()}>
            {loading ? `${resolved}/${LIST.length}` : 'CHECK'}
          </ActionButton>
          {hasResults && (
            <span className={styles.score}>{checked}/{LIST.length} SCROBBLED</span>
          )}
        </div>

        <div className={styles.list}>
          {LIST.map((entry) => {
            const k = entryKey(entry);
            const count = playcounts[k];
            const isResolved = count != null;
            const scrobbled = isResolved && count > 0;

            return (
              <div
                key={k}
                className={`${styles.row} ${scrobbled ? styles.scrobbled : isResolved ? styles.unscrobbled : ''}`}
              >
                <span className={styles.year}>{entry.year}</span>
                <span className={styles.check}>
                  {!isResolved ? '·' : scrobbled ? '✓' : '✗'}
                </span>
                <span className={styles.album}>{entry.album}</span>
                <span className={styles.artist}>{entry.artist}</span>
                {scrobbled && (
                  <span className={styles.count}>{count.toLocaleString()}</span>
                )}
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
