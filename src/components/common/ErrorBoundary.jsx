// src/components/common/ErrorBoundary.jsx
import React from 'react';
import { Icon } from '@iconify/react';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            padding: '32px 20px',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '280px',
            color: 'var(--text-primary)',
          }}
        >
          <div
            style={{
              width: '54px',
              height: '54px',
              borderRadius: '50%',
              backgroundColor: 'var(--color-error-bg)',
              color: 'var(--color-error)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '16px',
            }}
          >
            <Icon icon="solar:danger-triangle-bold" width="30" height="30" />
          </div>
          <h3 style={{ fontSize: '1.1rem', fontWeight: '800', marginBottom: '8px' }}>
            Kutilmagan xatolik yuz berdi
          </h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '20px', maxWidth: '300px' }}>
            Ilovani qayta yuklash uchun quyidagi tugmani bosing
          </p>
          <button
            onClick={this.handleReset}
            style={{
              background: 'var(--accent-gradient)',
              color: '#fff',
              border: 'none',
              padding: '10px 22px',
              borderRadius: 'var(--radius-md)',
              fontWeight: '700',
              fontSize: '0.9rem',
              cursor: 'pointer',
            }}
          >
            Qayta yuklash
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
