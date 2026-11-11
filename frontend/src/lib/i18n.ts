import en, { type Locale, type TranslationDictionary } from '../locales/en';
import vi from '../locales/vi';

export const CATALOGS: Record<Locale, TranslationDictionary> = { en, vi };
export const DEFAULT_LOCALE: Locale = 'en';

export function isLocale(value: unknown): value is Locale {
  return value === 'en' || value === 'vi';
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

/** Resolves a dot-path key for a locale, falling back to English and then the key. */
export function translate(
  locale: Locale,
  keyPath: string,
  params?: Record<string, string | number>,
): string {
  const template =
    lookup(CATALOGS[locale], keyPath) ??
    lookup(CATALOGS[DEFAULT_LOCALE], keyPath) ??
    keyPath;
  return interpolate(template, params);
}
