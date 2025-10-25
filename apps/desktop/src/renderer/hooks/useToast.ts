import { useEffect, useState } from 'react';

export type ToastVariant = 'info' | 'success' | 'warning' | 'error';

export interface ToastState {
  message: string | null;
  visible: boolean;
  variant: ToastVariant;
}

export function useToast(durationMs = 10_000) {
  const [toast, setToast] = useState<ToastState>({ message: null, visible: false, variant: 'info' });

  useEffect(() => {
    if (!toast.message) {
      return;
    }

    setToast((current) => ({ ...current, visible: true }));
    const timeout = window.setTimeout(() => {
      setToast({ message: null, visible: false, variant: 'info' });
    }, durationMs);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [toast.message, durationMs]);

  const showToast = (message: string, variant: ToastVariant = 'info') => {
    setToast({ message, visible: true, variant });
  };

  const hideToast = () => {
    setToast({ message: null, visible: false, variant: 'info' });
  };

  return { toast, showToast, hideToast } as const;
}
