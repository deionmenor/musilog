'use client';

import styles from '@components/TrackTable.module.css';
import tableStyles from '@components/SimpleTable.module.css';

import * as React from 'react';
import { formatName } from '@/lib/formatName';

interface TrackRow {
  rank: number;
  name: string;
  artist: string;
  playcount: number;
}

interface TrackTableProps {
  tracks: TrackRow[];
  onPlay: (trackIdx: number, videoId: string) => void;
  showPlays?: boolean;
  headerVariant?: 'red' | 'green' | 'blue';
}

function PlayButton({ artist, track, onPlay }: { artist: string; track: string; onPlay: (videoId: string) => void }) {
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
    } finally {
      setLoading(false);
    }
  };

  return (
    <button className={styles.playBtn} onClick={handleClick} disabled={loading} title="Play on YouTube">
      {loading ? '...' : '▶'}
    </button>
  );
}

const HEADER_CLASS: Record<string, string> = {
  red: tableStyles.headerRed,
  green: tableStyles.headerGreen,
  blue: tableStyles.headerBlue,
};

const TrackTable: React.FC<TrackTableProps> = ({ tracks, onPlay, showPlays = true, headerVariant }) => {
  if (!tracks.length) return null;
  const tableClass = [tableStyles.root, headerVariant ? HEADER_CLASS[headerVariant] : undefined].filter(Boolean).join(' ');

  return (
    <div className={tableStyles.scrollWrapper}>
      <table className={tableClass}>
        <thead>
          <tr>
            <td>#</td>
            <td>SONG</td>
            <td>ARTIST</td>
            {showPlays && <td className={tableStyles.alignRight}>PLAYS</td>}
            <td />
          </tr>
        </thead>
        <tbody>
          {tracks.map((t, i) => (
            <tr
              key={i}
              className={tableStyles.animateRow}
              style={{ '--row-index': i } as React.CSSProperties}
            >
              <td className={tableStyles.rankCell}>{t.rank}</td>
              <td>{formatName(t.name)}</td>
              <td>{t.artist}</td>
              {showPlays && <td className={tableStyles.alignRight}>{t.playcount.toLocaleString()}</td>}
              <td className={styles.playCol}>
                <PlayButton
                  artist={t.artist}
                  track={t.name}
                  onPlay={(videoId) => onPlay(i, videoId)}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default TrackTable;
