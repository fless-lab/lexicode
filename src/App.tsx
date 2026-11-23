import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Lang } from './engine/types';
import { PACKS } from './content';
import { STRINGS } from './i18n';
import { loadSave, persist, today, bumpStreak, liveStreak, updateRating, bumpRecord, type Save } from './storage';
import { ranking } from './services/ranking';
import { ads, REWARD } from './services/monetization';
import { Play, fmt, type FinishInfo } from './ui/Play';
import { rulesFor, puzzleFor, recordKey, isBossLevel, marathonDifficulty, MARATHON_BONUS_MS, type Mode } from './modes';
import { dailyPuzzle } from './engine/generator';
import { xpFor, playerLevel, titleIndex, newAchievements, rollLeague, ACH_REWARD, type GameEvent } from './progress';
import { applyQuests, freshQuests, freshSeason, questsFor, QUEST_BONUS, tierReward, seasonTier, type BoosterId, type Reward } from './meta';
import { sfx, setSound } from './sound';
import { Icon, MODE_ICON, achIcon } from './ui/Icon';
import { LangPicker, Home, Arena, Season, Ranking, Album, Profile, League, Settings, Premium, TabBar, type Screen } from './ui/screens';

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
  maxCombo: number;
  reason?: 'time' | 'mistakes';
  run?: number;
}

interface Toast {
  id: number;
  text: string;
  sub?: string;
  kind: 'ach' | 'lvl' | 'info';
  icon?: string;
}

const TAB_SCREENS: Screen[] = ['home', 'arena', 'season', 'ranking', 'profile'];

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

  useEffect(() => { persist(save); }, [save]);
  useEffect(() => { setSound(save.settings.sound, save.settings.haptics); }, [save.settings]);
  useEffect(() => { window.scrollTo(0, 0); }, [screen]);

  const toast = useCallback((text: string, kind: Toast['kind'] = 'info', icon?: string, sub?: string) => {
    const id = Date.now() + Math.random();
    setToasts((ts) => [...ts.slice(-2), { id, text, kind, icon, sub }]);
    setTimeout(() => setToasts((ts) => ts.filter((x) => x.id !== id)), kind === 'info' ? 1900 : 3400);
  }, []);

  const lang: Lang = save.lang ?? 'en';
  const t = STRINGS[lang];
  const pack = PACKS[lang];
  const day = today();
  const daily = useMemo(() => dailyPuzzle(pack, day), [pack, day]);

  // À l'ouverture : clôture de la ligue, nouvelle saison, nouvelles quêtes.
  useEffect(() => {
    const { save: n0, result } = rollLeague(saveRef.current);
    const n = { ...n0, season: freshSeason(day, n0.season), quests: freshQuests(day, n0.quests) };
    setSave(n);
    if (result === 'up') setTimeout(() => toast(`${t.leagueUp} : ${t.leagueNames[n.league.tier]}`, 'lvl', 'medal'), 600);
    if (result === 'down') setTimeout(() => toast(`${t.leagueDown} : ${t.leagueNames[n.league.tier]}`, 'info', 'medal'), 600);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const puzzle = useMemo(() => (mode ? puzzleFor(pack, mode) : null), [mode, pack]);
  const rules = useMemo(() => (mode ? rulesFor(mode) : null), [mode]);

  const start = (m: Mode) => {
    const r = rulesFor(m);
    sfx.open();
    setMode(m);
    setEnd(null);
    setDeadline(r.timeMs !== null ? Date.now() + r.timeMs : null);
    if (m.kind === 'marathon') marathonStart.current = Date.now();
    setScreen('play');
  };

  const grant = (s: Save, r: Reward): Save => {
    let n = s;
    if (r.tokens) n = { ...n, tokens: n.tokens + r.tokens };
    if (r.booster) n = { ...n, boosters: { ...n.boosters, [r.booster]: (n.boosters[r.booster] ?? 0) + 1 } };
    if (r.skin && !n.skins.includes(r.skin)) n = { ...n, skins: [...n.skins, r.skin] };
    return n;
  };

  const celebrate = (n: Save, e: GameEvent | null): Save => {
    const ach = newAchievements(n, e);
    if (!ach.length) return n;
    ach.forEach((id, i) =>
      setTimeout(() => {
        sfx.unlock();
        toast(t.achs[id]?.[0] ?? id, 'ach', achIcon(id), `${t.achUnlocked}, +${ACH_REWARD}`);
      }, 1200 + i * 1000),
    );
    return { ...n, achievements: [...n.achievements, ...ach], tokens: n.tokens + ach.length * ACH_REWARD };
  };

  /** XP (doublée si le bonus est armé), saison, ligue, quêtes, niveau du joueur et succès. */
  const progressAfter = (s: Save, e: GameEvent): { save: Save; xp: number } => {
    const xp = xpFor(e) * (s.doubleArmed ? 2 : 1);
    const beforeLvl = playerLevel(s.xp);
    const season = freshSeason(day, s.season);
    const beforeTier = seasonTier(season.xp);
    let n: Save = {
      ...s,
      xp: s.xp + xp,
      doubleArmed: false,
      league: { ...s.league, xp: s.league.xp + xp },
      season: { ...season, xp: season.xp + xp },
      quests: applyQuests(s.quests, day, e),
    };
    const afterLvl = playerLevel(n.xp);
    if (afterLvl > beforeLvl) {
      n.tokens += 5 * (afterLvl - beforeLvl);
      setTimeout(() => { sfx.unlock(); toast(`${t.levelUp} ${afterLvl}`, 'lvl', 'sparkle', t.titles[titleIndex(afterLvl)]); }, 900);
    }
    const afterTier = seasonTier(n.season.xp);
    if (afterTier > beforeTier) setTimeout(() => toast(`${t.tier} ${afterTier}`, 'lvl', 'flag', t.gotReward), 1100);
    const done = questsFor(day).filter((q) => (n.quests.progress[q.id] ?? 0) >= q.target && !(s.quests.progress[q.id] >= q.target));
    done.forEach((q, i) => setTimeout(() => toast(t.quests, 'info', 'check', `${t[`q_${q.id}` as 'q_win3'].replace('{n}', String(q.target))}`), 700 + i * 600));
    n = celebrate(n, e);
    return { save: n, xp };
  };

  const onFinish = (info: FinishInfo) => {
    if (!mode || !puzzle || !rules) return;
    const s0 = saveRef.current;

    if (mode.kind === 'marathon') {
      const run = (mode.run ?? 0) + 1;
      const bonus = MARATHON_BONUS_MS(marathonDifficulty(run - 1));
      const al = new Set(s0.album[lang] ?? []);
      al.add(puzzle.phraseIndex);
      setSave({ ...s0, album: { ...s0.album, [lang]: [...al] } });
      setDeadline((d) => (d ?? Date.now()) + bonus);
      toast(`${run}`, 'info', 'run', `+${Math.round(bonus / 1000)} s`);
      setMode({ ...mode, run });
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
    const ev: GameEvent = { kind: mode.kind, won: true, score, ms: info.ms, stars: info.stars, hints: info.hints, mistakes: info.mistakes, d: puzzle.difficulty, boss, maxCombo: info.maxCombo, words: info.words };
    const { save: n2, xp } = progressAfter(n, ev);
    setSave(n2);
    setEnd({ type: 'win', score, stars: info.stars, ms: info.ms, mistakes: info.mistakes, hints: info.hints, timeBonus, ratingDelta: newRating - s0.rating, record, xp, maxCombo: info.maxCombo });
  };

  const onFail = (reason: 'time' | 'mistakes', info: FinishInfo) => {
    if (!mode || !puzzle) return;
    const s0 = saveRef.current;
    if (mode.kind === 'marathon') {
      const run = mode.run ?? 0;
      const total = Date.now() - marathonStart.current;
      const prev = s0.records[lang]?.marathon?.best ?? 0;
      const n = bumpRecord({ ...s0, stats: { ...s0.stats, played: s0.stats.played + 1 } }, lang, 'marathon', run > 0, run, total);
      const { save: n2, xp } = progressAfter(n, { kind: 'marathon', won: run > 0, score: run, ms: total, stars: 0, hints: 0, mistakes: 0, d: 1, run, maxCombo: info.maxCombo, words: info.words });
      setSave(n2);
      setEnd({ type: 'marathon', score: run, stars: 0, ms: total, mistakes: info.mistakes, hints: 0, timeBonus: 0, ratingDelta: 0, record: run > prev && prev > 0, xp, maxCombo: info.maxCombo, reason, run });
      return;
    }
    let n: Save = { ...s0, stats: { ...s0.stats, played: s0.stats.played + 1 }, counters: { ...s0.counters, fails: s0.counters.fails + 1 } };
    n.rating = updateRating(s0.rating, puzzle.rating, 0);
    const key = recordKey(mode);
    if (key) n = bumpRecord(n, lang, key, false, 0, info.ms);
    const { save: n2, xp } = progressAfter(n, { kind: mode.kind, won: false, score: 0, ms: info.ms, stars: 0, hints: info.hints, mistakes: info.mistakes, d: puzzle.difficulty, maxCombo: info.maxCombo, words: info.words });
    setSave(n2);
    setEnd({ type: 'fail', score: 0, stars: 0, ms: info.ms, mistakes: info.mistakes, hints: info.hints, timeBonus: 0, ratingDelta: n.rating - s0.rating, record: false, xp, maxCombo: info.maxCombo, reason });
  };

  if (!save.lang) return <LangPicker onPick={(l) => setSave((s) => ({ ...s, lang: l }))} />;

  // ---------- Actions ----------
  const spend = (k: number) => {
    if (saveRef.current.tokens < k) return false;
    setSave((s) => ({ ...s, tokens: s.tokens - k }));
    return true;
  };
  const useBooster = (id: BoosterId) => {
    if (!saveRef.current.boosters[id]) return false;
    setSave((s) => ({ ...s, boosters: { ...s.boosters, [id]: s.boosters[id] - 1 } }));
    return true;
  };
  const claimQuest = (id: string) => {
    const q = questsFor(day).find((x) => x.id === id);
    if (!q) return;
    sfx.coin();
    setSave((s) => {
      const qs = freshQuests(day, s.quests);
      if (qs.claimed.includes(id)) return s;
      let n = grant({ ...s, quests: { ...qs, claimed: [...qs.claimed, id] } }, { tokens: q.reward.tokens, booster: q.reward.booster });
      n = { ...n, xp: n.xp + q.reward.xp, season: { ...freshSeason(day, n.season), xp: freshSeason(day, n.season).xp + q.reward.xp }, league: { ...n.league, xp: n.league.xp + q.reward.xp } };
      return n;
    });
    toast(`+${q.reward.tokens}`, 'info', 'token', q.reward.booster ? (t[`b_${q.reward.booster}` as 'b_freeze'] as string[])[0] : `+${q.reward.xp} ${t.xp}`);
  };
  const claimQuestBonus = () => {
    sfx.unlock();
    setSave((s) => {
      const qs = freshQuests(day, s.quests);
      if (qs.bonusClaimed) return s;
      const n = grant({ ...s, quests: { ...qs, bonusClaimed: true }, counters: { ...s.counters, questDays: s.counters.questDays + 1 } }, { tokens: QUEST_BONUS.tokens, booster: QUEST_BONUS.booster });
      return celebrate(n, null);
    });
    toast(t.questBonus, 'lvl', 'gift', `+${QUEST_BONUS.tokens}`);
  };
  const claimTier = (tier: number, premium: boolean) => {
    const r = tierReward(tier, premium);
    sfx.unlock();
    setSave((s) => {
      const se = freshSeason(day, s.season);
      const list = premium ? se.claimedPremium : se.claimed;
      if (list.includes(tier) || seasonTier(se.xp) < tier) return s;
      const season = premium ? { ...se, claimedPremium: [...list, tier] } : { ...se, claimed: [...list, tier] };
      return celebrate(grant({ ...s, season }, r), null);
    });
    toast(t.gotReward, 'info', r.skin ? 'palette' : r.booster ? 'sparkle' : 'token');
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
    if (m.kind === 'level') return `${isBossLevel(m.level!) ? t.boss + ', ' : ''}${t.level} ${m.level}`;
    if (m.kind === 'practice') return t.practice;
    return (t[`mode_${m.kind}` as 'mode_zen'] as string[])[0];
  };
  const title = mode ? modeName(mode) : '';
  const subtitle = !puzzle
    ? []
    : mode?.kind === 'marathon'
      ? [t.d[marathonDifficulty(mode.run ?? 0)], `${mode.run ?? 0} ${t.grids}`]
      : [t.d[puzzle.difficulty], (t[`cat_${puzzle.category}` as 'cat_fact'] as string) ?? puzzle.category];

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
    const head = mode.kind === 'daily' ? `Lexicode ${mode.date}` : `Lexicode, ${title}`;
    const body =
      end.type === 'marathon'
        ? `${end.run} ${t.grids} en ${fmt(end.ms)}`
        : end.type === 'fail'
          ? `${t.failTitle} (${fmt(end.ms)})`
          : `${'★'.repeat(end.stars)}${'☆'.repeat(3 - end.stars)} ${end.score} pts, ${fmt(end.ms)}\n${t.mistakes} ${end.mistakes}, ${t.combo} ${end.maxCombo}, ${t.streak} ${liveStreak(save, day)}`;
    const text = `${head}\n${body}`;
    try {
      if (navigator.share) await navigator.share({ text });
      else {
        await navigator.clipboard.writeText(text);
        toast(t.copied, 'info', 'check');
      }
    } catch {
      /* partage annulé */
    }
  };

  const overlay = end && puzzle && mode && (
    <div className="modal">
      <div className={`sheet result ${end.type}`} role="dialog" aria-label={end.type === 'win' ? t.solved : t.failTitle}>
        {end.type === 'win' && (
          <>
            <span className="seal win"><Icon name={MODE_ICON[mode.kind] ?? 'check'} size={34} /></span>
            <div className="stars">{[1, 2, 3].map((i) => <Icon key={i} name="starFill" size={28} className={i <= end.stars ? 'on' : ''} />)}</div>
            <h2>{t.solved}</h2>
          </>
        )}
        {end.type === 'fail' && (
          <>
            <span className="seal fail"><Icon name={end.reason === 'time' ? 'hourglass' : 'heart'} size={34} /></span>
            <h2>{t.failTitle}</h2>
            <p className="lead">{end.reason === 'time' ? t.failTime : t.failMistakes}</p>
          </>
        )}
        {end.type === 'marathon' && (
          <>
            <span className="seal run"><Icon name="run" size={34} /></span>
            <h2>{t.marathonOver}</h2>
            <div className="bignum">{end.run} <small>{t.grids}</small></div>
          </>
        )}
        <p className="quote">{puzzle.phraseText}</p>
        {end.type !== 'marathon' && (
          <div className="kpis">
            <div><b>{end.score}</b><small>{t.score}</small></div>
            <div><b>{fmt(end.ms)}</b><small>{t.time}</small></div>
            <div><b>{end.maxCombo}</b><small>{t.combo}</small></div>
            <div><b>{end.mistakes}</b><small>{t.mistakes}</small></div>
          </div>
        )}
        <div className="gains">
          <span className="gain xp"><Icon name="sparkle" size={14} />+{end.xp} {t.xp}</span>
          {end.timeBonus > 0 && <span className="gain time"><Icon name="hourglass" size={14} />+{end.timeBonus}</span>}
          {end.ratingDelta !== 0 && (
            <span className={`gain ${end.ratingDelta >= 0 ? 'up' : 'down'}`}><Icon name="brain" size={14} />{save.rating} ({end.ratingDelta >= 0 ? '+' : ''}{end.ratingDelta})</span>
          )}
          {end.record && <span className="gain rec"><Icon name="trophy" size={14} />{t.newRecord}</span>}
        </div>
        <div className="row">
          <button className="btn" onClick={shareResult}><Icon name="share" size={18} />{t.share}</button>
          {end.type === 'win' && mode.kind === 'level' ? (
            <button className="btn primary" onClick={nextLevel}>{t.next}</button>
          ) : end.type === 'win' && mode.kind === 'daily' ? (
            <button className="btn primary" onClick={() => { setEnd(null); setMode(null); setScreen('ranking'); }}>{t.ranking}</button>
          ) : end.type === 'fail' && (mode.kind === 'level' || mode.kind === 'daily') ? (
            <button className="btn primary" onClick={() => start({ ...mode })}><Icon name="rotate" size={18} />{t.retry}</button>
          ) : (
            <button className="btn primary" onClick={retry}>{end.type === 'win' ? t.play : t.retry}</button>
          )}
        </div>
        <button className="link" onClick={goHome}>{t.home}</button>
      </div>
    </div>
  );

  const qs = freshQuests(day, save.quests);
  const questReady = questsFor(day).some((q) => (qs.progress[q.id] ?? 0) >= q.target && !qs.claimed.includes(q.id));
  const se = freshSeason(day, save.season);
  const tierReady = Array.from({ length: seasonTier(se.xp) }, (_, i) => i + 1).some((tier) => !se.claimed.includes(tier));

  return (
    <div className={`app skin-${save.skin}`}>
      {screen === 'home' && <Home t={t} save={save} day={day} lang={lang} daily={daily} onStart={start} go={setScreen} setSave={setSave} claimQuest={claimQuest} claimQuestBonus={claimQuestBonus} toast={toast} />}
      {screen === 'arena' && <Arena t={t} save={save} lang={lang} day={day} onStart={start} setSave={setSave} go={setScreen} />}
      {screen === 'season' && <Season t={t} save={save} day={day} go={setScreen} claimTier={claimTier} setSave={setSave} />}
      {screen === 'ranking' && <Ranking t={t} save={save} lang={lang} day={day} go={setScreen} />}
      {screen === 'profile' && <Profile t={t} save={save} lang={lang} day={day} go={setScreen} />}
      {screen === 'album' && <Album t={t} save={save} lang={lang} back={() => setScreen('profile')} />}
      {screen === 'league' && <League t={t} save={save} back={() => setScreen('home')} />}
      {screen === 'settings' && <Settings t={t} save={save} setSave={setSave} back={() => setScreen('home')} />}
      {screen === 'premium' && <Premium t={t} save={save} setSave={setSave} back={() => setScreen('home')} />}
      {TAB_SCREENS.includes(screen) && <TabBar t={t} screen={screen} go={setScreen} badges={{ home: questReady, season: tierReady }} />}

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
          boosters={save.boosters}
          useBooster={useBooster}
          onFreeze={(ms) => setDeadline((d) => (d === null ? d : d + ms))}
          spend={spend}
          onNeedTokens={() => setAdOpen('offer')}
          onFinish={onFinish}
          onFail={onFail}
          onMistake={
            rules.mistakePenaltyMs
              ? () => {
                  setDeadline((d) => (d === null ? d : d - rules.mistakePenaltyMs));
                  toast(`-${rules.mistakePenaltyMs / 1000} s`, 'info', 'hourglass');
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

      {adOpen && (
        <div className="modal" onClick={() => adOpen === 'offer' && setAdOpen(null)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            {adOpen === 'offer' ? (
              <>
                <h2>{t.notEnoughTokens}</h2>
                <button className="btn primary block lg" onClick={watchAd}><Icon name="play" size={16} />{t.watchAd}</button>
                <button className="btn block" onClick={() => { setAdOpen(null); setScreen('premium'); }}><Icon name="crown" size={18} />{t.premium}</button>
              </>
            ) : (
              <div className="adplaying"><div className="spinner" />{t.adPlaying}</div>
            )}
          </div>
        </div>
      )}
      <div className="toasts" aria-live="polite">
        {toasts.map((x) => (
          <div key={x.id} className={`toast toast-${x.kind}`}>
            {x.icon && <span className="ti"><Icon name={x.icon} size={17} /></span>}
            <span>{x.text}{x.sub && <small>{x.sub}</small>}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
