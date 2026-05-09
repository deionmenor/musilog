import styles from '@components/SimpleTable.module.css';

import * as React from 'react';

interface SimpleTableProps {
  data: React.ReactNode[][];
  align?: ('left' | 'right')[];
  animate?: boolean;
  onRowClick?: (index: number) => void;
  onRowHover?: (index: number) => void;
  onTableLeave?: () => void;
  selectedRow?: number;
  headerVariant?: 'red' | 'green' | 'blue';
  hideHeader?: boolean;
}

const STATUS_OK = new Set(['ACTIVE', 'OPEN', 'APPROVED']);
const STATUS_OFF = new Set(['CLOSED', 'PAID', 'SUSPENDED']);

const HEADER_CLASS: Record<string, string> = {
  red: styles.headerRed,
  green: styles.headerGreen,
  blue: styles.headerBlue,
};

const SimpleTable: React.FC<SimpleTableProps> = ({ data, align, animate, onRowClick, onRowHover, onTableLeave, selectedRow, headerVariant, hideHeader }) => {
  if (!data || data.length === 0) return null;
  const [header, ...rows] = data;

  const isRankTable = header[0] === '#';  // header cells are always strings
  const alignAt = (col: number) => (align && align[col] === 'right' ? styles.alignRight : undefined);
  const tableClass = [styles.root, headerVariant ? HEADER_CLASS[headerVariant] : undefined].filter(Boolean).join(' ');

  return (
    <div className={styles.scrollWrapper} onMouseLeave={onTableLeave}>
      <table className={tableClass}>
        {!hideHeader && (
          <thead>
            <tr>
              {header.map((cell, i) => (
                <td key={i} className={alignAt(i)}>
                  {cell}
                </td>
              ))}
            </tr>
          </thead>
        )}
        <tbody>
          {rows.map((row, ri) => (
            <tr
              key={ri}
              tabIndex={0}
              className={[
                animate ? styles.animateRow : undefined,
                (onRowClick || onRowHover) ? styles.clickable : undefined,
                selectedRow === ri ? styles.selectedRow : undefined,
              ].filter(Boolean).join(' ') || undefined}
              style={animate ? ({ '--row-index': ri } as React.CSSProperties) : undefined}
              onClick={() => onRowClick?.(ri)}
              onMouseEnter={() => onRowHover?.(ri)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onRowClick?.(ri); }}
            >
              {row.map((cell, ci) => {
                if (isRankTable && ci === 0) {
                  return <td key={ci} className={styles.rankCell}>{cell}</td>;
                }
                let statusClass: string | undefined;
                if (typeof cell === 'string' && STATUS_OK.has(cell)) statusClass = styles.statusOk;
                else if (typeof cell === 'string' && STATUS_OFF.has(cell)) statusClass = styles.statusOff;
                const className = [alignAt(ci), statusClass].filter(Boolean).join(' ') || undefined;
                return (
                  <td key={ci} className={className}>
                    {cell}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default SimpleTable;
