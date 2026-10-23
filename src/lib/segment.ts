import type { CSSProperties } from 'react';

// Позиция «ползунка» сегментного переключателя: CSS двигает подсветку к активному пункту
export const segmentStyle = (index: number, count: number) =>
  ({ '--seg-index': Math.max(0, index), '--seg-count': count }) as CSSProperties;
