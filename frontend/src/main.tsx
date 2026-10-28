import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import './styles/index.css';

const container = document.getElementById('root');
if (!container) {
  throw new Error('Không tìm thấy phần tử gốc của dashboard.');
}

createRoot(container).render(<App />);
