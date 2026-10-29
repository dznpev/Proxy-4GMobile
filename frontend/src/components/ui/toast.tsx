import { Toast } from '@base-ui/react/toast';
import type React from 'react';
import { Icon } from '@/components/Icon';
import { TOAST_ICONS } from '@/lib/constants';
import { cn } from '@/lib/utils';

type SwipeDirection = 'up' | 'down' | 'left' | 'right';

export type ToastPosition =
  | 'top-left'
  | 'top-center'
  | 'top-right'
  | 'bottom-left'
  | 'bottom-center'
  | 'bottom-right';

const TONE_TEXT_CLASSES: Record<string, string> = {
  error: 'text-destructive-foreground',
  info: 'text-info-foreground',
  loading: 'text-muted-foreground',
  success: 'text-success-foreground',
  warning: 'text-warning-foreground',
};

function getSwipeDirection(position: ToastPosition): SwipeDirection[] {
  const verticalDirection: SwipeDirection = position.startsWith('top')
    ? 'up'
    : 'down';

  if (position.includes('center')) {
    return [verticalDirection];
  }

  if (position.includes('left')) {
    return ['left', verticalDirection];
  }

  return ['right', verticalDirection];
}

function Toasts({
  position,
  portalProps,
}: {
  position: ToastPosition;
  portalProps?: React.ComponentProps<typeof Toast.Portal>;
}): React.ReactElement {
  const { toasts } = Toast.useToastManager();
  const swipeDirection = getSwipeDirection(position);

  return (
    <Toast.Portal data-slot="toast-portal" {...portalProps}>
      <Toast.Viewport
        className={cn(
          'fixed z-[80] mx-auto flex w-[calc(100%_-_var(--toast-inset)*2)] max-w-[370px] [--toast-inset:--spacing(4)] sm:[--toast-inset:--spacing(5)]',
          'data-[position*=top]:top-(--toast-inset)',
          'data-[position*=bottom]:bottom-(--toast-inset)',
          'data-[position*=left]:left-(--toast-inset)',
          'data-[position*=right]:right-(--toast-inset)',
          'data-[position*=center]:left-1/2 data-[position*=center]:-translate-x-1/2',
        )}
        data-position={position}
        data-slot="toast-viewport"
      >
        {toasts.map((toast) => {
          const type = toast.type ?? 'info';
          const iconName = TOAST_ICONS[type] ?? TOAST_ICONS.info;

          return (
            <Toast.Root
              key={toast.id}
              className={cn(
                'absolute z-[calc(9999-var(--toast-index))] h-(--toast-calc-height) w-full select-none rounded-lg border border-border border-l-[3px] border-l-info bg-card text-card-foreground [box-shadow:var(--shadow-overlay)] [transition:transform_.5s_cubic-bezier(.22,1,.36,1),opacity_.5s,height_.15s,background-color_.5s]',
                'data-[type=error]:border-l-destructive data-[type=info]:border-l-info data-[type=loading]:border-l-info data-[type=success]:border-l-success data-[type=warning]:border-l-warning',
                'data-[position*=right]:right-0 data-[position*=right]:left-auto',
                'data-[position*=left]:right-auto data-[position*=left]:left-0',
                'data-[position*=center]:right-0 data-[position*=center]:left-0',
                'data-[position*=top]:top-0 data-[position*=top]:bottom-auto data-[position*=top]:origin-[50%_calc(50%_-_50%*min(var(--toast-index,0),1))]',
                'data-[position*=bottom]:top-auto data-[position*=bottom]:bottom-0 data-[position*=bottom]:origin-[50%_calc(50%_+_50%*min(var(--toast-index,0),1))]',
                'after:absolute after:left-0 after:h-[calc(var(--toast-gap)_+_1px)] after:w-full',
                'data-[position*=top]:after:top-full',
                'data-[position*=bottom]:after:bottom-full',
                '[--toast-calc-height:var(--toast-frontmost-height,var(--toast-height))] [--toast-gap:--spacing(3)] [--toast-peek:--spacing(3)] [--toast-scale:calc(max(0,1-(var(--toast-index)*.1)))] [--toast-shrink:calc(1-var(--toast-scale))]',
                'data-[position*=top]:[--toast-calc-offset-y:calc(var(--toast-offset-y)_+_var(--toast-index)*var(--toast-gap)_+_var(--toast-swipe-movement-y))]',
                'data-[position*=bottom]:[--toast-calc-offset-y:calc(var(--toast-offset-y)*-1_+_var(--toast-index)*var(--toast-gap)*-1_+_var(--toast-swipe-movement-y))]',
                'data-[position*=top]:transform-[translateX(var(--toast-swipe-movement-x))_translateY(calc(var(--toast-swipe-movement-y)_+_(var(--toast-index)*var(--toast-peek))_+_(var(--toast-shrink)*var(--toast-calc-height))))_scale(var(--toast-scale))]',
                'data-[position*=bottom]:transform-[translateX(var(--toast-swipe-movement-x))_translateY(calc(var(--toast-swipe-movement-y)_-_(var(--toast-index)*var(--toast-peek))_-_(var(--toast-shrink)*var(--toast-calc-height))))_scale(var(--toast-scale))]',
                'data-limited:opacity-0',
                'data-expanded:h-(--toast-height)',
                'data-position:data-expanded:transform-[translateX(var(--toast-swipe-movement-x))_translateY(var(--toast-calc-offset-y))]',
                'motion-safe:data-[position*=top]:data-starting-style:transform-[translateY(calc(-100%_-_var(--toast-inset)))]',
                'motion-safe:data-[position*=bottom]:data-starting-style:transform-[translateY(calc(100%_+_var(--toast-inset)))]',
                'data-ending-style:opacity-0',
                'motion-reduce:data-starting-style:opacity-0 motion-reduce:[transition:opacity_.5s,height_.15s,background-color_.5s]',
                'motion-safe:data-[position*=top]:data-ending-style:not-data-limited:not-data-swipe-direction:transform-[translateY(calc(-100%_-_var(--toast-inset)))]',
                'motion-safe:data-[position*=bottom]:data-ending-style:not-data-limited:not-data-swipe-direction:transform-[translateY(calc(100%_+_var(--toast-inset)))]',
                'data-ending-style:data-[swipe-direction=left]:transform-[translateX(calc(var(--toast-swipe-movement-x)_-_100%_-_var(--toast-inset)))_translateY(var(--toast-calc-offset-y))]',
                'data-ending-style:data-[swipe-direction=right]:transform-[translateX(calc(var(--toast-swipe-movement-x)_+_100%_+_var(--toast-inset)))_translateY(var(--toast-calc-offset-y))]',
                'data-ending-style:data-[swipe-direction=up]:transform-[translateY(calc(var(--toast-swipe-movement-y)_-_100%_-_var(--toast-inset)))]',
                'data-ending-style:data-[swipe-direction=down]:transform-[translateY(calc(var(--toast-swipe-movement-y)_+_100%_+_var(--toast-inset)))]',
              )}
              data-position={position}
              swipeDirection={swipeDirection}
              toast={toast}
            >
              <Toast.Content className="pointer-events-auto flex items-start justify-between gap-1.5 overflow-hidden px-2.5 py-2.5 text-sm transition-opacity duration-200 data-behind:not-data-expanded:pointer-events-none data-behind:opacity-0 data-expanded:opacity-100">
                <div className="flex min-w-0 gap-2">
                  <span
                    className={cn(
                      'mt-px shrink-0',
                      TONE_TEXT_CLASSES[type] ?? TONE_TEXT_CLASSES.info,
                    )}
                    data-slot="toast-icon"
                  >
                    <Icon name={iconName} className="size-[15px]" />
                  </span>

                  <div className="flex min-w-0 flex-col gap-0.5">
                    {toast.title ? (
                      <Toast.Title
                        className="font-semibold"
                        data-slot="toast-title"
                      />
                    ) : null}
                    {toast.description ? (
                      <Toast.Description
                        className="text-muted-foreground [overflow-wrap:anywhere]"
                        data-slot="toast-description"
                      />
                    ) : null}
                  </div>
                </div>

                <Toast.Close
                  aria-label="Đóng thông báo"
                  className="-mt-0.5 -mr-0.5 inline-flex size-6 shrink-0 items-center justify-center rounded-[4px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  type="button"
                >
                  <Icon name="close" className="size-3.5" />
                </Toast.Close>
              </Toast.Content>
            </Toast.Root>
          );
        })}
      </Toast.Viewport>
    </Toast.Portal>
  );
}

export const toastManager: ReturnType<typeof Toast.createToastManager> =
  Toast.createToastManager();

export interface ToastProviderProps extends Toast.Provider.Props {
  position?: ToastPosition;
  portalProps?: React.ComponentProps<typeof Toast.Portal>;
}

export function ToastProvider({
  children,
  position = 'bottom-right',
  portalProps,
  limit = 4,
  timeout = 6000,
  ...props
}: ToastProviderProps): React.ReactElement {
  return (
    <Toast.Provider
      limit={limit}
      timeout={timeout}
      toastManager={toastManager}
      {...props}
    >
      {children}
      <Toasts portalProps={portalProps} position={position} />
    </Toast.Provider>
  );
}

export { Toast as ToastPrimitive };
