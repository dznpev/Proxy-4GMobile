import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  type ReactNode,
} from 'react';
import {
  ToastProvider as PrimitiveToastProvider,
  toastManager,
} from '../../components/ui/toast';
import { TOAST_ICONS } from '../../lib/constants';

export type ToastTone = 'success' | 'error' | 'warning' | 'info';

interface ToastContextValue {
  showToast: (
    tone: ToastTone,
    title: string,
    message?: string,
    timeout?: number,
  ) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const showToast = useCallback(
    (
      tone: ToastTone,
      title: string,
      message = '',
      timeout = 6000,
    ) => {
      const safeTone: ToastTone = TOAST_ICONS[tone] ? tone : 'info';
      toastManager.add({
        description: message || undefined,
        priority: safeTone === 'error' ? 'high' : 'low',
        timeout,
        title,
        type: safeTone,
      });
    },
    [],
  );

  const value = useMemo(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={value}>
      <PrimitiveToastProvider limit={4} position="bottom-right" timeout={6000}>
        {children}
      </PrimitiveToastProvider>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const value = useContext(ToastContext);
  if (!value) throw new Error('useToast must be used inside ToastProvider');
  return value;
}
