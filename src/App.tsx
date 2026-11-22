import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Difficulty, Lang, Puzzle } from './engine/types';
import { dailyPuzzle, levelPuzzle, practicePuzzle, worldCategory, LEVELS_PER_WORLD, levelDifficulty } from './engine/generator';
import { PACKS, LANGS, detectLang } from './content';
import { STRINGS, COUNTRIES, type Strings } from './i18n';
import { loadSave, persist, today, bumpStreak, liveStreak, updateRating, type Save } from './storage';
import { ranking, type RankRow, type Scope } from './services/ranking';
import { ads, billing, REWARD } from './services/monetization';
import { rngFromSeed } from './engine/rng';
import { Play, fmt, type FinishInfo } from './ui/Play';

type Mode =
  | { kind: 'daily'; date: string }
  | { kind: 'level'; level: number }
  | { kind: 'practice'; d: Difficulty; nonce: string };

type Screen = 'home' | 'play' | 'ranking' | 'album' | 'stats' | 'settings' | 'premium';

export default function App() {
  const [save, setSave] = useState<Save>(loadSave);
  const [screen, setScreen] = useState<Screen>('home');
  const [mode, setMode] = useState<Mode | null>(null);
  const [last, setLast] = useState<{ info: FinishInfo; ratingDelta: number; record: boolean } | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [adOpen, setAdOpen] = useState<'offer' | 'playing' | null>(null);

  useEffect(() => persist(save), [save]);

  const update = useCallback((fn: (s: Save) => Save) => setSave((s) => fn(s)), []);
  const flash = (m: string) => {
    setToast(m);
    setTimeout(() => setToast(null), 1800);
  };

  const puzzle: Puzzle | null = useMemoPuzzle(mode, save.lang ?? 'en');

  if (!save.lang) return <LangPicker onPick={(lang) => update((s) => ({ ...s, lang }))} />;

  const lang = save.lang;
  const t = STRINGS[lang];
  const pack = PACKS[lang];
  const day = today();

  const start = (m: Mode) => {
    setMode(m);
    setLast(null);
    setScreen('play');
  };

  const onFinish = (info: FinishInfo) => {
    if (!mode || !puzzle) return;
    const newRating = updateRating(save.rating, puzzle.rating, info.score);
    const ratingDelta = newRating - save.rating;
    const record = save.stats.played > 0 && info.score > save.stats.bestScore;
    update((s) => {
      let n: Save = { ...s };
      n.rating = newRating;
      n.stats = {
        played: s.stats.played + 1,
        won: s.stats.won + 1,
        totalMs: s.stats.totalMs + info.ms,
        bestScore: Math.max(s.stats.bestScore, info.score),
      };
      const al = new Set(s.album[lang] ?? []);
      al.add(puzzle.phraseIndex);
      n.album = { ...s.album, [lang]: [...al] };
      if (mode.kind === 'daily') {
        const prev = s.daily[lang]?.[mode.date];
        if (!prev) {
          n.daily = { ...s.daily, [lang]: { ...(s.daily[lang] ?? {}), [mode.date]: { score: info.score, ms: info.ms, mistakes: info.mistakes, hints: info.hints } } };
          n.tokens += REWARD.daily;
          if (mode.date === day) n = bumpStreak(n, day);
          ranking.submit(lang, mode.date, { name: s.name, city: s.city, country: s.country, score: info.score, ms: info.ms });
        }
      } else if (mode.kind === 'level') {
        const c = s.campaign[lang] ?? { level: 1, stars: {} };
        const best = Math.max(c.stars[mode.level] ?? 0, info.stars);
        const firstClear = !c.stars[mode.level];
        n.campaign = { ...s.campaign, [lang]: { level: Math.max(c.level, mode.level + 1), stars: { ...c.stars, [mode.level]: best } } };
        if (firstClear) n.tokens += info.stars === 3 ? REWARD.levelPerfect : REWARD.level;
      }
      return n;
    });
    setLast({ info, ratingDelta, record });
  };

  const spend = (k: number) => {
    if (save.tokens < k) return false;
    update((s) => ({ ...s, tokens: s.tokens - k }));
    return true;
  };

  const watchAd = async () => {
    setAdOpen('playing');
    const ok = await ads.showRewarded();
    setAdOpen(null);
    if (ok) update((s) => ({ ...s, tokens: s.tokens + REWARD.ad }));
  };

  const title =
    mode?.kind === 'daily' ? `${t.daily}` : mode?.kind === 'level' ? `${t.level} ${mode.level}` : t.practice;

  const shareResult = async () => {
    if (!last || !puzzle) return;
    const starsTxt = '★'.repeat(last.info.stars) + '☆'.repeat(3 - last.info.stars);
    const head = mode?.kind === 'daily' ? `Lexicode ${mode.date}` : `Lexicode · ${title}`;
    const text = `${head}\n${starsTxt} ${last.info.score} pts · ${fmt(last.info.ms)}\n✕ ${last.info.mistakes} · 💡 ${last.info.hints} · 🔥 ${liveStreak(save, day)}`;
    try {
      if (navigator.share) await navigator.share({ text });
      else {
        await navigator.clipboard.writeText(text);
        flash(t.copied);
      }
    } catch {
      /* partage annulé */
    }
  };

  const resultSheet = last && puzzle && (
    <div className="modal">
      <div className="sheet result">
        <div className="stars">{[1, 2, 3].map((i) => <span key={i} className={i <= last.info.stars ? 'on' : ''}>★</span>)}</div>
        <h2>{t.solved}</h2>
        <blockquote>{puzzle.phraseText}</blockquote>
        <div className="kpis">
          <div><b>{last.info.score}</b><small>{t.score}</small></div>
          <div><b>{fmt(last.info.ms)}</b><small>{t.time}</small></div>
          <div><b>{last.info.mistakes}</b><small>{t.mistakes}</small></div>
          <div><b>{last.info.hints}</b><small>{t.hintsUsed}</small></div>
        </div>
        <p className="delta">
          {t.ratingChange} {save.rating} <span className={last.ratingDelta >= 0 ? 'up' : 'down'}>({last.ratingDelta >= 0 ? '+' : ''}{last.ratingDelta})</span>
          {last.record && <span className="badge">{t.newRecord}</span>}
        </p>
        <div className="row">
          <button onClick={shareResult}>{t.share}</button>
          {mode?.kind === 'level' ? (
            <button className="primary" onClick={() => start({ kind: 'level', level: mode.level + 1 })}>{t.next}</button>
          ) : mode?.kind === 'practice' ? (
            <button className="primary" onClick={() => start({ kind: 'practice', d: mode.d, nonce: String(Date.now()) })}>{t.play}</button>
          ) : (
            <button className="primary" onClick={() => setScreen('ranking')}>{t.ranking}</button>
          )}
        </div>
        <button className="link" onClick={() => { setScreen('home'); setMode(null); }}>{t.home}</button>
      </div>
    </div>
  );

  return (
    <div className="app">
      {screen === 'home' && (
        <Home t={t} save={save} day={day} lang={lang} onStart={start} go={setScreen} update={update} flash={flash} />
      )}
      {screen === 'play' && puzzle && (
        <Play
          puzzle={puzzle}
          title={title}
          t={t}
          tokens={save.tokens}
          premium={save.premium}
          spend={spend}
          onNeedTokens={() => setAdOpen('offer')}
          onFinish={onFinish}
          onExit={() => { setScreen('home'); setMode(null); }}
          result={resultSheet}
        />
      )}
      {screen === 'ranking' && <Ranking t={t} save={save} lang={lang} day={day} back={() => setScreen('home')} />}
      {screen === 'album' && <Album t={t} save={save} lang={lang} back={() => setScreen('home')} />}
      {screen === 'stats' && <Stats t={t} save={save} day={day} back={() => setScreen('home')} />}
      {screen === 'settings' && <Settings t={t} save={save} update={update} back={() => setScreen('home')} />}
      {screen === 'premium' && <Premium t={t} save={save} update={update} back={() => setScreen('home')} />}

      {adOpen && (
        <div className="modal" onClick={() => adOpen === 'offer' && setAdOpen(null)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            {adOpen === 'offer' ? (
              <>
                <h3>{t.notEnoughTokens}</h3>
                <button className="primary" onClick={watchAd}>▶ {t.watchAd}</button>
                <button onClick={() => { setAdOpen(null); setScreen('premium'); }}>👑 {t.premium}</button>
              </>
            ) : (
              <div className="adplaying"><div className="spinner" />{t.adPlaying}</div>
            )}
          </div>
        </div>
      )}
      {toast && <div className="toast">{toast}</div>}
      <span hidden>{pack.lang}</span>
    </div>
  );
}

function useMemoPuzzle(mode: Mode | null, lang: Lang): Puzzle | null {
  return useMemo(() => {
    if (!mode) return null;
    const pack = PACKS[lang];
    if (mode.kind === 'daily') return dailyPuzzle(pack, mode.date);
    if (mode.kind === 'level') return levelPuzzle(pack, mode.level);
    return practicePuzzle(pack, mode.d, mode.nonce);
  }, [mode, lang]);
}

// ---------------- Écrans ----------------

function LangPicker({ onPick }: { onPick: (l: Lang) => void }) {
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

interface HomeProps {
  t: Strings;
  save: Save;
  day: string;
  lang: Lang;
  onStart: (m: Mode) => void;
  go: (s: Screen) => void;
  update: (fn: (s: Save) => Save) => void;
  flash: (m: string) => void;
}

function Home({ t, save, day, lang, onStart, go, update, flash }: HomeProps) {
  const done = save.daily[lang]?.[day];
  const streak = liveStreak(save, day);
  const camp = save.campaign[lang] ?? { level: 1, stars: {} };
  const level = camp.level;
  const world = Math.floor((level - 1) / LEVELS_PER_WORLD) + 1;
  const inWorld = ((level - 1) % LEVELS_PER_WORLD) + 1;
  const cat = worldCategory(PACKS[lang], level);
  const chestReady = save.lastChest !== day;
  const [diff, setDiff] = useState<Difficulty>(2);

  const openChest = () => {
    const r = REWARD.chest[Math.floor(rngFromSeed(`chest|${day}`)() * REWARD.chest.length)];
    update((s) => ({ ...s, lastChest: day, tokens: s.tokens + r }));
    flash(`+${r} ${t.chestGot}`);
  };

  return (
    <div className="home">
      <header className="hhead">
        <div className="logo small">LEXI<span>CODE</span></div>
        <div className="chips">
          <span className="chip fire">🔥 {streak}</span>
          <span className="chip gold">{save.premium ? '∞' : save.tokens} ◆</span>
          <button className="chip" onClick={() => go('settings')}>⚙</button>
        </div>
      </header>
      <p className="muted tag">{t.tagline}</p>

      <div className={`card daily ${done ? 'done' : ''}`}>
        <div className="ctop">
          <span className="label">{done ? t.dailyDone : t.daily}</span>
          <span className="date">{day}</span>
        </div>
        {done ? (
          <div className="dres">
            <b>{done.score}</b> pts · {fmt(done.ms)} · ✕ {done.mistakes}
          </div>
        ) : (
          <p>{t.dailySub}</p>
        )}
        <div className="row">
          {!done && <button className="primary" onClick={() => onStart({ kind: 'daily', date: day })}>{t.play}</button>}
          <button onClick={() => go('ranking')}>🏆 {t.ranking}</button>
        </div>
        <div className="streakline">
          🔥 {t.streak}: <b>{streak}</b> {t.days} · {t.best}: {save.streak.best} · 🛡 {save.streak.freezes} {t.freezes}
        </div>
      </div>

      {chestReady && (
        <button className="card chest" onClick={openChest}>
          <span>🎁 {t.dailyChest}</span><span className="pill">{t.open}</span>
        </button>
      )}

      <div className="card camp">
        <div className="ctop">
          <span className="label">🗺 {t.campaign}</span>
          <span className="date">{t.world} {world} · {t[`cat_${cat}` as 'cat_fact'] ?? cat}</span>
        </div>
        <div className="path">
          {Array.from({ length: LEVELS_PER_WORLD }, (_, i) => {
            const n = (world - 1) * LEVELS_PER_WORLD + i + 1;
            const st = camp.stars[n] ?? 0;
            return (
              <button key={n} className={`node ${n === level ? 'cur' : ''} ${st ? 'cleared' : ''}`} disabled={n > level} onClick={() => onStart({ kind: 'level', level: n })}>
                {n}
                {st > 0 && <small>{'★'.repeat(st)}</small>}
              </button>
            );
          })}
        </div>
        <button className="primary" onClick={() => onStart({ kind: 'level', level })}>
          {t.play} · {t.level} {level} ({inWorld}/{LEVELS_PER_WORLD}) · {t.d[levelDifficulty(level)]}
        </button>
      </div>

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
        <button onClick={() => go('stats')}>📊<span>{t.stats}</span></button>
        <button onClick={() => go('ranking')}>🏆<span>{t.ranking}</span></button>
        <button className="prem" onClick={() => go('premium')}>👑<span>{save.premium ? t.premiumActive : t.premium}</span></button>
      </nav>
      <p className="rating">🧠 {t.rating}: <b>{save.rating}</b></p>
    </div>
  );
}

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

function Ranking({ t, save, lang, day, back }: { t: Strings; save: Save; lang: Lang; day: string; back: () => void }) {
  const [scope, setScope] = useState<Scope>('city');
  const [rows, setRows] = useState<RankRow[]>([]);
  const mine = save.daily[lang]?.[day];
  useEffect(() => {
    const me = mine ? { name: save.name || t.you, city: save.city, country: save.country, score: mine.score, ms: mine.ms } : null;
    ranking.board(lang, day, scope, me, { city: save.city, country: save.country }).then(setRows);
  }, [scope, lang, day, mine, save.name, save.city, save.country, t.you]);
  const scopes: [Scope, string][] = [['city', t.city], ['country', t.country], ['world', t.worldScope], ['friends', t.friends]];
  return (
    <Sub title={`🏆 ${t.ranking}`} back={back}>
      <div className="seg">
        {scopes.map(([s, label]) => <button key={s} className={scope === s ? 'on' : ''} onClick={() => setScope(s)}>{label}</button>)}
      </div>
      <p className="muted small">{t.daily} · {day}</p>
      <ol className="board">
        {rows.map((r, i) => (
          <li key={i} className={r.isYou ? 'you' : ''}>
            <span className="pos">{i + 1}</span>
            <span className="who">{r.isYou && r.name !== t.you ? `${r.name} (${t.you})` : r.name}<small>{r.place}</small></span>
            <span className="sc">{r.score}<small>{fmt(r.ms)}</small></span>
          </li>
        ))}
      </ol>
      {ranking.demo && <p className="muted small">{t.demoBoard}</p>}
    </Sub>
  );
}

function Album({ t, save, lang, back }: { t: Strings; save: Save; lang: Lang; back: () => void }) {
  const found = new Set(save.album[lang] ?? []);
  const phrases = PACKS[lang].phrases;
  return (
    <Sub title={`📖 ${t.album} · ${found.size}/${phrases.length}`} back={back}>
      <p className="muted">{t.albumSub}</p>
      <div className="bar thin"><div style={{ width: `${(found.size / phrases.length) * 100}%` }} /></div>
      {!found.size && <p className="muted">{t.albumEmpty}</p>}
      <div className="album">
        {phrases.map((p, i) => ({ p, i })).sort((a, b) => Number(found.has(b.i)) - Number(found.has(a.i))).map(({ p, i }) => (
          <div key={i} className={`acard ${found.has(i) ? '' : 'lockedc'}`}>
            <small>{t[`cat_${p.k}` as 'cat_fact'] ?? p.k}</small>
            <div>{found.has(i) ? p.t : '•••••• ' + t.locked}</div>
          </div>
        ))}
      </div>
    </Sub>
  );
}

function Stats({ t, save, day, back }: { t: Strings; save: Save; day: string; back: () => void }) {
  const s = save.stats;
  const items: [string, string | number][] = [
    [t.played, s.played],
    [t.winRate, s.played ? `${Math.round((s.won / s.played) * 100)}%` : '–'],
    [t.avgTime, s.won ? fmt(s.totalMs / s.won) : '–'],
    [t.bestScore, s.bestScore],
    [t.streak, liveStreak(save, day)],
    [t.best, save.streak.best],
    [t.rating, save.rating],
    [t.freeze, save.streak.freezes],
  ];
  return (
    <Sub title={`📊 ${t.stats}`} back={back}>
      <div className="statgrid">
        {items.map(([k, v]) => <div key={k}><b>{v}</b><small>{k}</small></div>)}
      </div>
    </Sub>
  );
}

function Settings({ t, save, update, back }: { t: Strings; save: Save; update: (fn: (s: Save) => Save) => void; back: () => void }) {
  const [confirm, setConfirm] = useState(false);
  return (
    <Sub title={`⚙ ${t.settings}`} back={back}>
      <label className="field">{t.language}
        <select value={save.lang ?? 'en'} onChange={(e) => update((s) => ({ ...s, lang: e.target.value as Lang }))}>
          {LANGS.map((l) => <option key={l.code} value={l.code}>{l.flag} {l.name}</option>)}
        </select>
      </label>
      <label className="field">{t.name}
        <input value={save.name} maxLength={16} onChange={(e) => update((s) => ({ ...s, name: e.target.value }))} />
      </label>
      <label className="field">{t.yourCity}
        <input value={save.city} maxLength={30} onChange={(e) => update((s) => ({ ...s, city: e.target.value }))} />
      </label>
      <label className="field">{t.yourCountry}
        <select value={save.country} onChange={(e) => update((s) => ({ ...s, country: e.target.value }))}>
          <option value="">–</option>
          {COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </label>
      <button className="danger" onClick={() => {
        if (!confirm) return setConfirm(true);
        update((s) => ({ ...loadEmptyKeepLang(s) }));
        setConfirm(false);
      }}>{confirm ? t.resetConfirm : t.reset}</button>
    </Sub>
  );
}

function loadEmptyKeepLang(s: Save): Save {
  return { ...s, tokens: 10, rating: 1000, streak: { count: 0, best: 0, lastDay: null, freezes: 1 }, daily: {}, campaign: {}, album: {}, stats: { played: 0, won: 0, totalMs: 0, bestScore: 0 }, lastChest: null };
}

function Premium({ t, save, update, back }: { t: Strings; save: Save; update: (fn: (s: Save) => Save) => void; back: () => void }) {
  const buy = async (plan: 'monthly' | 'yearly') => {
    if (await billing.purchase(plan)) update((s) => ({ ...s, premium: true }));
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
