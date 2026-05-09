'use client';

import styles from '@components/DatePicker.module.css';

import * as React from 'react';

interface DatePickerProps {
  year?: number;
  month?: number;
  value?: string;
  minDate?: string;
  maxDate?: string;
  onChange?: (date: string) => void;
}

const WEEKDAYS = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const MAX_CELLS = 42;

const DatePicker: React.FC<DatePickerProps> = ({ year, month, value, minDate, maxDate, onChange }) => {
  const today = new Date();

  const initYear = value ? parseInt(value.slice(0, 4)) : (year || today.getFullYear());
  const initMonth = value ? parseInt(value.slice(5, 7)) : (month || today.getMonth() + 1);

  const [currentYear, setYear] = React.useState(initYear);
  const [currentMonth, setMonth] = React.useState(initMonth);

  const first = new Date(currentYear, currentMonth - 1, 1);
  const startingWeekday = first.getDay();
  const daysInMonth = new Date(currentYear, currentMonth, 0).getDate();

  const cells: React.ReactNode[] = [];

  for (let i = 0; i < startingWeekday; i++) {
    cells.push(<div key={`empty-start-${i}`} className={styles.dayCell} />);
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const mm = String(currentMonth).padStart(2, '0');
    const dd = String(day).padStart(2, '0');
    const dateStr = `${currentYear}-${mm}-${dd}`;
    const isSelected = value === dateStr;
    const isDisabled = (maxDate ? dateStr > maxDate : false) || (minDate ? dateStr < minDate : false);
    const presentationDay = String(day).padStart(2, '0');

    cells.push(
      <div
        key={day}
        className={[
          styles.cell,
          isSelected ? styles.selected : undefined,
          isDisabled ? styles.disabled : undefined,
        ].filter(Boolean).join(' ')}
        tabIndex={isDisabled ? -1 : 0}
        aria-label={dateStr}
        aria-selected={isSelected}
        onClick={() => !isDisabled && onChange?.(dateStr)}
        onKeyDown={(e) => {
          if ((e.key === 'Enter' || e.key === ' ') && !isDisabled) {
            e.preventDefault();
            onChange?.(dateStr);
          }
        }}
      >
        {presentationDay}
      </div>
    );
  }

  while (cells.length < MAX_CELLS) {
    cells.push(<div key={`empty-end-${cells.length}`} className={styles.dayCell} />);
  }

  const onSwitchPreviousMonth = () => {
    if (currentMonth === 1) {
      setMonth(12);
      setYear((y) => y - 1);
    } else {
      setMonth((m) => m - 1);
    }
  };

  const onSwitchNextMonth = () => {
    if (maxDate) {
      const maxYear = parseInt(maxDate.slice(0, 4));
      const maxMonth = parseInt(maxDate.slice(5, 7));
      if (currentYear > maxYear || (currentYear === maxYear && currentMonth >= maxMonth)) return;
    }
    if (currentMonth === 12) {
      setMonth(1);
      setYear((y) => y + 1);
    } else {
      setMonth((m) => m + 1);
    }
  };

  return (
    <div className={styles.root}>
      <div className={styles.controls}>
        <button type="button" className={styles.button} onClick={onSwitchPreviousMonth} aria-label="Previous month">
          ▲
        </button>
        <div className={styles.date}>
          {currentYear} {MONTH_NAMES[currentMonth - 1].toUpperCase()}
        </div>
        <button type="button" className={styles.button} onClick={onSwitchNextMonth} aria-label="Next month">
          ▼
        </button>
      </div>
      <div className={styles.header}>
        {WEEKDAYS.map((day) => (
          <div key={day} className={styles.cell}>
            {day}
          </div>
        ))}
      </div>
      <div className={styles.days}>{cells}</div>
    </div>
  );
};

export default DatePicker;
