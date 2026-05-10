'use client';

import styles from '@components/ActionBar.module.css';

import * as React from 'react';
import ButtonGroup from '@components/ButtonGroup';

interface ActionBarItem {
  hotkey?: string;
  onClick?: () => void;
  selected?: boolean;
  body: React.ReactNode;
}

interface ActionBarProps {
  items?: ActionBarItem[];
  rightItems?: ActionBarItem[];
  rightChildren?: React.ReactNode;
  children?: React.ReactNode;
}

const ActionBar: React.FC<ActionBarProps> = ({ items, rightItems, rightChildren, children }) => {
  return (
    <div className={styles.root}>
      <div className={styles.left}>
        {children}
        {items && items.length > 0 && <ButtonGroup items={items} />}
      </div>
      {(rightChildren || (rightItems && rightItems.length > 0)) && (
        <div className={styles.right}>
          {rightChildren}
          {rightItems && rightItems.length > 0 && <ButtonGroup items={rightItems} />}
        </div>
      )}
    </div>
  );
};

export default ActionBar;
