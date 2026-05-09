'use client';

import styles from '@components/Tooltip.module.css';
import * as React from 'react';

interface TooltipProps {
  content: React.ReactNode;
  children: React.ReactNode;
}

const Tooltip: React.FC<TooltipProps> = ({ content, children }) => {
  return (
    <span className={styles.root}>
      {children}
      <span className={styles.tip}>{content}</span>
    </span>
  );
};

export default Tooltip;
