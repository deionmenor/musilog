'use client';

import * as React from 'react';
import styles from '@components/ThemeDropdown.module.css';

export interface DropdownItem {
  id: string;
  label: string;
}

interface ThemeDropdownProps {
  hotkey?: string;
  label: string;
  items: DropdownItem[];
  currentId?: string;
  onSelect: (id: string) => void;
}

const ThemeDropdown: React.FC<ThemeDropdownProps> = ({ hotkey, label, items, currentId, onSelect }) => {
  const [open, setOpen] = React.useState(false);
  const rootRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    const handleMouse = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('keydown', handleKey);
    document.addEventListener('mousedown', handleMouse);
    return () => {
      document.removeEventListener('keydown', handleKey);
      document.removeEventListener('mousedown', handleMouse);
    };
  }, [open]);

  return (
    <div className={styles.root} ref={rootRef}>
      <div
        className={styles.trigger}
        onClick={() => setOpen((v) => !v)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpen((v) => !v); }
        }}
      >
        {hotkey && <span className={styles.hotkey}>{hotkey}</span>}
        <span className={styles.content}>{label}</span>
      </div>
      {open && (
        <div className={styles.menu} role="listbox">
          {items.map((t) => (
            <div
              key={t.id}
              className={`${styles.item}${t.id === currentId ? ` ${styles.itemActive}` : ''}`}
              onClick={() => { onSelect(t.id); setOpen(false); }}
              role="option"
              aria-selected={t.id === currentId}
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter') { onSelect(t.id); setOpen(false); } }}
            >
              {t.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ThemeDropdown;
