import { createRoot } from 'react-dom/client';
import { Capacitor } from '@capacitor/core';
import '@fontsource/lilita-one/latin-400.css';
import '@fontsource/nunito/latin-600.css';
import '@fontsource/nunito/latin-700.css';
import '@fontsource/nunito/latin-800.css';
import '@fontsource/nunito/latin-900.css';
import App from './App';
import { ErrorBoundary, installErrorLog } from './ui/ErrorBoundary';
import './styles.css';

installErrorLog();
createRoot(document.getElementById('root')!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>,
);

// Hors ligne : le service worker met tout le jeu en cache dès la première visite (version web publiée).
// Dans l'application Android, les fichiers sont déjà sur l'appareil : pas de service worker, et on
// retire celui qu'une version précédente aurait pu installer.
if ('serviceWorker' in navigator) {
  if (Capacitor.isNativePlatform()) {
    navigator.serviceWorker.getRegistrations().then((rs) => rs.forEach((r) => void r.unregister())).catch(() => {});
    window.caches?.keys().then((ks) => ks.filter((k) => k.startsWith('lexicode-')).forEach((k) => void window.caches.delete(k))).catch(() => {});
  } else if (location.protocol === 'https:' && !location.hostname.endsWith('claude.ai')) {
    window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
  }
}
