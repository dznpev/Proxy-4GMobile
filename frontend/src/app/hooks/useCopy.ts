import { useCallback } from 'react';
import { useI18n } from '../providers/I18nProvider';
import { useToast } from '../providers/ToastProvider';

function fallbackCopy(text: string): boolean {
  const area = document.createElement('textarea');
  area.value = text;
  area.setAttribute('readonly', '');
  area.className = 'copy-fallback';
  document.body.append(area);
  area.select();
  area.setSelectionRange(0, text.length);
  let copied = false;
  try {
    copied = document.execCommand('copy');
  } catch {
    copied = false;
  }
  area.remove();
  return copied;
}

export function useCopy() {
  const { showToast } = useToast();
  const { t } = useI18n();

  return useCallback(
    async (text: string, label = t('actions.copied')) => {
      let copied = false;
      try {
        if (navigator.clipboard && window.isSecureContext) {
          await navigator.clipboard.writeText(text);
          copied = true;
        }
      } catch {
        copied = false;
      }
      if (!copied) copied = fallbackCopy(text);

      if (copied) {
        showToast('success', label, text, 3500);
      } else {
        showToast(
          'error',
          t('toasts.copyFailed.title'),
          t('toasts.copyFailed.message'),
        );
      }
      return copied;
    },
    [showToast, t],
  );
}
