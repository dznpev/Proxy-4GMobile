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

type ConfirmTone = 'danger' | 'primary' | 'secondary';

export interface ConfirmOptions {
  title?: string;
  description?: string;
  confirmLabel?: string;
  tone?: ConfirmTone;
}

type ConfirmAction = (options?: ConfirmOptions) => Promise<boolean>;

interface ConfirmContextValue {
  confirmAction: ConfirmAction;
}

const ConfirmContext = createContext<ConfirmContextValue | null>(null);

const DEFAULTS: Required<ConfirmOptions> = {
  title: 'Xác nhận thao tác',
  description: 'Thao tác này không thể hoàn tác.',
  confirmLabel: 'Xác nhận',
  tone: 'danger',
};

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const resolverRef = useRef<((value: boolean) => void) | null>(null);
  const [options, setOptions] = useState<Required<ConfirmOptions> | null>(null);

  const confirmAction = useCallback<ConfirmAction>((next = {}) => {
    if (dialogRef.current?.open) return Promise.resolve(false);
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve;
      setOptions({ ...DEFAULTS, ...next });
    });
  }, []);

  useEffect(() => {
    if (!options) return;
    const dialog = dialogRef.current;
    if (!dialog || typeof dialog.showModal !== 'function') {
      const accepted = window.confirm(options.description || options.title);
      resolverRef.current?.(accepted);
      resolverRef.current = null;
      setOptions(null);
      return;
    }

    dialog.returnValue = '';
    dialog.showModal();
    const timer = window.setTimeout(() => {
      const target =
        options.tone === 'danger'
          ? dialog.querySelector<HTMLButtonElement>('#dialog-cancel')
          : dialog.querySelector<HTMLButtonElement>('#dialog-confirm');
      target?.focus();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [options]);

  const handleClose = () => {
    const accepted = dialogRef.current?.returnValue === 'confirm';
    resolverRef.current?.(accepted);
    resolverRef.current = null;
    setOptions(null);
  };

  const value = useMemo(() => ({ confirmAction }), [confirmAction]);

  return (
    <ConfirmContext.Provider value={value}>
      {children}
      <dialog
        ref={dialogRef}
        className="dialog"
        aria-labelledby="dialog-title"
        aria-describedby="dialog-description"
        onClose={handleClose}
      >
        <form method="dialog" className="dialog-form">
          <div className="dialog-icon" aria-hidden="true">
            <Icon name="alert" />
          </div>
          <h2 id="dialog-title">{options?.title ?? DEFAULTS.title}</h2>
          <p id="dialog-description">{options?.description ?? DEFAULTS.description}</p>
          <div className="dialog-actions">
            <button className="btn btn-secondary" id="dialog-cancel" value="cancel">
              Hủy
            </button>
            <button
              className={`btn btn-${options?.tone ?? 'danger'}`}
              id="dialog-confirm"
              value="confirm"
            >
              {options?.confirmLabel ?? DEFAULTS.confirmLabel}
            </button>
          </div>
        </form>
      </dialog>
    </ConfirmContext.Provider>
  );
}

export function useConfirm(): ConfirmContextValue {
  const value = useContext(ConfirmContext);
  if (!value) throw new Error('useConfirm must be used inside ConfirmProvider');
  return value;
}
