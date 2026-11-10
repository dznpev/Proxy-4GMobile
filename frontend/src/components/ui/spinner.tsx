import type React from 'react';
import { cn } from '@/lib/utils';
import { useI18n } from '@/app/providers/I18nProvider';

export function Spinner({
  className,
  ...props
}: React.ComponentProps<'span'>): React.ReactElement {
  const { t } = useI18n();
  return (
    <span
      aria-label={t('common.processing')}
      className={cn(
        'inline-block size-3.5 shrink-0 animate-spin rounded-full border-2 border-current border-r-transparent',
        className,
      )}
      role="status"
      {...props}
    />
  );
}
