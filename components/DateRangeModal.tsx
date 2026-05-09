'use client';

import * as React from 'react';
import Card from '@components/Card';
import Button from '@components/Button';
import DatePicker from '@components/DatePicker';
import styles from '@components/DateRangeModal.module.css';

interface DateRangeModalProps {
  isOpen: boolean;
  initialFrom?: string;
  initialTo?: string;
  onClose: () => void;
  onConfirm: (from: string, to: string) => void;
}

const today = new Date().toISOString().split('T')[0];

export default function DateRangeModal({ isOpen, initialFrom, initialTo, onClose, onConfirm }: DateRangeModalProps) {
  const [from, setFrom] = React.useState(initialFrom ?? '');
  const [to, setTo] = React.useState(initialTo ?? '');
  const [error, setError] = React.useState('');

  React.useEffect(() => {
    if (isOpen) {
      setFrom(initialFrom ?? '');
      setTo(initialTo ?? '');
      setError('');
    }
  }, [isOpen]);

  const handleConfirm = () => {
    if (!from || !to) {
      setError('Both dates are required.');
      return;
    }
    if (from > to) {
      setError('Start date must be before end date.');
      return;
    }
    onConfirm(from, to);
  };

  const handleOverlayKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
  };

  if (!isOpen) return null;

  return (
    <div
      className={styles.overlay}
      onClick={onClose}
      onKeyDown={handleOverlayKeyDown}
      tabIndex={-1}
    >
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <Card title="CUSTOM DATE RANGE">
          <div className={styles.body}>
            <div className={styles.pickers}>
              <div className={styles.pickerCol}>
                <div className={styles.pickerLabel}>FROM{from ? ` — ${from}` : ''}</div>
                <DatePicker
                  value={from}
                  maxDate={today}
                  onChange={setFrom}
                />
              </div>
              <div className={styles.pickerCol}>
                <div className={styles.pickerLabel}>TO{to ? ` — ${to}` : ''}</div>
                <DatePicker
                  value={to}
                  minDate={from || undefined}
                  maxDate={today}
                  onChange={setTo}
                />
              </div>
            </div>
            {error && <div className={styles.error}>{error}</div>}
            <div className={styles.actions}>
              <Button onClick={handleConfirm}>CONFIRM</Button>
              <Button theme="SECONDARY" onClick={onClose}>CANCEL</Button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
