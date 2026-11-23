// Effets de victoire : pluie de lettres de la phrase trouvée, chiffres qui défilent.
import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { sfx } from '../sound';

const reduced = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Les lettres de la phrase tombent comme des tuiles, avec le tampon et une note par étoile. */
export function WinFx({ text, stars }: { text: string; stars: number }) {
  const pieces = useMemo(() => {
    const letters = text.normalize('NFD').replace(/[^\p{L}]/gu, '').toUpperCase().split('');
    if (!letters.length || reduced()) return [];
    return Array.from({ length: 34 }, (_, i) => {
      const r = (n: number) => { const x = Math.sin((i + 1) * 9301 + n * 49297) * 233280; return x - Math.floor(x); };
      return {
        ch: letters[i % letters.length],
        kind: r(1) < 0.18 ? 'gold' : r(2) < 0.12 ? 'mint' : '',
        style: {
          left: `${r(3) * 100}%`,
          '--dx': `${(r(4) - 0.5) * 140}px`,
          '--rot': `${(r(5) - 0.5) * 900}deg`,
          '--d': `${2.1 + r(6) * 1.6}s`,
          '--delay': `${0.25 + r(7) * 0.9}s`,
        } as CSSProperties,
      };
    });
  }, [text]);

  useEffect(() => {
    const timers = [setTimeout(() => sfx.stamp(), 160)];
    for (let i = 0; i < stars; i++) timers.push(setTimeout(() => sfx.star(i), 470 + i * 250));
    return () => timers.forEach(clearTimeout);
  }, [stars]);

  if (!pieces.length) return null;
  return (
    <div className="confetti" aria-hidden="true">
      {pieces.map((p, i) => <span key={i} className={p.kind} style={p.style}>{p.ch}</span>)}
    </div>
  );
}

/** Un nombre qui monte jusqu'à sa valeur, comme un compteur mécanique. */
export function CountUp({ to, ms = 900, delay = 350 }: { to: number; ms?: number; delay?: number }) {
  const [n, setN] = useState(reduced() ? to : 0);
  useEffect(() => {
    if (reduced()) { setN(to); return; }
    let raf = 0;
    const t0 = performance.now() + delay;
    const step = (now: number) => {
      const k = Math.min(1, Math.max(0, (now - t0) / ms));
      setN(Math.round(to * (1 - Math.pow(1 - k, 3))));
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [to, ms, delay]);
  return <>{n}</>;
}
