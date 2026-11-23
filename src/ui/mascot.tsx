// Loupi, le raton laveur d'Ada. Personnage original, dessiné en pièces séparées
// (queue, corps, tête, oreilles, yeux, bras, loupe) pour être animé par humeur.
import { useId } from 'react';

export type Mood = 'idle' | 'happy' | 'sad' | 'think' | 'wow';

const FUR = '#9b97b4';
const FUR_DK = '#6f6a8c';
const CREAM = '#efebf6';
const MASK = '#262444';
const INK = '#1b1a30';
const AMBER = '#ffb938';
const AMBER_DK = '#c97f10';

function Eye({ x, y, mood, big }: { x: number; y: number; mood: Mood; big?: boolean }) {
  if (mood === 'happy') {
    // Yeux plissés de joie
    return <path d={`M${x - 8},${y + 2} Q${x},${y - 8} ${x + 8},${y + 2}`} fill="none" stroke={CREAM} strokeWidth="3.6" strokeLinecap="round" />;
  }
  const r = mood === 'wow' ? 12 : 10.5;
  const look = mood === 'sad' ? 3 : mood === 'think' ? -2 : 0;
  return (
    <g className="m-eye" style={{ transformOrigin: `${x}px ${y}px`, ...(big ? { transform: 'scale(1.45)' } : {}) }}>
      <circle cx={x} cy={y} r={r} fill="#fff" />
      <circle cx={x + (mood === 'think' ? 1.5 : 0)} cy={y + 1 + look} r={r * 0.74} fill="#5a3d22" />
      <circle cx={x + (mood === 'think' ? 1.5 : 0)} cy={y + 1 + look} r={r * 0.46} fill={INK} />
      <circle cx={x - r * 0.3} cy={y - r * 0.28 + look} r={r * 0.26} fill="#fff" />
      <circle cx={x + r * 0.3} cy={y + r * 0.3 + look} r={r * 0.11} fill="#fff" />
    </g>
  );
}

function Mouth({ mood }: { mood: Mood }) {
  switch (mood) {
    case 'happy':
      return (
        <g>
          <path d="M87,112 Q100,134 113,112 Z" fill="#5b2236" />
          <path d="M93,122 Q100,128 107,122 Q100,118 93,122 Z" fill="#ff8fa0" />
        </g>
      );
    case 'sad':
      return <path d="M91,121 Q100,113 109,121" fill="none" stroke={INK} strokeWidth="2.6" strokeLinecap="round" />;
    case 'wow':
      return <ellipse cx="100" cy="118" rx="5" ry="6.5" fill="#5b2236" />;
    case 'think':
      return <path d="M93,117 Q102,119 109,113" fill="none" stroke={INK} strokeWidth="2.6" strokeLinecap="round" />;
    default:
      return <path d="M90,114 Q95,120 100,114 Q105,120 110,114" fill="none" stroke={INK} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />;
  }
}

function Loupe({ x, y, angle, scale = 1, id }: { x: number; y: number; angle: number; scale?: number; id: string }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${angle}) scale(${scale})`}>
      <rect x="-3.5" y="15" width="7" height="26" rx="3.5" fill="#8a5a2b" />
      <rect x="-4.5" y="13" width="9" height="6" rx="2" fill={AMBER_DK} />
      <circle r="17" fill={`url(#${id}-lens)`} />
      <circle r="17" fill="none" stroke={AMBER} strokeWidth="5" />
      <circle r="17" fill="none" stroke={AMBER_DK} strokeWidth="1.4" opacity=".6" />
      <path className="m-glint" d="M-9,-7 A11,11 0 0 1 -2,-12" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" opacity=".9" />
    </g>
  );
}

/**
 * Loupi en pied ou en buste. Les poses changent avec l'humeur :
 * idle tient la loupe, think la colle à son œil (œil grossi), happy la brandit, sad la laisse pendre.
 */
export function Loupi({ mood = 'idle', size = 120, bust = false, className = '', title }: { mood?: Mood; size?: number; bust?: boolean; className?: string; title?: string }) {
  const raw = useId();
  const id = `l${raw.replace(/[^a-zA-Z0-9]/g, '')}`;
  const vb = bust ? '22 14 156 128' : '0 0 200 200';
  const lens = mood === 'think';
  const earTilt = mood === 'sad' ? 16 : mood === 'wow' ? -6 : 0;
  return (
    <svg className={`loupi m-${mood} ${className}`} viewBox={vb} width={size} height={bust ? size * (128 / 156) : size} role={title ? 'img' : undefined} aria-label={title} aria-hidden={title ? undefined : true}>
      <defs>
        <radialGradient id={`${id}-lens`} cx=".35" cy=".35" r=".8">
          <stop offset="0" stopColor="#ffffff" stopOpacity=".55" />
          <stop offset="1" stopColor="#bcd4ff" stopOpacity=".18" />
        </radialGradient>
        <radialGradient id={`${id}-fur`} cx=".4" cy=".3" r=".8">
          <stop offset="0" stopColor="#b3afca" />
          <stop offset="1" stopColor={FUR} />
        </radialGradient>
      </defs>

      <g className="m-all">
        {!bust && (
          <>
            {/* Ombre au sol */}
            <ellipse className="m-shadow" cx="100" cy="194" rx="46" ry="5" fill="#000" opacity=".28" />
            {/* Queue annelée */}
            <g className="m-tail" style={{ transformOrigin: '128px 168px' }}>
              {[
                [136, 166, 19, FUR_DK], [150, 154, 18.5, MASK], [161, 139, 17.5, FUR_DK],
                [168, 122, 16, MASK], [171, 105, 14.5, FUR_DK], [170, 90, 12.5, MASK],
              ].map(([cx, cy, r, c], i) => <circle key={i} cx={cx as number} cy={cy as number} r={r as number} fill={c as string} />)}
            </g>
            {/* Corps */}
            <g className="m-body" style={{ transformOrigin: '100px 188px' }}>
              <ellipse cx="100" cy="152" rx="41" ry="38" fill={`url(#${id}-fur)`} />
              <ellipse cx="100" cy="160" rx="25" ry="25" fill={CREAM} />
              <ellipse cx="79" cy="187" rx="15" ry="8" fill={FUR_DK} />
              <ellipse cx="121" cy="187" rx="15" ry="8" fill={FUR_DK} />
              {[73, 79, 85, 115, 121, 127].map((x) => <ellipse key={x} cx={x} cy="189" rx="2.6" ry="2" fill={MASK} opacity=".55" />)}
              {/* Écharpe ambrée */}
              <path d="M66,118 Q100,132 134,118 L132,129 Q100,142 68,129 Z" fill={AMBER} />
              <path d="M112,128 L122,152 L110,150 L104,131 Z" fill={AMBER_DK} />
              {/* Bras gauche posé sur le ventre */}
              <ellipse cx="80" cy="150" rx="9" ry="15" transform={`rotate(${mood === 'happy' ? -40 : 28} 80 150)`} fill={FUR_DK} />
            </g>
          </>
        )}

        {/* Tête */}
        <g className="m-head" style={{ transformOrigin: '100px 120px' }}>
          <g style={{ transform: `rotate(${-earTilt}deg)`, transformOrigin: '70px 52px' }}>
            <path d="M52,64 C44,40 52,22 66,20 C78,22 86,36 88,48 Z" fill={FUR_DK} />
            <path d="M58,58 C54,42 58,31 66,30 C73,32 78,40 80,48 Z" fill="#d8c3d6" />
          </g>
          <g style={{ transform: `rotate(${earTilt}deg)`, transformOrigin: '130px 52px' }}>
            <path d="M148,64 C156,40 148,22 134,20 C122,22 114,36 112,48 Z" fill={FUR_DK} />
            <path d="M142,58 C146,42 142,31 134,30 C127,32 122,40 120,48 Z" fill="#d8c3d6" />
          </g>
          <path d="M100,36 C140,36 158,60 158,84 C158,93 163,101 168,105 C156,107 150,113 141,118 C128,126 114,129 100,129 C86,129 72,126 59,118 C50,113 44,107 32,105 C37,101 42,93 42,84 C42,60 60,36 100,36 Z" fill={`url(#${id}-fur)`} />
          <path d="M100,70 C124,70 142,88 142,103 C142,118 123,127 100,127 C77,127 58,118 58,103 C58,88 76,70 100,70 Z" fill={CREAM} />
          <path d="M100,38 C105,50 106,62 104,74 L96,74 C94,62 95,50 100,38 Z" fill={FUR_DK} />
          {/* Sourcils blancs */}
          <ellipse cx="75" cy="63" rx="13" ry="5.5" transform={`rotate(${mood === 'sad' ? 14 : mood === 'wow' ? -14 : -6} 75 63)`} fill={CREAM} />
          <ellipse cx="125" cy="63" rx="13" ry="5.5" transform={`rotate(${mood === 'sad' ? -14 : mood === 'wow' ? 14 : 6} 125 63)`} fill={CREAM} />
          {/* Masque */}
          <path d="M44,84 C50,69 69,65 86,73 C92,76 96,79 100,79 C104,79 108,76 114,73 C131,65 150,69 156,84 C152,99 137,103 122,97 C114,93 106,93 100,97 C94,93 86,93 78,97 C63,103 48,99 44,84 Z" fill={MASK} />
          <g className="m-blink" style={{ transformOrigin: '100px 85px' }}>
            <Eye x={77} y={85} mood={mood} />
            <Eye x={123} y={85} mood={mood} big={lens} />
          </g>
          <ellipse cx="65" cy="106" rx="8" ry="4.5" fill="#ff8f9a" opacity={mood === 'happy' ? 0.55 : 0.3} />
          <ellipse cx="135" cy="106" rx="8" ry="4.5" fill="#ff8f9a" opacity={mood === 'happy' ? 0.55 : 0.3} />
          <path d="M91,101 Q100,95 109,101 Q105,111 100,111 Q95,111 91,101 Z" fill={INK} />
          <ellipse cx="97" cy="100" rx="3" ry="1.6" fill="#fff" opacity=".55" />
          <Mouth mood={mood} />
          {mood === 'sad' && <path className="m-tear" d="M80,98 q3,6 0,9 q-3,-3 0,-9 Z" fill="#9fd3ff" />}
        </g>

        {/* Bras droit et loupe, selon la pose */}
        {lens ? (
          <g className="m-arm">
            {!bust && <ellipse cx="146" cy="112" rx="9" ry="17" transform="rotate(-20 146 112)" fill={FUR_DK} />}
            <Loupe x={123} y={85} angle={-30} scale={1.12} id={id} />
          </g>
        ) : mood === 'happy' ? (
          <g className="m-arm m-raise" style={{ transformOrigin: '134px 128px' }}>
            <Loupe x={162} y={64} angle={22} scale={bust ? 0.7 : 1} id={id} />
            {!bust && (
              <>
                <ellipse cx="143" cy="114" rx="9" ry="20" transform="rotate(18 143 114)" fill={FUR_DK} />
                <circle cx="149" cy="97" r="7" fill={MASK} />
              </>
            )}
          </g>
        ) : mood === 'sad' ? (
          !bust && (
            <g className="m-arm">
              <ellipse cx="128" cy="160" rx="9" ry="15" transform="rotate(-10 128 160)" fill={FUR_DK} />
              <Loupe x={140} y={164} angle={-150} scale={0.8} id={id} />
            </g>
          )
        ) : (
          !bust && (
            <g className="m-arm m-hold" style={{ transformOrigin: '128px 140px' }}>
              <Loupe x={150} y={122} angle={18} scale={0.95} id={id} />
              <ellipse cx="135" cy="150" rx="10" ry="14" transform="rotate(-30 135 150)" fill={FUR_DK} />
            </g>
          )
        )}
      </g>
    </svg>
  );
}
