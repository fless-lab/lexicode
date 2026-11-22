import { useEffect, useState } from 'react';
import type { Difficulty, Lang } from '../engine/types';
import { worldCategory, LEVELS_PER_WORLD, levelDifficulty } from '../engine/generator';
import { PACKS, LANGS, detectLang } from '../content';
import { STRINGS, COUNTRIES, type Strings } from '../i18n';
import { liveStreak, emptySave, type Save } from '../storage';
import { ranking, type RankRow, type Scope } from '../services/ranking';
import { billing, REWARD } from '../services/monetization';
import { rngFromSeed } from '../engine/rng';
import { ARENA, isBossLevel, levelMode, TIME_LIMIT, type Mode, type ModeKind } from '../modes';
import {
  levelProgress, titleIndex, TIERS, LEAGUE_SIZE, PROMOTE, DEMOTE, leagueRows, weekKey, weekFraction,
  ACHIEVEMENTS, playerLevel,
} from '../progress';
import { fmt } from './Play';
import { sfx } from '../sound';

export type Screen = 'home' | 'play' | 'arena' | 'ranking' | 'album' | 'profile' | 'league' | 'settings' | 'premium';

type SetSave = React.Dispatch<React.SetStateAction<Save>>;

const modeLabel = (t: Strings, k: ModeKind) => (t[`mode_${k}` as 'mode_zen'] as string[]);

function untilSunday(): string {
  const now = new Date();
  const end = new Date(now);
  const day = (now.getDay() + 6) % 7;
  end.setDate(now.getDate() + (7 - day));
  end.setHours(0, 0, 0, 0);
  const h = Math.max(0, Math.round((end.getTime() - now.getTime()) / 3600000));
  return h >= 24 ? `${Math.floor(h / 24)} j ${h % 24} h` : `${h} h`;
}

// ---------------- Choix de la langue ----------------

export function LangPicker({ onPick }: { onPick: (l: Lang) => void }) {
  const [sel, setSel] = useState<Lang>(detectLang());
  const t = STRINGS[sel];
  return (
    <div className="app center">
      <div className="logo">LEXI<span>CODE</span></div>
      <h2>{t.chooseLang}</h2>
      <p className="muted">{t.chooseLangSub}</p>
      <div className="langs">
        {LANGS.map((l) => (
          <button key={l.code} className={`lang ${sel === l.code ? 'on' : ''}`} onClick={() => setSel(l.code)}>
            <span className="flag">{l.flag}</span>{l.name}
          </button>
        ))}
      </div>
      <button className="primary big" onClick={() => onPick(sel)}>{t.continue}</button>
    </div>
  );
}

// ---------------- Accueil ----------------

interface HomeProps {
  t: Strings;
  save: Save;
  day: string;
  lang: Lang;
  onStart: (m: Mode) => void;
  go: (s: Screen) => void;
  setSave: SetSave;
  toast: (m: string, kind?: 'ach' | 'lvl' | 'info') => void;
}

export function Home({ t, save, day, lang, onStart, go, setSave, toast }: HomeProps) {
  const done = save.daily[lang]?.[day];
  const streak = liveStreak(save, day);
  const camp = save.campaign[lang] ?? { level: 1, stars: {} };
  const level = camp.level;
  const curWorld = Math.floor((level - 1) / LEVELS_PER_WORLD) + 1;
  const [world, setWorld] = useState(curWorld);
  const cat = worldCategory(PACKS[lang], (world - 1) * LEVELS_PER_WORLD + 1);
  const chestReady = save.lastChest !== day;
  const [diff, setDiff] = useState<Difficulty>(2);
  const lp = levelProgress(save.xp);
  const rows = leagueRows(save.league.week ?? weekKey(), save.league.tier, save.league.xp, save.name || t.you, weekFraction());
  const myRank = rows.findIndex((r) => r.isYou) + 1;
  const worldStars = Array.from({ length: LEVELS_PER_WORLD }, (_, i) => camp.stars[(world - 1) * LEVELS_PER_WORLD + i + 1] ?? 0).reduce((a, b) => a + b, 0);

  const openChest = () => {
    const r = REWARD.chest[Math.floor(rngFromSeed(`chest|${day}`)() * REWARD.chest.length)];
    setSave((s) => ({ ...s, lastChest: day, tokens: s.tokens + r }));
    sfx.coin();
    toast(`🎁 +${r} ${t.chestGot}`);
  };

  return (
    <div className="home">
      <header className="hhead">
        <button className="avatar" onClick={() => go('profile')}>
          <span className="lv">{lp.level}</span>
          <span className="who">
            <b>{save.name || t.titles[titleIndex(lp.level)]}</b>
            <span className="xpbar"><span style={{ width: `${(lp.cur / lp.need) * 100}%` }} /></span>
          </span>
        </button>
        <div className="chips">
          <span className="chip fire">🔥 {streak}</span>
          <span className="chip gold">{save.premium ? '∞' : save.tokens} ◆</span>
          <button className="chip" onClick={() => go('settings')}>⚙</button>
        </div>
      </header>

      <div className={`card daily ${done ? 'done' : ''}`}>
        <div className="ctop">
          <span className="label">📅 {done ? t.dailyDone : t.daily}</span>
          <span className="date">{day}</span>
        </div>
        {done ? (
          <div className="dres"><b>{done.score}</b> pts · {fmt(done.ms)} · ✕ {done.mistakes}</div>
        ) : (
          <p>{t.dailySub}</p>
        )}
        <div className="row">
          {!done && <button className="primary" onClick={() => onStart({ kind: 'daily', d: 3, nonce: day, date: day })}>{t.play}</button>}
          <button onClick={() => go('ranking')}>🏆 {t.ranking}</button>
        </div>
        <div className="streakline">
          🔥 {t.streak}: <b>{streak}</b> {t.days} · {t.best}: {save.streak.best} · 🛡 {save.streak.freezes}
          <span className="weekdots">
            {Array.from({ length: 7 }, (_, i) => {
              const d = new Date();
              d.setDate(d.getDate() - (6 - i));
              const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
              return <i key={i} className={save.daily[lang]?.[k] ? 'on' : ''} />;
            })}
          </span>
        </div>
      </div>

      {chestReady && (
        <button className="card chest" onClick={openChest}>
          <span>🎁 {t.dailyChest}</span><span className="pill">{t.open}</span>
        </button>
      )}

      <button className="card arena" onClick={() => go('arena')}>
        <div className="ctop">
          <span className="label">⚔️ {t.arena}</span>
          <span className="pill red">NEW</span>
        </div>
        <p>{t.arenaSub}</p>
        <div className="arenaicons">{ARENA.map((a) => <span key={a.kind} className={playerLevel(save.xp) < a.unlockLevel ? 'lockedi' : ''}>{a.icon}</span>)}</div>
      </button>

      <div className="card camp">
        <div className="ctop">
          <span className="label">🗺 {t.campaign}</span>
          <span className="date">★ {worldStars}/{LEVELS_PER_WORLD * 3}</span>
        </div>
        <div className="worldnav">
          <button disabled={world <= 1} onClick={() => setWorld(world - 1)}>‹</button>
          <span>{t.world} {world} · {t[`cat_${cat}` as 'cat_fact'] ?? cat}</span>
          <button disabled={world >= curWorld} onClick={() => setWorld(world + 1)}>›</button>
        </div>
        <div className="path">
          {Array.from({ length: LEVELS_PER_WORLD }, (_, i) => {
            const n = (world - 1) * LEVELS_PER_WORLD + i + 1;
            const st = camp.stars[n] ?? 0;
            const boss = isBossLevel(n);
            return (
              <button key={n} className={`node ${n === level ? 'cur' : ''} ${st ? 'cleared' : ''} ${boss ? 'boss' : ''}`} disabled={n > level} onClick={() => onStart(levelMode(n))}>
                {boss ? '👹' : n}
                <small>{st > 0 ? '★'.repeat(st) : n > level ? '🔒' : ''}</small>
              </button>
            );
          })}
        </div>
        <button className="primary" onClick={() => onStart(levelMode(level))}>
          {t.play} · {isBossLevel(level) ? `👹 ${t.boss}` : `${t.level} ${level}`} · {t.d[levelDifficulty(level)]}
        </button>
        {isBossLevel(level) && <p className="small">{t.bossDesc}</p>}
      </div>

      <button className="card leaguecard" onClick={() => go('league')}>
        <span className="tier">{TIERS[save.league.tier]}</span>
        <span className="lmid">
          <b>{t.league} {t.leagueNames[save.league.tier]}</b>
          <small>#{myRank} / {LEAGUE_SIZE} · {save.league.xp} {t.xp} · {t.leagueEnds} {untilSunday()}</small>
        </span>
        <span className={`zone ${myRank <= PROMOTE ? 'up' : myRank > LEAGUE_SIZE - DEMOTE ? 'down' : ''}`}>{myRank <= PROMOTE ? '▲' : myRank > LEAGUE_SIZE - DEMOTE ? '▼' : '='}</span>
      </button>

      <div className="card">
        <div className="ctop"><span className="label">🎯 {t.practice}</span></div>
        <div className="seg">
          {([1, 2, 3, 4, 5] as Difficulty[]).map((d) => (
            <button key={d} className={diff === d ? 'on' : ''} onClick={() => setDiff(d)}>{t.d[d]}</button>
          ))}
        </div>
        <button onClick={() => onStart({ kind: 'practice', d: diff, nonce: String(Date.now()) })}>{t.play}</button>
      </div>

      <nav className="grid">
        <button onClick={() => go('album')}>📖<span>{t.album}</span></button>
        <button onClick={() => go('profile')}>🏅<span>{t.achievements} {save.achievements.length}/{ACHIEVEMENTS.length}</span></button>
        <button onClick={() => go('ranking')}>🏆<span>{t.ranking}</span></button>
        <button className="prem" onClick={() => go('premium')}>👑<span>{save.premium ? t.premiumActive : t.premium}</span></button>
      </nav>
      <p className="rating">🧠 {t.rating}: <b>{save.rating}</b></p>
    </div>
  );
}

// ---------------- Arène ----------------

export function Arena({ t, save, lang, onStart, back }: { t: Strings; save: Save; lang: Lang; onStart: (m: Mode) => void; back: () => void }) {
  const [diffs, setDiffs] = useState<Record<string, Difficulty>>({});
  const plv = playerLevel(save.xp);
  return (
    <Sub title={`⚔️ ${t.arena}`} back={back}>
      <p className="muted">{t.arenaSub}</p>
      {ARENA.map((a) => {
        const [name, desc] = modeLabel(t, a.kind);
        const d = diffs[a.kind] ?? 2;
        const key = a.pickD ? `${a.kind}:${d}` : a.kind;
        const rec = save.records[lang]?.[key];
        const locked = plv < a.unlockLevel;
        return (
          <div key={a.kind} className={`card mode ${a.kind} ${locked ? 'lockedc' : ''}`}>
            <div className="ctop">
              <span className="label">{a.icon} {name}</span>
              {locked ? <span className="pill">🔒 {t.unlockAt} {a.unlockLevel}</span> : rec && rec.best > 0 ? <span className="date">🏆 {rec.best}{a.kind === 'marathon' ? ` ${t.grids}` : ''}</span> : null}
            </div>
            <p>{desc}</p>
            {a.kind === 'timeattack' && !locked && <p className="small">⏳ {fmt(TIME_LIMIT[d])} · ×1.25</p>}
            {a.pickD && !locked && (
              <div className="seg">
                {([1, 2, 3, 4, 5] as Difficulty[]).map((x) => (
                  <button key={x} className={d === x ? 'on' : ''} onClick={() => setDiffs({ ...diffs, [a.kind]: x })}>{t.d[x]}</button>
                ))}
              </div>
            )}
            {rec && <p className="small">{rec.wins}/{rec.played} · {rec.played ? Math.round((rec.wins / rec.played) * 100) : 0}%</p>}
            <button className="primary" disabled={locked} onClick={() => onStart({ kind: a.kind, d: a.kind === 'hardcore' ? 5 : d, nonce: String(Date.now()), run: 0 })}>{t.play}</button>
          </div>
        );
      })}
    </Sub>
  );
}

// ---------------- Écrans secondaires ----------------

function Sub({ title, back, children }: { title: string; back: () => void; children: React.ReactNode }) {
  return (
    <div className="sub">
      <header className="topbar">
        <button className="icon" onClick={back}>‹</button>
        <div className="title"><div className="t1">{title}</div></div>
      </header>
      <div className="subbody">{children}</div>
    </div>
  );
}

const BOARDS: { key: string; kind: ModeKind; count?: boolean }[] = [
  { key: 'daily', kind: 'daily' },
  { key: 'timeattack:3', kind: 'timeattack' },
  { key: 'survival:3', kind: 'survival' },
  { key: 'sudden:3', kind: 'sudden' },
  { key: 'marathon', kind: 'marathon', count: true },
  { key: 'hardcore', kind: 'hardcore' },
];

export function Ranking({ t, save, lang, day, back }: { t: Strings; save: Save; lang: Lang; day: string; back: () => void }) {
  const [scope, setScope] = useState<Scope>('city');
  const [board, setBoard] = useState(0);
  const [rows, setRows] = useState<RankRow[]>([]);
  const b = BOARDS[board];
  const mine = b.key === 'daily' ? save.daily[lang]?.[day] : (() => {
    const r = save.records[lang]?.[b.key];
    return r && r.best > 0 ? { score: r.best, ms: r.bestMs ?? 0 } : undefined;
  })();
  useEffect(() => {
    const me = mine ? { name: save.name || t.you, city: save.city, country: save.country, score: mine.score, ms: mine.ms } : null;
    const key = b.key === 'daily' ? `daily:${day}` : b.key;
    ranking.board(lang, key, scope, me, { city: save.city, country: save.country }, b.count).then(setRows);
  }, [scope, board, lang, day, mine?.score, save.name, save.city, save.country]); // eslint-disable-line react-hooks/exhaustive-deps
  const scopes: [Scope, string][] = [['city', t.city], ['country', t.country], ['world', t.worldScope], ['friends', t.friends]];
  const label = (k: ModeKind) => (k === 'daily' ? t.daily : modeLabel(t, k)[0]);
  return (
    <Sub title={`🏆 ${t.ranking}`} back={back}>
      <div className="hscroll">
        {BOARDS.map((x, i) => <button key={x.key} className={board === i ? 'on' : ''} onClick={() => setBoard(i)}>{label(x.kind)}{x.key.includes(':') ? ` · ${t.d[3]}` : ''}</button>)}
      </div>
      <div className="seg">
        {scopes.map(([s, l]) => <button key={s} className={scope === s ? 'on' : ''} onClick={() => setScope(s)}>{l}</button>)}
      </div>
      <ol className="board">
        {rows.map((r, i) => (
          <li key={i} className={r.isYou ? 'you' : ''}>
            <span className="pos">{i < 3 ? ['🥇', '🥈', '🥉'][i] : i + 1}</span>
            <span className="who">{r.name}<small>{r.place}</small></span>
            <span className="sc">{r.score}{b.count ? ` ${t.grids}` : ''}<small>{fmt(r.ms)}</small></span>
          </li>
        ))}
      </ol>
      {ranking.demo && <p className="muted small">{t.demoBoard}</p>}
    </Sub>
  );
}

export function Album({ t, save, lang, back }: { t: Strings; save: Save; lang: Lang; back: () => void }) {
  const found = new Set(save.album[lang] ?? []);
  const phrases = PACKS[lang].phrases;
  const cats = [...new Set(phrases.map((p) => p.k))];
  const [cat, setCat] = useState<string | null>(null);
  const list = phrases.map((p, i) => ({ p, i })).filter(({ p }) => !cat || p.k === cat).sort((a, b) => Number(found.has(b.i)) - Number(found.has(a.i)));
  return (
    <Sub title={`📖 ${t.album} · ${found.size}/${phrases.length}`} back={back}>
      <p className="muted">{t.albumSub}</p>
      <div className="bar thin"><div style={{ width: `${(found.size / phrases.length) * 100}%` }} /></div>
      <div className="hscroll">
        <button className={!cat ? 'on' : ''} onClick={() => setCat(null)}>★</button>
        {cats.map((c) => {
          const tot = phrases.filter((p) => p.k === c).length;
          const got = phrases.filter((p, i) => p.k === c && found.has(i)).length;
          return <button key={c} className={cat === c ? 'on' : ''} onClick={() => setCat(c)}>{t[`cat_${c}` as 'cat_fact'] ?? c} {got}/{tot}</button>;
        })}
      </div>
      {!found.size && <p className="muted">{t.albumEmpty}</p>}
      <div className="album">
        {list.map(({ p, i }) => (
          <div key={i} className={`acard ${found.has(i) ? '' : 'lockedc'}`}>
            <small>{t[`cat_${p.k}` as 'cat_fact'] ?? p.k}</small>
            <div>{found.has(i) ? p.t : '•••••• ' + t.locked}</div>
          </div>
        ))}
      </div>
    </Sub>
  );
}

export function Profile({ t, save, lang, day, back }: { t: Strings; save: Save; lang: Lang; day: string; back: () => void }) {
  const s = save.stats;
  const lp = levelProgress(save.xp);
  const have = new Set(save.achievements);
  const items: [string, string | number][] = [
    [t.played, s.played],
    [t.winRate, s.played ? `${Math.round((s.won / s.played) * 100)}%` : '–'],
    [t.avgTime, s.won ? fmt(s.totalMs / s.won) : '–'],
    [t.bestScore, s.bestScore],
    [t.streak, liveStreak(save, day)],
    [t.best, save.streak.best],
    [t.rating, save.rating],
    [t.xp, save.xp],
  ];
  const recs = Object.entries(save.records[lang] ?? {}).filter(([, r]) => r.played > 0);
  return (
    <Sub title={`🏅 ${t.profile}`} back={back}>
      <div className="card profhead">
        <div className="bigLv">{lp.level}</div>
        <div className="lmid">
          <b>{save.name || t.you}</b>
          <small>{t.titles[titleIndex(lp.level)]} · {TIERS[save.league.tier]} {t.leagueNames[save.league.tier]}</small>
          <span className="xpbar big"><span style={{ width: `${(lp.cur / lp.need) * 100}%` }} /></span>
          <small>{lp.cur} / {lp.need} {t.xp}</small>
        </div>
      </div>
      <div className="statgrid">{items.map(([k, v]) => <div key={k}><b>{v}</b><small>{k}</small></div>)}</div>
      {recs.length > 0 && (
        <>
          <h3>🏆 {t.record}</h3>
          <div className="recs">
            {recs.map(([k, r]) => {
              const [kind, d] = k.split(':');
              return (
                <div key={k}>
                  <span>{modeLabel(t, kind as ModeKind)?.[0] ?? kind}{d ? ` · ${t.d[Number(d)]}` : ''}</span>
                  <b>{r.best > 0 ? `${r.best}${kind === 'marathon' ? ` ${t.grids}` : ''}` : '–'}</b>
                  <small>{r.wins}/{r.played}</small>
                </div>
              );
            })}
          </div>
        </>
      )}
      <h3>🏅 {t.achievements} · {have.size}/{ACHIEVEMENTS.length}</h3>
      <div className="achs">
        {ACHIEVEMENTS.map((a) => (
          <div key={a.id} className={`ach ${have.has(a.id) ? 'got' : ''}`}>
            <span className="ai">{have.has(a.id) ? a.icon : '🔒'}</span>
            <b>{t.achs[a.id]?.[0]}</b>
            <small>{t.achs[a.id]?.[1]}</small>
          </div>
        ))}
      </div>
    </Sub>
  );
}

export function League({ t, save, back }: { t: Strings; save: Save; back: () => void }) {
  const rows = leagueRows(save.league.week ?? weekKey(), save.league.tier, save.league.xp, save.name || t.you, weekFraction());
  return (
    <Sub title={`${TIERS[save.league.tier]} ${t.league} ${t.leagueNames[save.league.tier]}`} back={back}>
      <div className="tiers">{TIERS.map((x, i) => <span key={i} className={i === save.league.tier ? 'on' : i < save.league.tier ? 'past' : ''}>{x}</span>)}</div>
      <p className="muted">{t.leagueSub}</p>
      <p className="small">⏳ {t.leagueEnds} {untilSunday()}</p>
      <ol className="board">
        {rows.map((r, i) => (
          <li key={i} className={`${r.isYou ? 'you' : ''} ${i < PROMOTE ? 'zup' : i >= LEAGUE_SIZE - DEMOTE ? 'zdown' : ''}`}>
            <span className="pos">{i + 1}</span>
            <span className="who">{r.name}</span>
            <span className="sc">{r.xp} {t.xp}</span>
          </li>
        ))}
      </ol>
      {ranking.demo && <p className="muted small">{t.demoBoard}</p>}
    </Sub>
  );
}

export function Settings({ t, save, setSave, back }: { t: Strings; save: Save; setSave: SetSave; back: () => void }) {
  const [confirm, setConfirm] = useState(false);
  return (
    <Sub title={`⚙ ${t.settings}`} back={back}>
      <label className="field">{t.language}
        <select value={save.lang ?? 'en'} onChange={(e) => setSave((s) => ({ ...s, lang: e.target.value as Lang }))}>
          {LANGS.map((l) => <option key={l.code} value={l.code}>{l.flag} {l.name}</option>)}
        </select>
      </label>
      <label className="field">{t.name}
        <input value={save.name} maxLength={16} onChange={(e) => setSave((s) => ({ ...s, name: e.target.value }))} />
      </label>
      <label className="field">{t.yourCity}
        <input value={save.city} maxLength={30} onChange={(e) => setSave((s) => ({ ...s, city: e.target.value }))} />
      </label>
      <label className="field">{t.yourCountry}
        <select value={save.country} onChange={(e) => setSave((s) => ({ ...s, country: e.target.value }))}>
          <option value="">–</option>
          {COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </label>
      <label className="toggle"><input type="checkbox" checked={save.settings.sound} onChange={(e) => setSave((s) => ({ ...s, settings: { ...s.settings, sound: e.target.checked } }))} /> 🔊 {t.sound}</label>
      <label className="toggle"><input type="checkbox" checked={save.settings.haptics} onChange={(e) => setSave((s) => ({ ...s, settings: { ...s.settings, haptics: e.target.checked } }))} /> 📳 {t.haptics}</label>
      <button className="danger" onClick={() => {
        if (!confirm) return setConfirm(true);
        setSave((s) => ({ ...emptySave(), lang: s.lang, name: s.name, city: s.city, country: s.country, premium: s.premium, tutorialDone: true }));
        setConfirm(false);
      }}>{confirm ? t.resetConfirm : t.reset}</button>
    </Sub>
  );
}

export function Premium({ t, save, setSave, back }: { t: Strings; save: Save; setSave: SetSave; back: () => void }) {
  const buy = async (plan: 'monthly' | 'yearly') => {
    if (await billing.purchase(plan)) setSave((s) => ({ ...s, premium: true }));
  };
  return (
    <Sub title={`👑 ${t.premiumTitle}`} back={back}>
      <ul className="perks">{t.premiumPerks.map((p) => <li key={p}>✓ {p}</li>)}</ul>
      {save.premium ? (
        <p className="badge big">{t.premiumActive}</p>
      ) : (
        <>
          <button className="primary big" onClick={() => buy('yearly')}>{t.premiumYearly}<small>{t.premiumTrial}</small></button>
          <button onClick={() => buy('monthly')}>{t.premiumMonthly}</button>
        </>
      )}
      <p className="muted small">{t.premiumNote}</p>
    </Sub>
  );
}
