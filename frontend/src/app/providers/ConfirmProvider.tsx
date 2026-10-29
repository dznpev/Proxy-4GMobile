import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Icon } from '../../components/Icon';
import {
  AlertDialog,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogPopup,
  AlertDialogTitle,
} from '../../components/ui/alert-dialog';
import { Button } from '../../components/ui/button';
import { cn } from '../../lib/utils';

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
  const [options, setOptions] = useState<Required<ConfirmOptions> | null>(null);
  const resolverRef = useRef<((value: boolean) => void) | null>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);

  const settle = useCallback((accepted: boolean) => {
    const resolve = resolverRef.current;
    resolverRef.current = null;
    setOptions(null);
    resolve?.(accepted);
  }, []);

  const confirmAction = useCallback<ConfirmAction>((next = {}) => {
    if (resolverRef.current) return Promise.resolve(false);
    triggerRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve;
      setOptions({ ...DEFAULTS, ...next });
    });
  }, []);

  const value = useMemo(() => ({ confirmAction }), [confirmAction]);
  const isDanger = options?.tone === 'danger';

  return (
    <ConfirmContext.Provider value={value}>
      {children}
      <AlertDialog
        open={options !== null}
        onOpenChange={(open) => {
          if (!open) settle(false);
        }}
      >
        <AlertDialogPopup
          finalFocus={() =>
            triggerRef.current?.isConnected ? triggerRef.current : null
          }
          initialFocus={isDanger ? cancelRef : confirmRef}
        >
          <AlertDialogHeader>
            <div
              aria-hidden="true"
              className={cn(
                'mb-1 grid size-9 place-items-center rounded-full',
                isDanger
                  ? 'bg-destructive/8 text-destructive-foreground'
                  : 'bg-muted text-muted-foreground',
              )}
            >
              <Icon name="alert" className="size-[17px]" />
            </div>
            <AlertDialogTitle>
              {options?.title ?? DEFAULTS.title}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {options?.description ?? DEFAULTS.description}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button
              ref={cancelRef}
              variant="outline"
              onClick={() => settle(false)}
            >
              Hủy
            </Button>
            <Button
              ref={confirmRef}
              variant={isDanger ? 'destructive' : 'default'}
              onClick={() => settle(true)}
            >
              {options?.confirmLabel ?? DEFAULTS.confirmLabel}
            </Button>
          </AlertDialogFooter>
        </AlertDialogPopup>
      </AlertDialog>
    </ConfirmContext.Provider>
  );
}

export function useConfirm(): ConfirmContextValue {
  const value = useContext(ConfirmContext);
  if (!value) throw new Error('useConfirm must be used inside ConfirmProvider');
  return value;
}
