import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Icon } from '../../components/Icon';
import { TOAST_ICONS } from '../../lib/constants';

export type ToastTone = 'success' | 'error' | 'warning' | 'info';

interface ToastItem {
  id: number;
  tone: ToastTone;
  title: string;
  message: string;
  timeout: number;
}

interface ToastContextValue {
  showToast: (tone: ToastTone, title: string, message?: string, timeout?: number) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

interface ToastCardProps {
  toast: ToastItem;
  onDismiss: (id: number) => void;
}

function ToastCard({ toast, onDismiss }: ToastCardProps) {
  const timerRef = useRef<number | null>(null);

  const startTimer = useCallback(
    (delay: number) => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(() => onDismiss(toast.id), delay);
    },
    [onDismiss, toast.id],
  );

  useEffect(() => {
    startTimer(toast.timeout);
    return () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    };
  }, [startTimer, toast.timeout]);

  const pause = () => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const resume = () => {
    if (timerRef.current === null) startTimer(2500);
  };

  return (
    <div
      className={`toast toast-${toast.tone}`}
      role={toast.tone === 'error' ? 'alert' : 'status'}
      onMouseEnter={pause}
      onMouseLeave={resume}
    >
      <span className="toast-icon">
        <Icon name={TOAST_ICONS[toast.tone]} />
      </span>
      <div className="toast-body">
        <p className="toast-title">{toast.title}</p>
        {toast.message ? <p className="toast-message">{toast.message}</p> : null}
      </div>
      <button
        type="button"
        className="toast-close"
        aria-label="Đóng thông báo"
        onClick={() => onDismiss(toast.id)}
      >
        <Icon name="close" />
      </button>
    </div>
  );
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const idRef = useRef(0);
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback(
    (tone: ToastTone, title: string, message = '', timeout = 6000) => {
      const safeTone: ToastTone = TOAST_ICONS[tone] ? tone : 'info';
      const id = idRef.current + 1;
      idRef.current = id;
      setToasts((current) => [
        ...current.slice(-3),
        { id, tone: safeTone, title, message, timeout },
      ]);
    },
    [],
  );

  const value = useMemo(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-region" aria-live="polite" aria-atomic="false">
        {toasts.map((toast) => (
          <ToastCard key={toast.id} toast={toast} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const value = useContext(ToastContext);
  if (!value) throw new Error('useToast must be used inside ToastProvider');
  return value;
}
