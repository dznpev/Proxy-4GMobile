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
import { dashboardApi } from '../../api/client';
import { DEFAULT_LOCALE, isLocale, translate } from '../../lib/i18n';
import { setFormatLocale } from '../../lib/format';
import type { Locale } from '../../locales/en';

export type { Locale };

const PRIMARY_STORAGE_KEY = 'preferred_language';
const LEGACY_STORAGE_KEY = 'language';

/** Reads the persisted UI language, accepting both storage keys used in the wild. */
function readStoredLocale(): Locale | null {
  if (typeof window === 'undefined') return null;
  try {
    for (const key of [PRIMARY_STORAGE_KEY, LEGACY_STORAGE_KEY]) {
      const value = window.localStorage.getItem(key);
      if (isLocale(value)) return value;
    }
  } catch {
    // Storage can be unavailable (private mode, disabled cookies, tests).
  }
  return null;
}

function persistLocale(locale: Locale): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(PRIMARY_STORAGE_KEY, locale);
    window.localStorage.setItem(LEGACY_STORAGE_KEY, locale);
  } catch {
    // Persisting locally is best-effort; the in-memory locale still applies.
  }
}

export interface I18nContextValue {
  /** Active UI language. */
  locale: Locale;
  /** Switches language immediately, persists it, and syncs backend settings. */
  setLocale: (nextLocale: Locale) => Promise<void>;
  /** Looks up a dot-path key and interpolates `{placeholder}` params. */
  t: (keyPath: string, params?: Record<string, string | number>) => string;
}

export const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const storedLocaleRef = useRef<Locale | null>(readStoredLocale());
  const [locale, setLocaleState] = useState<Locale>(
    () => storedLocaleRef.current ?? DEFAULT_LOCALE,
  );

  // Keep non-React formatters (dates, relative times, durations) in sync with
  // the active language before any child renders.
  setFormatLocale(locale);

  // Adopt the backend language on first run, but never override an explicit
  // local choice (for example a switch made while the backend was offline).
  useEffect(() => {
    if (storedLocaleRef.current !== null) return;
    let active = true;

    dashboardApi
      .settings()
      .then((payload) => {
        if (!active) return;
        const language = payload?.settings?.language;
        if (!isLocale(language)) return;
        setLocaleState(language);
        persistLocale(language);
      })
      .catch(() => {
        // Offline or unauthenticated: keep the local/default language.
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const setLocale = useCallback(async (nextLocale: Locale): Promise<void> => {
    if (!isLocale(nextLocale)) return;
    setLocaleState(nextLocale);
    persistLocale(nextLocale);

    try {
      await dashboardApi.saveSettings({ language: nextLocale });
    } catch {
      // The UI language is already applied; backend sync is best-effort so a
      // transient API failure never blocks the switcher.
    }
  }, []);

  const t = useCallback(
    (keyPath: string, params?: Record<string, string | number>): string =>
      translate(locale, keyPath, params),
    [locale],
  );

  const value = useMemo<I18nContextValue>(
    () => ({ locale, setLocale, t }),
    [locale, setLocale, t],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const value = useContext(I18nContext);
  if (!value) throw new Error('useI18n must be used inside I18nProvider');
  return value;
}
