import { createRoot } from 'react-dom/client';
import '@fontsource/lilita-one/latin-400.css';
import '@fontsource/nunito/latin-600.css';
import '@fontsource/nunito/latin-700.css';
import '@fontsource/nunito/latin-800.css';
import '@fontsource/nunito/latin-900.css';
import App from './App';
import './styles.css';

createRoot(document.getElementById('root')!).render(<App />);

// Hors ligne : le service worker met le jeu en cache une fois chargé (version web publiée).
if ('serviceWorker' in navigator && location.protocol === 'https:' && !location.hostname.endsWith('claude.ai')) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
}
