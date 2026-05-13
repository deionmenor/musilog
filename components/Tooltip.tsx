'use client';

import styles from '@components/Tooltip.module.css';
import * as React from 'react';

interface TooltipProps {
  content: React.ReactNode;
  children: React.ReactNode;
  position?: 'above' | 'below';
}

const Tooltip: React.FC<TooltipProps> = ({ content, children, position = 'above' }) => {
  return (
    <span className={styles.root}>
      {children}
      <span className={position === 'below' ? styles.tipBelow : styles.tip}>{content}</span>
    </span>
  );
};

export default Tooltip;
