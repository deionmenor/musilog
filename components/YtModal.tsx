'use client';

import * as React from 'react';
import Card from '@components/Card';
import styles from '@components/YtModal.module.css';

interface YtModalProps {
  isOpen: boolean;
  videoId: string | null;
  title: string;
  onClose: () => void;
}

export default function YtModal({ isOpen, videoId, title, onClose }: YtModalProps) {
  React.useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    if (isOpen) document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  if (!isOpen || !videoId) return null;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <Card title={title.toUpperCase()}>
          <div className={styles.embedWrapper}>
            <iframe
              className={styles.embed}
              src={`https://www.youtube.com/embed/${videoId}?autoplay=1`}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        </Card>
      </div>
    </div>
  );
}
