import { useEffect, type RefObject } from 'react';

// Les animations d'un SVG se recalculent sur le fil principal à chaque image, même hors de l'écran.
// On les met en pause dès que l'élément sort de la vue (défilement de l'accueil, écran recouvert).
let io: IntersectionObserver | null = null;
const observer = () =>
  (io ??= typeof IntersectionObserver === 'undefined'
    ? null
    : new IntersectionObserver((entries) => {
        for (const e of entries) e.target.classList.toggle('anim-off', !e.isIntersecting);
      }));

export function useOffscreenPause(ref: RefObject<Element | null>) {
  useEffect(() => {
    const el = ref.current;
    const o = observer();
    if (!el || !o) return;
    o.observe(el);
    return () => o.unobserve(el);
  }, [ref]);
}

/** Pause globale quand l'application passe en arrière-plan. */
export function installHiddenPause() {
  const sync = () => document.documentElement.classList.toggle('app-hidden', document.hidden);
  document.addEventListener('visibilitychange', sync);
  sync();
  return () => document.removeEventListener('visibilitychange', sync);
}
