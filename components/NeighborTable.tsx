'use client';

import styles from '@components/NeighborTable.module.css';
import tableStyles from '@components/SimpleTable.module.css';

import * as React from 'react';
import Avatar from '@components/Avatar';

function hashStr(s: string): number {
  return s.split('').reduce((acc, c) => (acc * 31 + c.charCodeAt(0)) & 0xffff, 0);
}

function placeholderStyle(username: string): React.CSSProperties {
  const h = hashStr(username);
  const pct = 35 + (h % 40); // 35 – 74 % mix of accent into background
  return { background: `color-mix(in srgb, var(--theme-button-foreground) ${pct}%, var(--theme-background))` };
}

interface Neighbor {
  rank: number;
  username: string;
  sharedArtists: string[];
  avatar: string | null;
  url: string;
}

interface NeighborTableProps {
  neighbors: Neighbor[];
  onRowClick?: (index: number) => void;
}

const NeighborTable: React.FC<NeighborTableProps> = ({ neighbors, onRowClick }) => {
  if (!neighbors.length) return null;

  return (
    <div className={tableStyles.scrollWrapper}>
      <table className={tableStyles.root}>
        <thead>
          <tr>
            <td className={styles.avatarCol} />
            <td>#</td>
            <td>USER</td>
            <td />
          </tr>
        </thead>
        <tbody>
          {neighbors.map((n, i) => (
            <tr
              key={n.username}
              tabIndex={0}
              className={[
                tableStyles.animateRow,
                onRowClick ? tableStyles.clickable : undefined,
              ].filter(Boolean).join(' ')}
              style={{ '--row-index': i } as React.CSSProperties}
              onClick={() => onRowClick?.(i)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onRowClick?.(i); }}
            >
              <td className={styles.avatarCol}>
                <Avatar
                  src={n.avatar ?? undefined}
                  style={n.avatar ? undefined : placeholderStyle(n.username)}
                />
              </td>
              <td className={tableStyles.rankCell}>{n.rank}</td>
              <td>{n.username}</td>
              <td className={styles.sharedArtists}>
                {n.sharedArtists.slice(0, 3).join(' · ') || '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default NeighborTable;
