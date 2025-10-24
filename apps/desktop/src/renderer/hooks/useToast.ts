import { useEffect, useState } from 'react';

export interface ToastState {
  message: string | null;
  visible: boolean;
}

export function useToast(durationMs = 10_000) {
  const [toast, setToast] = useState<ToastState>({ message: null, visible: false });

  useEffect(() => {
    if (!toast.message) {
      return;
    }

    setToast((current) => ({ ...current, visible: true }));
    const timeout = window.setTimeout(() => {
      setToast({ message: null, visible: false });
    }, durationMs);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [toast.message, durationMs]);

  const showToast = (message: string) => {
    setToast({ message, visible: true });
  };

  const hideToast = () => {
    setToast({ message: null, visible: false });
  };

  return { toast, showToast, hideToast } as const;
}
