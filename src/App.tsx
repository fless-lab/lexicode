import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Lang } from './engine/types';
import { PACKS } from './content';
import { STRINGS } from './i18n';
import { loadSave, persist, today, bumpStreak, liveStreak, updateRating, bumpRecord, type Save } from './storage';
import { ranking } from './services/ranking';
import { ads, REWARD } from './services/monetization';
import { Play, fmt, type FinishInfo } from './ui/Play';
import { rulesFor, puzzleFor, recordKey, isBossLevel, marathonDifficulty, MARATHON_BONUS_MS, type Mode } from './modes';
import { xpFor, playerLevel, titleIndex, newAchievements, rollLeague, ACH_REWARD, ACHIEVEMENTS, type GameEvent } from './progress';
import { sfx, setSound } from './sound';
import { LangPicker, Home, Arena, Ranking, Album, Profile, League, Settings, Premium, type Screen } from './ui/screens';

interface End {
  type: 'win' | 'fail' | 'marathon';
  score: number;
  stars: number;
  ms: number;
  mistakes: number;
  hints: number;
  timeBonus: number;
  ratingDelta: number;
  record: boolean;
  xp: number;
  reason?: 'time' | 'mistakes';
  run?: number;
}

interface Toast {
  id: number;
  text: string;
  kind?: 'ach' | 'lvl' | 'info';
}

export default function App() {
  const [save, setSave] = useState<Save>(loadSave);
  const [screen, setScreen] = useState<Screen>('home');
  const [mode, setMode] = useState<Mode | null>(null);
  const [deadline, setDeadline] = useState<number | null>(null);
  const [end, setEnd] = useState<End | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [adOpen, setAdOpen] = useState<'offer' | 'playing' | null>(null);
  const marathonStart = useRef(0);
  const saveRef = useRef(save);
  saveRef.current = save;

  useEffect(() => persist(save), [save]);
  useEffect(() => setSound(save.settings.sound, save.settings.haptics), [save.settings]);

  const toast = useCallback((text: string, kind: Toast['kind'] = 'info') => {
    const id = Date.now() + Math.random();
    setToasts((ts) => [...ts, { id, text, kind }]);
    setTimeout(() => setToasts((ts) => ts.filter((x) => x.id !== id)), kind === 'info' ? 1800 : 3200);
  }, []);

  const lang: Lang = save.lang ?? 'en';
  const t = STRINGS[lang];
  const pack = PACKS[lang];
  const day = today();

  // Clôture de la ligue hebdomadaire à l'ouverture.
  useEffect(() => {
    const { save: n, result } = rollLeague(saveRef.current);
    if (n !== saveRef.current) setSave(n);
    if (result === 'up') setTimeout(() => toast(`${t.leagueUp} : ${t.leagueNames[n.league.tier]}`, 'lvl'), 600);
    if (result === 'down') setTimeout(() => toast(`${t.leagueDown} : ${t.leagueNames[n.league.tier]}`), 600);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const puzzle = useMemo(() => (mode ? puzzleFor(pack, mode) : null), [mode, pack]);
  const rules = useMemo(() => (mode ? rulesFor(mode) : null), [mode]);

  const start = (m: Mode) => {
    const r = rulesFor(m);
    setMode(m);
    setEnd(null);
    setDeadline(r.timeMs !== null ? Date.now() + r.timeMs : null);
    if (m.kind === 'marathon') marathonStart.current = Date.now();
    setScreen('play');
  };

  /** XP, ligue, niveau du joueur et succès, appliqués à chaque fin de partie. */
  const progressAfter = (s: Save, e: GameEvent): { save: Save; xp: number } => {
    const xp = xpFor(e);
    const beforeLvl = playerLevel(s.xp);
    let n: Save = { ...s, xp: s.xp + xp, league: { ...s.league, xp: s.league.xp + xp } };
    const afterLvl = playerLevel(n.xp);
    if (afterLvl > beforeLvl) {
      n.tokens += 5 * (afterLvl - beforeLvl);
      setTimeout(() => {
        sfx.unlock();
        toast(`⬆ ${t.levelUp} ${afterLvl} · ${t.titles[titleIndex(afterLvl)]}`, 'lvl');
      }, 900);
    }
    const ach = newAchievements(n, e);
    if (ach.length) {
      n = { ...n, achievements: [...n.achievements, ...ach], tokens: n.tokens + ach.length * ACH_REWARD };
      ach.forEach((id, i) => {
        const a = ACHIEVEMENTS.find((x) => x.id === id)!;
        setTimeout(() => {
          sfx.unlock();
          toast(`${a.icon} ${t.achUnlocked} : ${t.achs[id]?.[0] ?? id}`, 'ach');
        }, 1400 + i * 900);
      });
    }
    return { save: n, xp };
  };

  const onFinish = (info: FinishInfo) => {
    if (!mode || !puzzle || !rules) return;
    const s0 = saveRef.current;

    // Marathon : la grille suivante s'enchaîne, avec du temps en plus.
    if (mode.kind === 'marathon') {
      const run = (mode.run ?? 0) + 1;
      const bonus = MARATHON_BONUS_MS(marathonDifficulty(run - 1));
      const al = new Set(s0.album[lang] ?? []);
      al.add(puzzle.phraseIndex);
      setSave({ ...s0, album: { ...s0.album, [lang]: [...al] } });
      setDeadline((d) => (d ?? Date.now()) + bonus);
      toast(`✓ ${run} · +${Math.round(bonus / 1000)} s`);
      setTimeout(() => setMode({ ...mode, run }), 700);
      return;
    }

    const boss = mode.kind === 'level' && isBossLevel(mode.level!);
    const timeBonus = info.remainingMs !== null ? Math.round((info.remainingMs / 1000) * 4) : 0;
    const score = Math.round(info.score * rules.mult) + timeBonus;
    const newRating = updateRating(s0.rating, puzzle.rating, info.score);
    let n: Save = {
      ...s0,
      rating: newRating,
      stats: { played: s0.stats.played + 1, won: s0.stats.won + 1, totalMs: s0.stats.totalMs + info.ms, bestScore: Math.max(s0.stats.bestScore, score) },
      counters: {
        ...s0.counters,
        noHintWins: s0.counters.noHintWins + (info.hints === 0 ? 1 : 0),
        bossWins: s0.counters.bossWins + (boss ? 1 : 0),
      },
    };
    const al = new Set(n.album[lang] ?? []);
    al.add(puzzle.phraseIndex);
    n.album = { ...n.album, [lang]: [...al] };
    let record = false;

    if (mode.kind === 'daily' && !s0.daily[lang]?.[mode.date!]) {
      n.daily = { ...n.daily, [lang]: { ...(n.daily[lang] ?? {}), [mode.date!]: { score, ms: info.ms, mistakes: info.mistakes, hints: info.hints } } };
      n.tokens += REWARD.daily;
      if (mode.date === day) n = bumpStreak(n, day);
      ranking.submit(lang, mode.date!, { name: n.name, city: n.city, country: n.country, score, ms: info.ms });
    } else if (mode.kind === 'level') {
      const c = n.campaign[lang] ?? { level: 1, stars: {} };
      const firstClear = !c.stars[mode.level!];
      n.campaign = {
        ...n.campaign,
        [lang]: { level: Math.max(c.level, mode.level! + 1), stars: { ...c.stars, [mode.level!]: Math.max(c.stars[mode.level!] ?? 0, info.stars) } },
      };
      if (firstClear) n.tokens += (info.stars === 3 ? REWARD.levelPerfect : REWARD.level) + (boss ? 5 : 0);
    }
    const key = recordKey(mode);
    if (key) {
      const prev = n.records[lang]?.[key]?.best ?? 0;
      record = score > prev && prev > 0;
      n = bumpRecord(n, lang, key, true, score, info.ms);
    }
    const ev: GameEvent = { kind: mode.kind, won: true, score, ms: info.ms, stars: info.stars, hints: info.hints, mistakes: info.mistakes, d: puzzle.difficulty, boss };
    const { save: n2, xp } = progressAfter(n, ev);
    setSave(n2);
    setEnd({ type: 'win', score, stars: info.stars, ms: info.ms, mistakes: info.mistakes, hints: info.hints, timeBonus, ratingDelta: newRating - s0.rating, record, xp });
  };

  const onFail = (reason: 'time' | 'mistakes', info: FinishInfo) => {
    if (!mode || !puzzle) return;
    const s0 = saveRef.current;
    if (mode.kind === 'marathon') {
      const run = mode.run ?? 0;
      const total = Date.now() - marathonStart.current;
      const prev = s0.records[lang]?.marathon?.best ?? 0;
      const n = bumpRecord({ ...s0, stats: { ...s0.stats, played: s0.stats.played + 1 } }, lang, 'marathon', run > 0, run, total);
      const { save: n2, xp } = progressAfter(n, { kind: 'marathon', won: run > 0, score: run, ms: total, stars: 0, hints: 0, mistakes: 0, d: 1, run });
      setSave(n2);
      setEnd({ type: 'marathon', score: run, stars: 0, ms: total, mistakes: info.mistakes, hints: 0, timeBonus: 0, ratingDelta: 0, record: run > prev && prev > 0, xp, reason, run });
      return;
    }
    let n: Save = { ...s0, stats: { ...s0.stats, played: s0.stats.played + 1 }, counters: { ...s0.counters, fails: s0.counters.fails + 1 } };
    n.rating = updateRating(s0.rating, puzzle.rating, 0);
    const key = recordKey(mode);
    if (key) n = bumpRecord(n, lang, key, false, 0, info.ms);
    const { save: n2, xp } = progressAfter(n, { kind: mode.kind, won: false, score: 0, ms: info.ms, stars: 0, hints: info.hints, mistakes: info.mistakes, d: puzzle.difficulty });
    setSave(n2);
    setEnd({ type: 'fail', score: 0, stars: 0, ms: info.ms, mistakes: info.mistakes, hints: info.hints, timeBonus: 0, ratingDelta: n.rating - s0.rating, record: false, xp, reason });
  };

  if (!save.lang) return <LangPicker onPick={(l) => setSave((s) => ({ ...s, lang: l }))} />;

  const spend = (k: number) => {
    if (saveRef.current.tokens < k) return false;
    setSave((s) => ({ ...s, tokens: s.tokens - k }));
    return true;
  };

  const watchAd = async () => {
    setAdOpen('playing');
    const ok = await ads.showRewarded();
    setAdOpen(null);
    if (ok) {
      sfx.coin();
      setSave((s) => ({ ...s, tokens: s.tokens + REWARD.ad }));
    }
  };

  const modeName = (m: Mode): string => {
    if (m.kind === 'daily') return t.daily;
    if (m.kind === 'level') return `${isBossLevel(m.level!) ? '👹 ' + t.boss + ' · ' : ''}${t.level} ${m.level}`;
    if (m.kind === 'practice') return t.practice;
    return (t[`mode_${m.kind}` as 'mode_zen'] as string[])[0];
  };
  const title = mode ? modeName(mode) : '';
  const subtitle = mode?.kind === 'marathon' ? `${t.d[marathonDifficulty(mode.run ?? 0)]} · ✓ ${mode.run ?? 0} ${t.grids}` : undefined;

  const goHome = () => {
    setScreen('home');
    setMode(null);
    setEnd(null);
    setDeadline(null);
  };
  const retry = () => mode && start({ ...mode, nonce: String(Date.now()), run: 0 });
  const nextLevel = () => {
    if (!mode?.level) return;
    const level = mode.level + 1;
    start({ kind: 'level', level, d: puzzleFor(pack, { ...mode, level }).difficulty, nonce: '' });
  };

  const shareResult = async () => {
    if (!end || !mode) return;
    const head = mode.kind === 'daily' ? `Lexicode ${mode.date}` : `Lexicode · ${title}`;
    const body =
      end.type === 'marathon'
        ? `🏃 ${end.run} ${t.grids} · ${fmt(end.ms)}`
        : end.type === 'fail'
          ? `💔 ${t.failTitle} · ${fmt(end.ms)}`
          : `${'★'.repeat(end.stars)}${'☆'.repeat(3 - end.stars)} ${end.score} pts · ${fmt(end.ms)}\n✕ ${end.mistakes} · 💡 ${end.hints} · 🔥 ${liveStreak(save, day)}`;
    const text = `${head}\n${body}`;
    try {
      if (navigator.share) await navigator.share({ text });
      else {
        await navigator.clipboard.writeText(text);
        toast(t.copied);
      }
    } catch {
      /* partage annulé */
    }
  };

  const overlay = end && puzzle && mode && (
    <div className="modal">
      <div className={`sheet result ${end.type}`}>
        {end.type === 'win' && (
          <>
            <div className="stars">{[1, 2, 3].map((i) => <span key={i} className={i <= end.stars ? 'on' : ''}>★</span>)}</div>
            <h2>{t.solved}</h2>
          </>
        )}
        {end.type === 'fail' && (
          <>
            <div className="failicon">{end.reason === 'time' ? '⌛' : '💔'}</div>
            <h2 className="red">{t.failTitle}</h2>
            <p className="muted center">{end.reason === 'time' ? t.failTime : t.failMistakes}</p>
          </>
        )}
        {end.type === 'marathon' && (
          <>
            <div className="failicon">🏃</div>
            <h2>{t.marathonOver}</h2>
            <div className="bignum">{end.run} <small>{t.grids}</small></div>
          </>
        )}
        <blockquote>{puzzle.phraseText}</blockquote>
        {end.type !== 'marathon' && (
          <div className="kpis">
            <div><b>{end.score}</b><small>{t.score}</small></div>
            <div><b>{fmt(end.ms)}</b><small>{t.time}</small></div>
            <div><b>{end.mistakes}</b><small>{t.mistakes}</small></div>
            <div><b>{end.hints}</b><small>{t.hintsUsed}</small></div>
          </div>
        )}
        <p className="delta">
          {end.timeBonus > 0 && <span className="badge blue">⏳ {t.timeBonus} +{end.timeBonus}</span>}
          <span className="badge purple">+{end.xp} {t.xp}</span>
          {end.ratingDelta !== 0 && (
            <span className={end.ratingDelta >= 0 ? 'up' : 'down'}> 🧠 {save.rating} ({end.ratingDelta >= 0 ? '+' : ''}{end.ratingDelta})</span>
          )}
          {end.record && <span className="badge">{t.newRecord}</span>}
        </p>
        <div className="row">
          <button onClick={shareResult}>{t.share}</button>
          {end.type === 'win' && mode.kind === 'level' ? (
            <button className="primary" onClick={nextLevel}>{t.next}</button>
          ) : end.type === 'win' && mode.kind === 'daily' ? (
            <button className="primary" onClick={() => { setEnd(null); setScreen('ranking'); }}>{t.ranking}</button>
          ) : end.type === 'fail' && (mode.kind === 'level' || mode.kind === 'daily') ? (
            <button className="primary" onClick={() => start({ ...mode })}>{t.retry}</button>
          ) : (
            <button className="primary" onClick={retry}>{end.type === 'win' ? t.play : t.retry}</button>
          )}
        </div>
        <button className="link" onClick={goHome}>{t.home}</button>
      </div>
    </div>
  );

  return (
    <div className="app">
      {screen === 'home' && <Home t={t} save={save} day={day} lang={lang} onStart={start} go={setScreen} setSave={setSave} toast={toast} />}
      {screen === 'arena' && <Arena t={t} save={save} lang={lang} onStart={start} back={() => setScreen('home')} />}
      {screen === 'play' && puzzle && rules && mode && (
        <Play
          key={mode.kind === 'marathon' ? `m-${mode.nonce}-${mode.run ?? 0}` : `${mode.kind}-${mode.nonce}-${mode.level ?? ''}-${mode.d}`}
          puzzle={puzzle}
          title={title}
          subtitle={subtitle}
          t={t}
          tokens={save.tokens}
          premium={save.premium}
          rules={rules}
          deadline={deadline}
          spend={spend}
          onNeedTokens={() => setAdOpen('offer')}
          onFinish={onFinish}
          onFail={onFail}
          onMistake={
            rules.mistakePenaltyMs
              ? () => {
                  setDeadline((d) => (d === null ? d : d - rules.mistakePenaltyMs));
                  toast(`-${rules.mistakePenaltyMs / 1000} s`);
                }
              : undefined
          }
          onExit={goHome}
          overlay={overlay}
          showTutorial={!save.tutorialDone}
          onTutorialDone={() => {
            setSave((s) => ({ ...s, tutorialDone: true }));
            if (rules.timeMs !== null) setDeadline(Date.now() + rules.timeMs);
          }}
        />
      )}
      {screen === 'ranking' && <Ranking t={t} save={save} lang={lang} day={day} back={() => setScreen('home')} />}
      {screen === 'album' && <Album t={t} save={save} lang={lang} back={() => setScreen('home')} />}
      {screen === 'profile' && <Profile t={t} save={save} lang={lang} day={day} back={() => setScreen('home')} />}
      {screen === 'league' && <League t={t} save={save} back={() => setScreen('home')} />}
      {screen === 'settings' && <Settings t={t} save={save} setSave={setSave} back={() => setScreen('home')} />}
      {screen === 'premium' && <Premium t={t} save={save} setSave={setSave} back={() => setScreen('home')} />}

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
      <div className="toasts">
        {toasts.map((x) => <div key={x.id} className={`toast ${x.kind ?? 'info'}`}>{x.text}</div>)}
      </div>
    </div>
  );
}
