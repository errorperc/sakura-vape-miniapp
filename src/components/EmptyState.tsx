import type { ReactNode } from 'react';

interface EmptyStateProps {
  icon: ReactNode;
  title: string;
  text: string;
  action?: ReactNode;
}

export function EmptyState({ icon, title, text, action }: EmptyStateProps) {
  return (
    <div className="empty-state">
      <div className="empty-state__icon">{icon}</div>
      <h3>{title}</h3>
      <p>{text}</p>
      {action}
    </div>
  );
}
