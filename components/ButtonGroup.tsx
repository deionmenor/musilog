'use client';

import styles from '@components/ButtonGroup.module.css';

import * as React from 'react';
import * as Utilities from '@common/utilities';

import ActionButton from '@components/ActionButton';

interface ButtonGroupItem {
  body: React.ReactNode;
  hotkey?: any;
  selected?: boolean;
  onClick?: () => void;
}

interface ButtonGroupProps {
  items?: ButtonGroupItem[];
  isFull?: boolean;
}

const ButtonGroup = (props: ButtonGroupProps) => {
  if (!props.items) return null;

  return (
    <div className={Utilities.classNames(styles.root, props.isFull ? styles.full : null)}>
      {props.items.map((each, i) => (
        <ActionButton key={i} onClick={each.onClick} hotkey={each.hotkey} isSelected={each.selected}>
          {each.body}
        </ActionButton>
      ))}
    </div>
  );
};

export default ButtonGroup;
