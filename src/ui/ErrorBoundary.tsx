// Filet de sécurité : si un écran plante au rendu, on affiche un message et deux issues
// au lieu d'un écran vide. Textes ici (et non dans i18n.ts) pour qu'ils restent disponibles
// même quand le reste du jeu ne se charge pas correctement.
import { Component, type ErrorInfo, type ReactNode } from 'react';
import type { Lang } from '../engine/types';
import { repairSave, savedLang } from '../storage';

const TEXT: Record<Lang, { title: string; body: string; restart: string; repair: string; repairNote: string }> = {
  fr: {
    title: 'Un problème est survenu',
    body: "Le jeu a rencontré une erreur et n'a pas pu afficher cet écran.",
    restart: 'Relancer',
    repair: 'Réparer mes données',
    repairNote: "La réparation vérifie ta sauvegarde et remet à zéro ce qui est abîmé. Une copie de l'ancienne reste sur l'appareil.",
  },
  en: {
    title: 'Something went wrong',
    body: 'The game ran into an error and could not show this screen.',
    restart: 'Restart',
    repair: 'Repair my data',
    repairNote: 'Repair checks your save and resets anything damaged. A copy of the old one stays on this device.',
  },
  es: {
    title: 'Algo salió mal',
    body: 'El juego encontró un error y no pudo mostrar esta pantalla.',
    restart: 'Reiniciar',
    repair: 'Reparar mis datos',
    repairNote: 'La reparación revisa tu partida guardada y restablece lo que esté dañado. Una copia de la anterior se queda en el dispositivo.',
  },
};

function pickLang(): Lang {
  const saved = savedLang();
  if (saved) return saved;
  const nav = (typeof navigator !== 'undefined' ? navigator.language : '').slice(0, 2).toLowerCase();
  return nav === 'fr' || nav === 'es' ? nav : 'en';
}

/** Garde la dernière erreur sur l'appareil, pour pouvoir la retrouver en cas de signalement. */
export function logError(kind: string, e: unknown): void {
  const msg = e instanceof Error ? `${e.name}: ${e.message}\n${e.stack ?? ''}` : String(e);
  console.error(`[lexicode] ${kind}`, e);
  try {
    localStorage.setItem('lexicode.lastError', JSON.stringify({ at: new Date().toISOString(), kind, msg: msg.slice(0, 2000) }));
  } catch {
    // stockage indisponible
  }
}

export function installErrorLog(): void {
  window.addEventListener('error', (e) => logError('error', e.error ?? e.message));
  window.addEventListener('unhandledrejection', (e) => logError('rejection', e.reason));
}

export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    logError('render', `${error?.stack ?? error}\n${info.componentStack ?? ''}`);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    const t = TEXT[pickLang()];
    return (
      <div role="alert" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 14, padding: '24px 20px', maxWidth: 420, margin: '0 auto', boxSizing: 'border-box', textAlign: 'center' }}>
        <h1 style={{ fontFamily: "'Lilita One', sans-serif", fontWeight: 400, fontSize: 26, margin: 0 }}>{t.title}</h1>
        <p style={{ margin: 0, opacity: 0.85 }}>{t.body}</p>
        <button className="btn primary block lg" onClick={() => location.reload()}>{t.restart}</button>
        <button
          className="btn ghost block"
          onClick={() => {
            repairSave();
            location.reload();
          }}
        >
          {t.repair}
        </button>
        <p style={{ margin: 0, fontSize: 13, opacity: 0.7 }}>{t.repairNote}</p>
      </div>
    );
  }
}
