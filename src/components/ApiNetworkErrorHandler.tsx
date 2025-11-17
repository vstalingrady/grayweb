'use client';

import { useEffect } from 'react';

import { isApiNetworkError } from '@/lib/api';

export default function ApiNetworkErrorHandler() {
  useEffect(() => {
    const handleRejection = (event: PromiseRejectionEvent) => {
      if (isApiNetworkError(event.reason)) {
        event.preventDefault();
        if (process.env.NODE_ENV !== 'production') {
          console.debug('Suppressed ApiNetworkError unhandled rejection:', event.reason);
        }
      }
    };

    window.addEventListener('unhandledrejection', handleRejection);
    return () => {
      window.removeEventListener('unhandledrejection', handleRejection);
    };
  }, []);

  return null;
}
