import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import { I18nProvider } from './app/providers/I18nProvider';
import './styles/index.css';

const container = document.getElementById('root');
if (!container) {
  throw new Error('Không tìm thấy phần tử gốc của dashboard.');
}

createRoot(container).render(
  <I18nProvider>
    <App />
  </I18nProvider>,
);
