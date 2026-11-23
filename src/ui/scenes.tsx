// Décors illustrés, dessinés en SVG. Ils prennent les couleurs du thème courant
// (variables CSS), donc chaque chapitre repeint sa scène sans asset supplémentaire.
import { useId, type CSSProperties, type ReactNode } from 'react';

export type SceneKind =
  | 'home' | 'atelier' | 'library' | 'train' | 'archives'
  | 'observatory' | 'machines' | 'tower' | 'cabinet' | 'expedition' | 'xmas';
export type SceneDecor = 'xmas';

const W = 400;
const H = 180;
const v = (name: string) => `var(--${name})`;
const fill = (c: string, opacity?: number): CSSProperties => ({ fill: c, ...(opacity !== undefined ? { opacity } : {}) });

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Ligne de toits : pignons, toits plats, cheminées. */
function skyline(seed: number, base: number, min: number, max: number): { d: string; tops: { x: number; w: number; y: number }[] } {
  const r = rng(seed);
  let x = -12;
  let d = `M${x},${H}`;
  const tops: { x: number; w: number; y: number }[] = [];
  while (x < W + 12) {
    const w = 22 + r() * 30;
    const y = base - (min + r() * (max - min));
    const kind = r();
    d += ` L${x},${y}`;
    if (kind < 0.35) d += ` L${x + w / 2},${y - 9 - r() * 8} L${x + w},${y}`;
    else if (kind < 0.6) {
      const cx = x + w * (0.2 + r() * 0.5);
      d += ` L${cx},${y} L${cx},${y - 9} L${cx + 6},${y - 9} L${cx + 6},${y} L${x + w},${y}`;
    } else d += ` L${x + w},${y}`;
    tops.push({ x, w, y });
    x += w;
  }
  d += ` L${x},${H} Z`;
  return { d, tops };
}

/** Roue dentée. */
function gear(cx: number, cy: number, r: number, teeth: number, depth = 0.18): string {
  const pts: string[] = [];
  const step = (Math.PI * 2) / teeth;
  for (let i = 0; i < teeth; i++) {
    const a = i * step;
    const ro = r, ri = r * (1 - depth);
    const p = (ang: number, rad: number) => `${(cx + Math.cos(ang) * rad).toFixed(1)},${(cy + Math.sin(ang) * rad).toFixed(1)}`;
    pts.push(p(a - step * 0.22, ri), p(a - step * 0.14, ro), p(a + step * 0.14, ro), p(a + step * 0.22, ri));
  }
  return `M${pts.join(' L')} Z M${cx + r * 0.32},${cy} A${r * 0.32},${r * 0.32} 0 1,0 ${cx - r * 0.32},${cy} A${r * 0.32},${r * 0.32} 0 1,0 ${cx + r * 0.32},${cy} Z`;
}

function Stars({ seed, n, maxY = 110, big = false }: { seed: number; n: number; maxY?: number; big?: boolean }) {
  const r = rng(seed);
  return (
    <g>
      {Array.from({ length: n }, (_, i) => {
        const size = r() < (big ? 0.25 : 0.12) ? 1.6 : 0.9;
        return (
          <circle key={i} className="sc-tw" cx={r() * W} cy={r() * maxY} r={size}
            style={{ ...fill(v('bone')), animationDelay: `${(r() * 5).toFixed(2)}s`, animationDuration: `${(2.6 + r() * 3).toFixed(2)}s` }} />
        );
      })}
    </g>
  );
}

function Moon({ x, y, r, id }: { x: number; y: number; r: number; id: string }) {
  return (
    <g>
      <circle cx={x} cy={y} r={r * 3.2} fill={`url(#${id}-halo)`} />
      <circle cx={x} cy={y} r={r} style={fill(v('bone'), 0.92)} />
      <circle cx={x + r * 0.35} cy={y - r * 0.25} r={r * 0.22} style={fill(v('mist'), 0.35)} />
      <circle cx={x - r * 0.3} cy={y + r * 0.35} r={r * 0.14} style={fill(v('mist'), 0.3)} />
    </g>
  );
}

function Defs({ id }: { id: string }) {
  return (
    <defs>
      <linearGradient id={`${id}-sky`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" style={{ stopColor: v('abyss') }} />
        <stop offset="1" style={{ stopColor: v('tide-2') }} />
      </linearGradient>
      <radialGradient id={`${id}-halo`}>
        <stop offset="0" style={{ stopColor: v('bone'), stopOpacity: 0.14 }} />
        <stop offset="0.55" style={{ stopColor: v('bone'), stopOpacity: 0.14 }} />
        <stop offset="0.55" style={{ stopColor: v('bone'), stopOpacity: 0.06 }} />
        <stop offset="1" style={{ stopColor: v('bone'), stopOpacity: 0.06 }} />
      </radialGradient>
      <radialGradient id={`${id}-lamp`}>
        <stop offset="0" style={{ stopColor: v('brass-hi'), stopOpacity: 0.42 }} />
        <stop offset="0.3" style={{ stopColor: v('brass-hi'), stopOpacity: 0.42 }} />
        <stop offset="0.3" style={{ stopColor: v('brass'), stopOpacity: 0.2 }} />
        <stop offset="0.6" style={{ stopColor: v('brass'), stopOpacity: 0.2 }} />
        <stop offset="0.6" style={{ stopColor: v('brass'), stopOpacity: 0.08 }} />
        <stop offset="1" style={{ stopColor: v('brass'), stopOpacity: 0.08 }} />
      </radialGradient>
      <linearGradient id={`${id}-cone`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" style={{ stopColor: v('brass-hi'), stopOpacity: 0.55 }} />
        <stop offset="1" style={{ stopColor: v('brass'), stopOpacity: 0 }} />
      </linearGradient>
      <linearGradient id={`${id}-ember`} x1="0" y1="1" x2="0" y2="0">
        <stop offset="0" style={{ stopColor: v('cinnabar'), stopOpacity: 0.7 }} />
        <stop offset="0.5" style={{ stopColor: v('brass'), stopOpacity: 0.18 }} />
        <stop offset="1" style={{ stopColor: v('brass'), stopOpacity: 0 }} />
      </linearGradient>
      <filter id={`${id}-grain`} x="0" y="0" width="100%" height="100%">
        <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch" />
        <feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.55 0" />
      </filter>
      <radialGradient id={`${id}-vig`} cx="0.5" cy="0.45" r="0.75">
        <stop offset="0.6" stopColor="#000" stopOpacity="0" />
        <stop offset="1" stopColor="#000" stopOpacity="0.45" />
      </radialGradient
      >
      <linearGradient id={`${id}-wall`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" style={{ stopColor: v('deep') }} />
        <stop offset="1" style={{ stopColor: v('tide') }} />
      </linearGradient>
    </defs>
  );
}

/** Fenêtre allumée : le signe que quelqu'un chiffre encore. */
function LitWindow({ x, y, w, h, id }: { x: number; y: number; w: number; h: number; id: string }) {
  return (
    <g>
      <circle className="sc-flick" cx={x + w / 2} cy={y + h / 2} r={w * 2.6} fill={`url(#${id}-lamp)`} />
      <rect x={x} y={y} width={w} height={h} rx={1.5} style={fill(v('brass-hi'))} />
      <rect x={x + w / 2 - 0.7} y={y} width={1.4} height={h} style={fill(v('abyss'), 0.55)} />
      <rect x={x} y={y + h * 0.48} width={w} height={1.4} style={fill(v('abyss'), 0.55)} />
      <path d={`M${x + w * 0.62},${y + h - 1} l3,-5 l2,0 l-1,5 Z`} style={fill(v('abyss'), 0.6)} />
    </g>
  );
}

function Home({ id }: { id: string }) {
  const far = skyline(11, 150, 18, 52);
  const near = skyline(23, 176, 14, 40);
  const r = rng(5);
  return (
    <>
      <rect width={W} height={H} fill={`url(#${id}-sky)`} />
      <Stars seed={3} n={46} maxY={100} />
      <Moon x={326} y={40} r={13} id={id} />
      <ellipse cx={200} cy={176} rx={260} ry={70} fill={`url(#${id}-lamp)`} opacity={0.35} />
      <path d={far.d} style={fill(v('abyss'), 0.55)} />
      {far.tops.filter(() => r() < 0.35).map((t, i) => (
        <rect key={i} x={t.x + t.w * 0.35} y={t.y + 10} width={4} height={5} style={fill(v('brass'), 0.25)} />
      ))}
      <path d="M150,180 L150,62 L176,46 L202,62 L202,180 Z" style={fill(v('abyss'))} />
      <rect x={172} y={36} width={7} height={16} style={fill(v('abyss'))} />
      <LitWindow x={168} y={76} w={16} h={22} id={id} />
      <rect x={160} y={116} width={6} height={9} style={fill(v('tide-2'), 0.6)} />
      <rect x={186} y={116} width={6} height={9} style={fill(v('tide-2'), 0.6)} />
      <path d={near.d} style={fill(v('abyss'))} />
      <path className="sc-cloud" d="M-60,58 q14,-12 30,-4 q10,-10 24,-2 q14,-2 16,8 Z" style={fill(v('mist'), 0.12)} />
    </>
  );
}

function Atelier({ id }: { id: string }) {
  return (
    <>
      <rect width={W} height={H} fill={`url(#${id}-wall)`} />
      <g>
        <path d="M40,130 L40,52 A36,36 0 0,1 112,52 L112,130 Z" style={fill(v('abyss'))} />
        <clipPath id={`${id}-win`}><path d="M44,126 L44,52 A32,32 0 0,1 108,52 L108,126 Z" /></clipPath>
        <g clipPath={`url(#${id}-win)`}>
          <rect x={40} y={16} width={72} height={114} fill={`url(#${id}-sky)`} />
          <Stars seed={9} n={14} maxY={120} />
          <circle cx={88} cy={44} r={8} style={fill(v('bone'), 0.9)} />
        </g>
        <rect x={75} y={20} width={2.5} height={110} style={fill(v('abyss'))} />
        <rect x={40} y={84} width={72} height={2.5} style={fill(v('abyss'))} />
      </g>
      <path className="sc-spin" d={gear(300, 52, 26, 12)} style={fill(v('tide-2'), 0.8)} fillRule="evenodd" />
      <path className="sc-spin-rev" d={gear(341, 82, 17, 9)} style={fill(v('tide-2'), 0.6)} fillRule="evenodd" />
      <path className="sc-flick" d="M232,64 L196,150 L300,150 L254,64 Z" fill={`url(#${id}-cone)`} />
      <path d="M226,46 L262,46 L254,64 L234,64 Z" style={fill(v('brass-lo'))} />
      <rect x={242} y={30} width={3} height={18} style={fill(v('abyss'))} />
      <rect x={232} y={28} width={30} height={3} rx={1.5} style={fill(v('abyss'))} />
      <rect y={148} width={W} height={32} style={fill(v('abyss'))} />
      <rect x={0} y={146} width={W} height={4} style={fill(v('tide-2'), 0.6)} />
      <rect x={214} y={136} width={42} height={12} rx={1} transform="rotate(-4 235 142)" style={fill(v('bone'), 0.85)} />
      <rect x={236} y={132} width={38} height={14} rx={1} transform="rotate(6 255 139)" style={fill(v('bone'), 0.7)} />
      {[0, 1, 2, 3, 4].map((i) => <rect key={i} x={242 + i * 6} y={137} width={4} height={1.5} transform="rotate(6 255 139)" style={fill(v('abyss'), 0.6)} />)}
    </>
  );
}

function Library({ id }: { id: string }) {
  const r = rng(17);
  const colors = [v('brass-lo'), v('tide-2'), v('cinnabar'), v('mist'), v('brass')];
  const bays = [20, 150, 280];
  return (
    <>
      <rect width={W} height={H} style={fill(v('abyss'))} />
      {bays.map((bx, b) => (
        <g key={b}>
          <path d={`M${bx},180 L${bx},50 A50,40 0 0,1 ${bx + 100},50 L${bx + 100},180 Z`} style={fill(v('deep'))} />
          {[66, 98, 130, 162].map((sy, s) => {
            let x = bx + 8;
            const books: ReactNode[] = [];
            while (x < bx + 92) {
              const w = 4 + r() * 6;
              const h = 18 + r() * 9;
              books.push(<rect key={`${s}-${x}`} x={x} y={sy - h} width={w - 1} height={h} rx={0.8} style={fill(colors[Math.floor(r() * colors.length)], 0.55 + r() * 0.35)} />);
              x += w;
            }
            return <g key={s}>{books}<rect x={bx + 4} y={sy} width={92} height={3} style={fill(v('tide-2'))} /></g>;
          })}
        </g>
      ))}
      <g style={{ stroke: v('brass-lo'), strokeWidth: 3 }}>
        <line x1={236} y1={40} x2={262} y2={180} />
        <line x1={256} y1={40} x2={282} y2={180} />
        {[60, 85, 110, 135, 160].map((y) => <line key={y} x1={236 + (y - 40) * 0.186} y1={y} x2={256 + (y - 40) * 0.186} y2={y} />)}
      </g>
      <line x1={200} y1={0} x2={200} y2={26} style={{ stroke: v('tide-2'), strokeWidth: 1.5 }} />
      <circle className="sc-flick" cx={200} cy={34} r={60} fill={`url(#${id}-lamp)`} />
      <path d="M190,26 L210,26 L206,36 L194,36 Z" style={fill(v('brass'))} />
    </>
  );
}

function Train({ id }: { id: string }) {
  const arches = Array.from({ length: 9 }, (_, i) => -10 + i * 50);
  return (
    <>
      <rect width={W} height={H} fill={`url(#${id}-sky)`} />
      <Stars seed={21} n={40} maxY={90} />
      <Moon x={70} y={36} r={11} id={id} />
      <path d="M0,120 L50,84 L92,108 L150,66 L214,112 L268,78 L330,110 L400,82 L400,180 L0,180 Z" style={fill(v('abyss'), 0.6)} />
      <path d={`M0,128 L400,128 L400,180 L0,180 Z ${arches.map((x) => `M${x + 8},180 L${x + 8},152 A17,17 0 0,1 ${x + 42},152 L${x + 42},180 Z`).join(' ')}`} style={fill(v('abyss'))} fillRule="evenodd" />
      <rect y={124} width={W} height={4} style={fill(v('tide-2'))} />
      <g className="sc-ride">
        {[0, 1, 2, 3].map((c) => (
          <g key={c} transform={`translate(${c * 56},0)`}>
            <rect x={0} y={102} width={52} height={22} rx={3} style={fill(v('abyss'))} />
            {[0, 1, 2, 3].map((w) => <rect key={w} x={5 + w * 12} y={107} width={8} height={7} rx={1} style={fill(v('brass-hi'), 0.9)} />)}
          </g>
        ))}
        <g transform="translate(224,0)">
          <path d="M0,124 L0,98 L30,98 L30,86 L44,86 L44,98 L58,108 L58,124 Z" style={fill(v('abyss'))} />
          <rect x={8} y={88} width={6} height={10} style={fill(v('abyss'))} />
          <circle cx={58} cy={112} r={5} style={fill(v('brass-hi'))} />
          <circle className="sc-puff" cx={11} cy={80} r={6} style={fill(v('mist'), 0.25)} />
        </g>
      </g>
    </>
  );
}

function Archives({ id }: { id: string }) {
  const r = rng(31);
  return (
    <>
      <rect width={W} height={H} style={fill(v('abyss'))} />
      {Array.from({ length: 7 }, (_, col) => (
        <g key={col}>
          <rect x={8 + col * 56} y={20} width={50} height={160} style={fill(v('deep'))} />
          {Array.from({ length: 5 }, (_, row) => (
            <g key={row}>
              <rect x={12 + col * 56} y={26 + row * 30} width={42} height={25} rx={2} style={fill(v('tide'))} />
              <rect x={26 + col * 56} y={31 + row * 30} width={14} height={6} rx={1} style={fill(v('bone'), 0.55)} />
              <rect x={29 + col * 56} y={43 + row * 30} width={8} height={2.5} rx={1} style={fill(v('brass-lo'))} />
            </g>
          ))}
        </g>
      ))}
      <rect y={90} width={W} height={90} fill={`url(#${id}-ember)`} className="sc-flick" />
      {Array.from({ length: 16 }, (_, i) => (
        <circle key={i} className="sc-spark" cx={r() * W} cy={170} r={1 + r() * 1.4}
          style={{ ...fill(v('brass-hi')), animationDelay: `${(r() * 4).toFixed(2)}s`, animationDuration: `${(3 + r() * 3).toFixed(2)}s` }} />
      ))}
    </>
  );
}

function Observatory({ id }: { id: string }) {
  return (
    <>
      <rect width={W} height={H} fill={`url(#${id}-sky)`} />
      <Stars seed={41} n={80} maxY={150} big />
      <polyline points="58,40 92,28 120,50 150,34 176,58" style={{ fill: 'none', stroke: v('bone'), strokeOpacity: 0.35, strokeWidth: 0.8 }} />
      {[[58, 40], [92, 28], [120, 50], [150, 34], [176, 58]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r={2} style={fill(v('bone'))} />)}
      <line className="sc-shoot" x1={300} y1={20} x2={330} y2={10} style={{ stroke: v('bone'), strokeWidth: 1.4, strokeLinecap: 'round' }} />
      <path d="M0,160 Q120,136 220,150 T400,142 L400,180 L0,180 Z" style={fill(v('abyss'))} />
      <path d="M232,150 L232,112 A46,46 0 0,1 324,112 L324,150 Z" style={fill(v('deep'))} />
      <path d="M270,70 L286,70 L290,150 L266,150 Z" style={fill(v('brass'), 0.35)} className="sc-flick" />
      <rect x={262} y={74} width={46} height={9} rx={3} transform="rotate(-32 278 96)" style={fill(v('tide-2'))} />
      <rect x={222} y={148} width={112} height={10} style={fill(v('abyss'))} />
    </>
  );
}

function Machines({ id }: { id: string }) {
  return (
    <>
      <rect width={W} height={H} fill={`url(#${id}-wall)`} />
      <g style={{ stroke: v('tide-2'), strokeWidth: 9, fill: 'none', strokeLinecap: 'round' }}>
        <path d="M-10,40 L120,40 Q140,40 140,60 L140,190" />
        <path d="M410,120 L330,120 Q310,120 310,100 L310,-10" />
      </g>
      <path className="sc-spin" d={gear(196, 92, 50, 16)} style={fill(v('brass-lo'))} fillRule="evenodd" />
      <path className="sc-spin-rev" d={gear(270, 52, 30, 11)} style={fill(v('tide-2'))} fillRule="evenodd" />
      <path className="sc-spin-rev" d={gear(118, 134, 34, 12)} style={fill(v('tide-2'))} fillRule="evenodd" />
      <circle cx={196} cy={92} r={8} style={fill(v('brass-hi'))} />
      <circle cx={346} cy={160} r={22} style={fill(v('abyss'))} />
      <circle cx={346} cy={160} r={18} style={fill(v('bone'), 0.85)} />
      <line className="sc-needle" x1={346} y1={160} x2={346} y2={146} style={{ stroke: v('cinnabar'), strokeWidth: 2.2, strokeLinecap: 'round' }} />
      <circle cx={60} cy={30} r={40} fill={`url(#${id}-lamp)`} className="sc-flick" />
    </>
  );
}

function Tower({ id }: { id: string }) {
  const city = skyline(57, 180, 10, 40);
  return (
    <>
      <rect width={W} height={H} fill={`url(#${id}-sky)`} />
      <Stars seed={61} n={36} maxY={100} />
      <g className="sc-sweep" style={{ transformOrigin: '200px 36px' }}>
        <path d="M200,36 L420,6 L420,66 Z" fill={`url(#${id}-cone)`} />
        <path d="M200,36 L-20,6 L-20,66 Z" fill={`url(#${id}-cone)`} />
      </g>
      <path d={city.d} style={fill(v('deep'))} />
      <path d="M178,180 L182,62 L218,62 L222,180 Z" style={fill(v('abyss'))} />
      <path d="M176,62 L200,24 L224,62 Z" style={fill(v('abyss'))} />
      <circle cx={200} cy={36} r={30} fill={`url(#${id}-lamp)`} className="sc-flick" />
      <circle cx={200} cy={38} r={5} style={fill(v('brass-hi'))} />
      <circle cx={200} cy={86} r={13} style={fill(v('brass-hi'), 0.95)} />
      <line x1={200} y1={86} x2={200} y2={77} style={{ stroke: v('abyss'), strokeWidth: 2 }} />
      <line x1={200} y1={86} x2={207} y2={89} style={{ stroke: v('abyss'), strokeWidth: 2 }} />
    </>
  );
}

function Cabinet({ id }: { id: string }) {
  return (
    <>
      <defs>
        <pattern id={`${id}-paper`} width="20" height="20" patternUnits="userSpaceOnUse">
          <path d="M10,2 L18,10 L10,18 L2,10 Z" style={{ fill: 'none', stroke: v('brass-lo'), strokeOpacity: 0.25, strokeWidth: 1 }} />
        </pattern>
      </defs>
      <rect width={W} height={H} style={fill(v('deep'))} />
      <rect width={W} height={H} fill={`url(#${id}-paper)`} />
      <rect x={150} y={18} width={100} height={162} rx={3} style={fill(v('abyss'))} />
      <rect x={158} y={26} width={84} height={154} rx={2} style={fill(v('tide'))} />
      <rect x={166} y={36} width={68} height={56} rx={2} style={{ fill: 'none', stroke: v('tide-2'), strokeWidth: 2 }} />
      <rect x={166} y={104} width={68} height={66} rx={2} style={{ fill: 'none', stroke: v('tide-2'), strokeWidth: 2 }} />
      <circle cx={222} cy={100} r={26} fill={`url(#${id}-lamp)`} className="sc-pulse" />
      <path d="M222,94 m-4.5,0 a4.5,4.5 0 1,1 9,0 a4.5,4.5 0 0,1 -2.5,4 l1.8,8 l-7.6,0 l1.8,-8 a4.5,4.5 0 0,1 -2.5,-4 Z" style={fill(v('brass-hi'))} />
      {[70, 330].map((x) => (
        <g key={x}>
          <circle cx={x} cy={96} r={36} fill={`url(#${id}-lamp)`} className="sc-flick" />
          <rect x={x - 5} y={104} width={10} height={40} rx={2} style={fill(v('bone'), 0.85)} />
          <path className="sc-flame" d={`M${x},86 q6,9 0,18 q-6,-9 0,-18 Z`} style={{ ...fill(v('brass-hi')), transformOrigin: `${x}px 104px` }} />
          <rect x={x - 12} y={144} width={24} height={5} rx={2} style={fill(v('brass-lo'))} />
        </g>
      ))}
    </>
  );
}

function Expedition({ id }: { id: string }) {
  return (
    <>
      <rect width={W} height={H} fill={`url(#${id}-sky)`} />
      <Stars seed={71} n={50} maxY={110} />
      <Moon x={60} y={34} r={10} id={id} />
      <path d="M0,150 L70,96 L120,128 L200,40 L280,122 L330,92 L400,140 L400,180 L0,180 Z" style={fill(v('abyss'), 0.6)} />
      <path d="M200,40 L218,58 L206,56 L198,64 L190,56 L184,58 Z" style={fill(v('bone'), 0.75)} />
      <path d="M0,168 L90,136 L150,158 L240,126 L320,160 L400,150 L400,180 L0,180 Z" style={fill(v('abyss'))} />
      <path d="M110,176 Q150,150 170,124 T198,64" style={{ fill: 'none', stroke: v('brass-hi'), strokeWidth: 1.6, strokeDasharray: '3 5', strokeOpacity: 0.8 }} />
      <line x1={200} y1={42} x2={200} y2={20} style={{ stroke: v('bone'), strokeWidth: 1.5 }} />
      <path className="sc-flag" d="M200,20 L216,25 L200,30 Z" style={{ ...fill(v('cinnabar')), transformOrigin: '200px 25px' }} />
      <circle cx={200} cy={40} r={24} fill={`url(#${id}-lamp)`} className="sc-flick" />
    </>
  );
}


function Pine({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <rect x={-2.5} y={-4} width={5} height={10} fill="#3a2a22" />
      <path d="M0,-46 L16,-18 L8,-18 L20,-2 L-20,-2 L-8,-18 L-16,-18 Z" fill="#1f5a4a" />
      <path d="M0,-46 L7,-33 L-7,-33 Z M-10,-18 L-6,-22 L6,-22 L10,-18 Z" fill="#f4f7ff" />
    </g>
  );
}

function Gift({ x, y, w, h, c, r }: { x: number; y: number; w: number; h: number; c: string; r: string }) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={1.5} fill={c} />
      <rect x={x + w / 2 - 1.5} y={y} width={3} height={h} fill={r} />
      <rect x={x} y={y + h / 2 - 1.5} width={w} height={3} fill={r} />
      <path d={`M${x + w / 2},${y} q-6,-7 -8,-1 q4,3 8,1 q6,-7 8,-1 q-4,3 -8,1 Z`} fill={r} />
    </g>
  );
}

function Xmas({ id }: { id: string }) {
  return (
    <>
      <rect width={W} height={H} fill={`url(#${id}-sky)`} />
      <Stars seed={81} n={40} maxY={90} />
      <path className="sc-aurora" d="M-20,60 Q60,20 140,52 T300,40 T420,50 L420,74 Q330,62 300,66 T140,76 T-20,84 Z" fill="#46e0a8" opacity=".22" />
      <path className="sc-aurora" d="M-20,74 Q80,44 160,70 T320,58 T420,66 L420,80 Q320,74 300,78 T160,86 T-20,92 Z" fill="#7ad8ff" opacity=".16" />
      <Moon x={344} y={30} r={10} id={id} />
      <path d="M0,150 Q90,118 190,138 T400,126 L400,180 L0,180 Z" fill="#cfd8f2" />
      <path d="M0,164 Q120,140 240,158 T400,150 L400,180 L0,180 Z" fill="#eef2ff" />
      <Pine x={40} y={150} s={1.1} /><Pine x={74} y={146} s={0.8} /><Pine x={356} y={142} s={1.05} /><Pine x={384} y={150} s={0.75} />
      <g transform="translate(176 118) rotate(-8)">
        <path d="M-8,26 Q-14,26 -14,20 L-14,4 L40,4 Q52,4 52,16 L52,26 Z" fill="#d8323a" />
        <path d="M-14,4 L40,4 Q46,4 48,10 L-14,10 Z" fill="#f2b23a" />
        <path d="M-20,30 L60,30 Q66,30 66,24" fill="none" stroke="#f2b23a" strokeWidth="3" strokeLinecap="round" />
        <Gift x={-4} y={-12} w={14} h={16} c="#2fae5a" r="#ffd27a" />
        <Gift x={12} y={-18} w={16} h={22} c="#4c6ef0" r="#ff6b6b" />
        <Gift x={30} y={-8} w={12} h={12} c="#ffd27a" r="#d8323a" />
      </g>
      <Gift x={262} y={150} w={14} h={12} c="#d8323a" r="#ffd27a" />
      <Gift x={110} y={156} w={12} h={10} c="#4c6ef0" r="#ffd27a" />
    </>
  );
}

/** Décor d'événement posé par-dessus une scène : neige, guirlande, flocons. */
function DecorXmas() {
  const r = rng(91);
  const bulbs = Array.from({ length: 15 }, (_, i) => i);
  return (
    <g>
      <path d="M-10,22 Q30,40 70,24 Q110,40 150,24 Q190,40 230,24 Q270,40 310,24 Q350,40 410,22" fill="none" stroke="#1f5a4a" strokeWidth="2" />
      {bulbs.map((i) => {
        const x = -10 + i * 28.6;
        const y = 24 + Math.abs(Math.sin((i * Math.PI) / 1.4)) * 10;
        const c = ['#ff5d62', '#ffd27a', '#46e0a8', '#7ad8ff'][i % 4];
        return <circle key={i} className="sc-bulb" cx={x} cy={y + 4} r={3.4} fill={c} style={{ animationDelay: `${(i % 4) * 0.35}s` }} />;
      })}
      <path d="M0,172 Q100,164 200,170 T400,166 L400,180 L0,180 Z" fill="#eef2ff" />
      {Array.from({ length: 34 }, (_, i) => (
        <circle key={i} className="sc-snow" cx={r() * W} cy={-6} r={0.9 + r() * 1.8} fill="#fff"
          style={{ animationDelay: `${(r() * 6).toFixed(2)}s`, animationDuration: `${(5 + r() * 5).toFixed(2)}s`, opacity: 0.6 + r() * 0.4 }} />
      ))}
    </g>
  );
}

const DRAW: Record<SceneKind, (p: { id: string }) => ReactNode> = {
  home: Home, atelier: Atelier, library: Library, train: Train, archives: Archives,
  observatory: Observatory, machines: Machines, tower: Tower, cabinet: Cabinet, expedition: Expedition, xmas: Xmas,
};

export function Scene({ kind, className = '', height, decor }: { kind: SceneKind; className?: string; height?: number; decor?: SceneDecor | null }) {
  const raw = useId();
  const id = `s${raw.replace(/[^a-zA-Z0-9]/g, '')}`;
  const Draw = DRAW[kind];
  return (
    <svg className={`scene ${className}`} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice" style={height ? { height } : undefined} aria-hidden="true">
      <Defs id={id} />
      <Draw id={id} />
      {decor === 'xmas' && <DecorXmas />}
      <rect width={W} height={H} fill={`url(#${id}-vig)`} />
    </svg>
  );
}
