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
import en, { type Locale, type TranslationDictionary } from '../../locales/en';
import vi from '../../locales/vi';

export type { Locale };

const CATALOGS: Record<Locale, TranslationDictionary> = { en, vi };
const DEFAULT_LOCALE: Locale = 'en';
const PRIMARY_STORAGE_KEY = 'preferred_language';
const LEGACY_STORAGE_KEY = 'language';

function isLocale(value: unknown): value is Locale {
  return value === 'en' || value === 'vi';
}

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

/** Walks a nested catalog by dot path and returns a string leaf, if any. */
function lookup(source: unknown, keyPath: string): string | null {
  let node: unknown = source;
  for (const segment of keyPath.split('.')) {
    if (typeof node !== 'object' || node === null) return null;
    node = (node as Record<string, unknown>)[segment];
  }
  return typeof node === 'string' ? node : null;
}

/** Replaces `{name}` tokens; unknown placeholders are left untouched. */
function interpolate(
  template: string,
  params?: Record<string, string | number>,
): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) => {
    const value = params[name];
    return value === undefined ? match : String(value);
  });
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
    (keyPath: string, params?: Record<string, string | number>): string => {
      const template =
        lookup(CATALOGS[locale], keyPath) ??
        lookup(CATALOGS[DEFAULT_LOCALE], keyPath) ??
        keyPath;
      return interpolate(template, params);
    },
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
