import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import { I18nProvider } from './app/providers/I18nProvider';
import { DEFAULT_LOCALE, isLocale, translate } from './lib/i18n';
import type { Locale } from './locales/en';
import './styles/index.css';

function bootLocale(): Locale {
  try {
    const stored =
      window.localStorage.getItem('preferred_language') ??
      window.localStorage.getItem('language');
    if (isLocale(stored)) return stored;
  } catch {
    // localStorage can be unavailable; fall through to the browser language.
  }
  return window.navigator.language?.toLowerCase().startsWith('vi')
    ? 'vi'
    : DEFAULT_LOCALE;
}

const container = document.getElementById('root');
if (!container) {
  throw new Error(translate(bootLocale(), 'boot.missingRoot'));
}

createRoot(container).render(
  <I18nProvider>
    <App />
  </I18nProvider>,
);
