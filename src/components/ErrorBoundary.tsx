import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';

interface ErrorBoundaryState {
  hasError: boolean;
}

// Если интерфейс упал, покупатель видит понятный экран с кнопкой, а не белый лист
export class ErrorBoundary extends Component<{ children: ReactNode }, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ui]', error, info.componentStack);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <main className="page page--center">
        <div className="empty-state">
          <h3>Что-то пошло не так</h3>
          <p>Перезапустите магазин — корзина сохранится.</p>
          <button className="button button--primary" type="button" onClick={() => window.location.reload()}>
            Перезапустить
          </button>
        </div>
      </main>
    );
  }
}
