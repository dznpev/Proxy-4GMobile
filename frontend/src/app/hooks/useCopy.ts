import { useCallback } from 'react';
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

  return useCallback(
    async (text: string, label = 'Đã sao chép') => {
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
        showToast('error', 'Không sao chép được', 'Hãy chọn và sao chép nội dung thủ công.');
      }
      return copied;
    },
    [showToast],
  );
}
