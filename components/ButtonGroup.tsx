'use client';

import styles from '@components/ButtonGroup.module.css';

import * as React from 'react';
import * as Utilities from '@common/utilities';

import ActionButton from '@components/ActionButton';
import ThemeDropdown from '@components/ThemeDropdown';

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

  const selectedItem = props.items.find((item) => item.selected);
  const dropdownItems = props.items.map((item, i) => ({
    id: String(i),
    label: String(item.body),
  }));
  const currentId = String(props.items.findIndex((item) => item.selected));

  const handleSelect = (id: string) => {
    props.items?.[parseInt(id, 10)]?.onClick?.();
  };

  return (
    <>
      <div className={Utilities.classNames(styles.root, props.isFull ? styles.full : null)}>
        {props.items.map((each, i) => (
          <ActionButton key={i} onClick={each.onClick} hotkey={each.hotkey} isSelected={each.selected}>
            {each.body}
          </ActionButton>
        ))}
      </div>
      <div className={styles.mobileDropdown}>
        <ThemeDropdown
          label={String(selectedItem?.body ?? dropdownItems[0]?.label ?? '')}
          items={dropdownItems}
          currentId={currentId}
          onSelect={handleSelect}
        />
      </div>
    </>
  );
};

export default ButtonGroup;
