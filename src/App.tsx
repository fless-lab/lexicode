import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Lang } from './engine/types';
import { PACKS } from './content';
import { STRINGS } from './i18n';
import { loadSave, persist, today, bumpStreak, liveStreak, updateRating, bumpRecord, markSeen, type Save } from './storage';
import { ranking } from './services/ranking';
import { ads, REWARD } from './services/monetization';
import { Play, fmt, type FinishInfo } from './ui/Play';
import { rulesFor, puzzleFor, recordKey, isBossLevel, marathonDifficulty, MARATHON_BONUS_MS, type Mode } from './modes';
import { dailyPuzzle } from './engine/generator';
import { xpFor, playerLevel, titleIndex, newAchievements, rollLeague, ACH_REWARD, type GameEvent } from './progress';
import { applyQuests, freshQuests, freshSeason, questsFor, QUEST_BONUS, tierReward, seasonTier, type BoosterId, type Reward } from './meta';
import { sfx, setSound } from './sound';
import { Icon, MODE_ICON, achIcon } from './ui/Icon';
import { WinFx, CountUp } from './ui/fx';
import { Loupi } from './ui/mascot';
import { Shop, Wardrobe, EventScreen, Snowfall, PacksScreen, ArchiveScreen, type ShopCtx } from './ui/shop';
import { activeEvent, eventDifficulty } from './events';
import { OutfitCtx } from './ui/mascot';
import { grant as grantItems, grantUnlocks, outfitOf, item as catItem } from './catalog';
import { loadPrices, entitlements } from './services/billing';
import { SHOP_STRINGS, fmtS } from './i18n-shop';
import { FRIEND_STRINGS } from './i18n-friends';
import { decodeMessage } from './friendMessage';
import { EVENTS } from './events';
import { RANKED } from './modes';
import { apiEnabled, openGame, finishGame, syncProfile, ensureSession, friends } from './services/api';
import { installHiddenPause } from './ui/useOffscreenPause';
import type { FlowStart, RewardInfo } from './ui/MultiFlow';
import type { Gains } from './ui/multi';
import { LangPicker, Home, Arena, Season, Ranking, Album, Profile, League, Settings, Premium, TabBar, type Screen } from './ui/screens';
import { AdventureScreen, ChapterIntro, RelicPicker, themeOf, MOD_ICON, RELIC_ICON } from './ui/adventure';

// Le jeu à plusieurs (Colyseus et ses écrans) n'est chargé qu'à la demande : il ne pèse plus sur le démarrage.
const loadMulti = () => import('./ui/MultiFlow');
const MultiFlow = lazy(() => loadMulti().then((m) => ({ default: m.MultiFlow })));
const Friends = lazy(() => import('./ui/friends').then((m) => ({ default: m.Friends })));
const MultiPreview = lazy(() => import('./ui/multi-preview').then((m) => ({ default: m.MultiPreview })));
import { levelInfo, LEVELS_PER_CHAPTER } from './chapters';
import { STORY } from './content/story';
import { makeFloor, floorName, floorPalette, relicOffer, count, START_HEARTS, MAX_HEARTS, type Run, type RelicId, type Floor } from './expedition';
import type { Perks } from './ui/Play';

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
  /** Partie classée terminée avec des aides : hors classement. */
  assisted?: boolean;
  reason?: 'time' | 'mistakes';
  run?: number;
  /** Fin d'expédition. */
  depth?: number;
  floor?: string;
}

interface Toast {
  id: number;
  text: string;
  sub?: string;
  kind: 'ach' | 'lvl' | 'info';
  icon?: string;
}

/** Jetons : le jeu en donne peu, pour que les objets gardent leur valeur. */
const MULTI_PAID = 3;
const LEVEL_UP_TOKENS = 2;

/** Part du lexique que l'entraînement évite parmi les mots déjà vus (au-delà, la grille aurait du mal à se construire). */
const AVOID_SHARE = 0.6;

const TAB_SCREENS: Screen[] = ['home', 'arena', 'season', 'ranking', 'profile'];
const PREVIEWS: Screen[] = [...TAB_SCREENS, 'album', 'league', 'settings', 'premium', 'adventure', 'shop', 'wardrobe', 'event', 'packs', 'archive'];

export default function App() {
  const [save, setSave] = useState<Save>(loadSave);
  // ?preview=shop|wardrobe|event ouvre directement une maquette à valider.
  const [screen, setScreen] = useState<Screen>(() => {
    const qp = new URLSearchParams(location.search);
    if (qp.get('salon') || qp.get('defi')) return 'multi';
    if (qp.get('ami')) return 'friends';
    // Seules les maquettes connues sont acceptées ; une valeur inconnue ramène à l'accueil.
    const preview = qp.get('preview') as Screen | null;
    return preview && PREVIEWS.includes(preview) ? preview : 'home';
  });
  const [mode, setMode] = useState<Mode | null>(null);
  const [deadline, setDeadline] = useState<number | null>(null);
  const [end, setEnd] = useState<End | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [adOpen, setAdOpen] = useState<'offer' | 'playing' | null>(null);
  const [intro, setIntro] = useState<{ chapter: number; cycle: number; abs: number; mode: Mode } | null>(null);
  const [relicChoice, setRelicChoice] = useState<{ run: Run; offer: RelicId[]; next: Floor } | null>(null);
  const marathonStart = useRef(0);
  /** Jeu à plusieurs : point d'entrée, y compris par un lien (?salon=CODE ou ?defi=CODE). */
  const [multiStart, setMultiStart] = useState<FlowStart>(() => {
    const qp = new URLSearchParams(location.search);
    const room = qp.get('salon');
    const ch = qp.get('defi');
    return room ? { to: 'room', code: room } : ch ? { to: 'challenge', code: ch } : { to: 'hub' };
  });
  /** Partie classée ouverte sur le serveur, et journaux des grilles déjà finies (marathon). */
  const serverGame = useRef<string | null>(null);
  const marathonLogs = useRef<[number, number, string][][]>([]);
  /** Lien ?ami=CODE : la demande d'ami part à l'ouverture de l'écran Amis. */
  const [friendLink, setFriendLink] = useState(() => new URLSearchParams(location.search).get('ami') ?? undefined);
  const [friendRequests, setFriendRequests] = useState(0);
  /** Lien ?msg=… : message chiffré d'un ami, ouvert directement en partie. */
  const [incomingMsg, setIncomingMsg] = useState(() => {
    const raw = new URLSearchParams(location.search).get('msg');
    return raw === null ? undefined : decodeMessage(raw);
  });
  const saveRef = useRef(save);
  saveRef.current = save;

  useEffect(() => { persist(save); }, [save]);
  useEffect(() => { setSound(save.settings.sound, save.settings.haptics); }, [save.settings]);
  useEffect(() => {
    if (!apiEnabled || !save.lang) return;
    const id = setTimeout(() => syncProfile({ name: save.name, city: save.city, country: save.country }), 1500);
    return () => clearTimeout(id);
  }, [save.name, save.city, save.country, save.lang]);
  useEffect(() => { window.scrollTo(0, 0); }, [screen]);
  // Demandes d'ami reçues : relues en arrivant sur l'accueil ou le profil (pastille de l'onglet Profil).
  useEffect(() => {
    if (!apiEnabled || !save.lang || (screen !== 'home' && screen !== 'profile')) return;
    const id = setTimeout(() => {
      ensureSession({ name: save.name, city: save.city, country: save.country })
        .then((ok) => (ok ? friends.list() : null))
        .then((i) => i && setFriendRequests(i.incoming.length))
        .catch(() => undefined);
    }, 1200);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen, save.lang]);

  // Une seule pastille à la fois : les suivantes attendent leur tour au lieu de s'empiler sur la grille.
  const toast = useCallback((text: string, kind: Toast['kind'] = 'info', icon?: string, sub?: string) => {
    const id = Date.now() + Math.random();
    setToasts((ts) => [...ts, { id, text, kind, icon, sub }].slice(-6));
  }, []);
  const headToast = toasts[0];
  useEffect(() => {
    if (!headToast) return;
    const h = setTimeout(() => setToasts((ts) => ts.slice(1)), headToast.kind === 'info' ? 1700 : 2600);
    return () => clearTimeout(h);
  }, [headToast]);

  const lang: Lang = save.lang ?? 'en';
  const t = STRINGS[lang];
  const pack = PACKS[lang];
  const day = today();
  const event = activeEvent(day);
  const shopCtx: ShopCtx = { save, setSave, lang: save.lang ?? 'en', t: STRINGS[save.lang ?? 'en'], toast };
  // Tenue de Loupi partout dans le jeu. Pendant un événement, il porte le chapeau de la fête s'il n'en a pas choisi.
  const outfit = { ...outfitOf(save), ...(event && !save.equip.hat ? { hat: event.outfit.hat } : {}), ...(event && save.equip.neck === 'scarf' ? { neck: event.outfit.neck } : {}) };
  const [, setPricesTick] = useState(0);
  useEffect(() => {
    loadPrices().then(() => setPricesTick((x) => x + 1));
    entitlements().then((e) => { if (e) setSave((s) => ({ ...s, premium: e.plus })); });
  }, []);
  // Les objets gagnés en jouant (chapitres, ligues) arrivent tout seuls dans la garde-robe.
  useEffect(() => {
    if (!save.lang) return;
    const n = grantUnlocks(save, save.lang);
    if (n !== save) {
      const fresh = n.owned.filter((id) => !save.owned.includes(id));
      setSave(n);
      fresh.forEach((id, k) => setTimeout(() => toast(fmtS(SHOP_STRINGS[save.lang!].newItem, { x: catItem(id)?.name[save.lang!] ?? id }), 'lvl', 'gift'), 800 + k * 700));
    }
  }, [save.campaign, save.league.tier, save.lang]);
  const daily = useMemo(() => dailyPuzzle(pack, day), [pack, day]);

  // Au retour de l'arrière-plan : animations relancées et nouveau rendu, pour que le changement de jour soit vu
  // même si Android a gardé l'application en mémoire plusieurs jours.
  const [, wake] = useState(0);
  useEffect(() => {
    const off = installHiddenPause();
    const onVis = () => { if (!document.hidden) wake((x) => x + 1); };
    document.addEventListener('visibilitychange', onVis);
    return () => { off(); document.removeEventListener('visibilitychange', onVis); };
  }, []);

  // Préchargement discret du jeu à plusieurs une fois l'accueil affiché, pour qu'il s'ouvre sans attente.
  useEffect(() => {
    if (screen !== 'home') return;
    const id = setTimeout(() => { void loadMulti().catch(() => undefined); }, 2500);
    return () => clearTimeout(id);
  }, [screen]);

  // À l'ouverture, puis à chaque nouveau jour : clôture de la ligue, nouvelle saison, nouvelles quêtes.
  useEffect(() => {
    const { save: n0, result } = rollLeague(saveRef.current);
    const n = { ...n0, season: freshSeason(day, n0.season), quests: freshQuests(day, n0.quests) };
    setSave(n);
    if (result === 'up') setTimeout(() => toast(`${t.leagueUp} : ${t.leagueNames[n.league.tier]}`, 'lvl', 'medal'), 600);
    if (result === 'down') setTimeout(() => toast(`${t.leagueDown} : ${t.leagueNames[n.league.tier]}`, 'info', 'medal'), 600);
  }, [day]); // eslint-disable-line react-hooks/exhaustive-deps

  const puzzle = useMemo(() => (mode ? puzzleFor(pack, mode) : null), [mode, pack]);
  // Chaque grille jouée enrichit la liste des mots déjà vus : l'entraînement ira chercher les autres.
  useEffect(() => {
    if (puzzle?.words.length) setSave((s) => markSeen(s, puzzle.lang, puzzle.words.map((w) => w.answer)));
  }, [puzzle]); // eslint-disable-line react-hooks/exhaustive-deps
  const rules = useMemo(() => (mode ? rulesFor(mode) : null), [mode]);

  const start = (m: Mode, skipIntro = false) => {
    // Ouverture de chapitre, une seule fois par chapitre.
    if (m.kind === 'level' && !skipIntro) {
      const info = levelInfo(m.level!);
      const abs = Math.floor((m.level! - 1) / LEVELS_PER_CHAPTER);
      if (info.step === 0 && !saveRef.current.seenChapters.includes(abs)) {
        setIntro({ chapter: info.chapter, cycle: info.cycle, abs, mode: m });
        return;
      }
    }
    sfx.open();
    serverGame.current = null;
    marathonLogs.current = [];
    if (apiEnabled && RANKED.includes(m.kind)) {
      const s = saveRef.current;
      // Le serveur note l'heure de départ et tire la graine de l'arène. Hors ligne, on joue quand même, sans classement.
      openGame(lang, m, { name: s.name, city: s.city, country: s.country }).then((o) => {
        if (o) serverGame.current = o.gameId;
        launch(o ? { ...m, nonce: o.mode.nonce || m.nonce } : m);
      });
      return;
    }
    launch(m);
  };
  // Message chiffré reçu par lien : la partie s'ouvre dès que la langue est choisie.
  useEffect(() => {
    if (incomingMsg === undefined || !save.lang) return;
    history.replaceState(null, '', location.pathname);
    setIncomingMsg(undefined);
    if (!incomingMsg) return toast(FRIEND_STRINGS[save.lang].msgBad, 'info', 'flag');
    start({ kind: 'message', d: 2, nonce: 'msg', msg: incomingMsg });
  }, [incomingMsg, save.lang]); // eslint-disable-line react-hooks/exhaustive-deps
  const launch = (m0: Mode) => {
    const avoidN = Math.floor(pack.entries.length * AVOID_SHARE);
    const m = m0.kind === 'practice' || m0.kind === 'zen' ? { ...m0, avoid: (saveRef.current.seen[lang] ?? []).slice(-avoidN) } : m0;
    const r = rulesFor(m);
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
      n.tokens += LEVEL_UP_TOKENS * (afterLvl - beforeLvl);
      setTimeout(() => { sfx.unlock(); toast(`${t.levelUp} ${afterLvl}`, 'lvl', 'sparkle', t.titles[titleIndex(afterLvl)]); }, 900);
    }
    const afterTier = seasonTier(n.season.xp);
    if (afterTier > beforeTier) setTimeout(() => toast(`${t.tier} ${afterTier}`, 'lvl', 'flag', t.gotReward), 1100);
    const done = questsFor(day).filter((q) => (n.quests.progress[q.id] ?? 0) >= q.target && !(s.quests.progress[q.id] >= q.target));
    done.forEach((q, i) => setTimeout(() => toast(t.quests, 'info', 'check', `${t[`q_${q.id}` as 'q_win3'].replace('{n}', String(q.target))}`), 700 + i * 600));
    n = celebrate(n, e);
    return { save: n, xp };
  };

  /** Récompense d'une partie à plusieurs : de l'XP toujours, des jetons sur quelques parties par jour. */
  const multiReward = (r: RewardInfo): Gains => {
    const s0 = saveRef.current;
    const m = s0.multi?.day === day ? s0.multi : { day, paid: 0 };
    const paid = m.paid < MULTI_PAID;
    const tokens = paid ? (r.won ? 4 : 1) : 0;
    const score = r.won ? 900 : Math.max(200, 700 - r.rank * 100);
    const { save: n2, xp } = progressAfter(
      { ...s0, tokens: s0.tokens + tokens, multi: { day, paid: m.paid + (paid ? 1 : 0) }, stats: { ...s0.stats, played: s0.stats.played + 1, won: s0.stats.won + (r.won ? 1 : 0) } },
      { kind: 'practice', won: r.won, score, ms: r.ms, stars: r.won ? 3 : 1, hints: 0, mistakes: r.mistakes, d: r.d, words: r.words },
    );
    setSave(n2);
    return { xp, tokens };
  };

  /** Envoie le journal au serveur, qui rejoue la partie. Le classement affiché vient de lui. */
  const submitServer = (logs: [number, number, string][][]) => {
    const id = serverGame.current;
    serverGame.current = null;
    if (!id) return;
    finishGame(id, logs).then((v) => {
      if (!v) return;
      const S = SHOP_STRINGS[lang];
      if ('rejected' in v) toast(S.rankRejected, 'info', 'flag');
      else if (v.rank) setTimeout(() => toast(fmtS(S.rankWorld, { n: String(v.rank) }), 'lvl', 'trophy'), 900);
    });
  };

  const onFinish = (info: FinishInfo) => {
    if (!mode || !puzzle || !rules) return;
    const s0 = saveRef.current;

    // Message d'un ami : ni XP, ni jetons, ni cote (sinon on pourrait se fabriquer des grilles faciles).
    if (mode.kind === 'message') {
      setEnd({ type: 'win', score: info.score, stars: info.stars, ms: info.ms, mistakes: info.mistakes, hints: info.hints, timeBonus: 0, ratingDelta: 0, record: false, xp: 0, maxCombo: info.maxCombo, assisted: false });
      return;
    }

    if (mode.kind === 'marathon') {
      marathonLogs.current.push(info.log);
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

    if (mode.kind === 'expedition') {
      const run = mode.exp!;
      const cleared = run.depth;
      let hearts = run.hearts - info.mistakes;
      // Après un sanctuaire, on récupère un cœur.
      if (cleared % 5 === 4) hearts = Math.min(MAX_HEARTS, hearts + 1);
      const next: Run = { ...run, depth: run.depth + 1, hearts };
      const al = new Set(s0.album[lang] ?? []);
      al.add(puzzle.phraseIndex);
      const { save: n2 } = progressAfter({ ...s0, album: { ...s0.album, [lang]: [...al] } }, { kind: 'expedition', won: true, score: info.score, ms: info.ms, stars: info.stars, hints: info.hints, mistakes: info.mistakes, d: puzzle.difficulty, maxCombo: info.maxCombo, words: info.words });
      setSave(n2);
      setRelicChoice({ run: next, offer: relicOffer(next), next: makeFloor(next.seed, next.depth) });
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

    const assisted = RANKED.includes(mode.kind) && info.hints > 0;
    if (!assisted) submitServer([info.log]);
    if (mode.kind === 'event') {
      const ev = EVENTS.find((e) => e.id === mode.ref)!;
      const st = n.events[ev.id] ?? { done: 0, currency: 0, claimed: [] };
      const first = mode.idx! >= st.done;
      const currency = st.currency + (first ? ev.perLevel : 0);
      const reached = ev.rewards.map((r, k) => [r, k] as const).filter(([r, k]) => currency >= r.at && !st.claimed.includes(k));
      n.events = { ...n.events, [ev.id]: { done: Math.max(st.done, mode.idx! + 1), currency, claimed: [...st.claimed, ...reached.map(([, k]) => k)] } };
      n = grantItems(n, reached.filter(([r]) => r.item).map(([r]) => r.item!));
      for (const [r] of reached) {
        if (r.title) n.equip = { ...n.equip, title: r.title };
        setTimeout(() => toast(fmtS(SHOP_STRINGS[lang].eventReward, { x: r.label[lang] }), 'lvl', 'gift'), 1200);
      }
    } else if (mode.kind === 'pack') {
      const p = n.packs[mode.ref!] ?? {};
      n.packs = { ...n.packs, [mode.ref!]: { ...p, [mode.idx!]: Math.max(p[mode.idx!] ?? 0, info.stars) } };
    }
    if (mode.kind === 'daily' && !s0.daily[lang]?.[mode.date!]) {
      n.daily = { ...n.daily, [lang]: { ...(n.daily[lang] ?? {}), [mode.date!]: { score, ms: info.ms, mistakes: info.mistakes, hints: info.hints } } };
      n.tokens += REWARD.daily;
      if (mode.date === day) n = bumpStreak(n, day);
      if (!assisted) ranking.submit(lang, mode.date!, { name: n.name, city: n.city, country: n.country, score, ms: info.ms });
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
    if (key && !assisted) {
      const prev = n.records[lang]?.[key]?.best ?? 0;
      record = score > prev && prev > 0;
      n = bumpRecord(n, lang, key, true, score, info.ms);
    }
    const ev: GameEvent = { kind: mode.kind, won: true, score, ms: info.ms, stars: info.stars, hints: info.hints, mistakes: info.mistakes, d: puzzle.difficulty, boss, maxCombo: info.maxCombo, words: info.words };
    const { save: n2, xp } = progressAfter(n, ev);
    setSave(n2);
    setEnd({ type: 'win', score, stars: info.stars, ms: info.ms, mistakes: info.mistakes, hints: info.hints, timeBonus, ratingDelta: newRating - s0.rating, record, xp, maxCombo: info.maxCombo, assisted });
  };

  const onFail = (reason: 'time' | 'mistakes', info: FinishInfo) => {
    if (!mode || !puzzle) return;
    const s0 = saveRef.current;
    if (mode.kind === 'message') {
      setEnd({ type: 'fail', score: 0, stars: 0, ms: info.ms, mistakes: info.mistakes, hints: info.hints, timeBonus: 0, ratingDelta: 0, record: false, xp: 0, maxCombo: info.maxCombo, reason });
      return;
    }
    if (mode.kind === 'expedition') {
      const run = mode.exp!;
      const depth = run.depth;
      const prev = s0.records[lang]?.expedition?.best ?? 0;
      let n = bumpRecord({ ...s0, stats: { ...s0.stats, played: s0.stats.played + 1 } }, lang, 'expedition', depth > 0, depth, Date.now() - marathonStart.current);
      if (run.daily) n = { ...n, expDaily: { ...n.expDaily, [`${lang}:${day}`]: depth } };
      const { save: n2, xp } = progressAfter(n, { kind: 'expedition', won: false, score: depth, ms: info.ms, stars: 0, hints: info.hints, mistakes: info.mistakes, d: puzzle.difficulty, run: depth, maxCombo: info.maxCombo, words: info.words });
      setSave(n2);
      setEnd({ type: 'marathon', score: depth, stars: 0, ms: Date.now() - marathonStart.current, mistakes: info.mistakes, hints: 0, timeBonus: 0, ratingDelta: 0, record: depth > prev && prev > 0, xp, maxCombo: info.maxCombo, reason, depth, floor: floorName(lang, makeFloor(run.seed, run.depth)) });
      return;
    }
    if (mode.kind === 'marathon') {
      const run = mode.run ?? 0;
      const total = Date.now() - marathonStart.current;
      if (run > 0) submitServer(marathonLogs.current);
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
  const mpPreview = new URLSearchParams(location.search).get('preview');
  if (mpPreview?.startsWith('mp-')) return <div className={`app kbs-${save.equip.keyboard}`}><Suspense fallback={null}><MultiPreview which={mpPreview} lang={lang} save={save} /></Suspense></div>;

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
  const startExpedition = (daily: boolean) => {
    const seed = daily ? `${lang}-${day}` : `${lang}-${Date.now().toString(36)}`;
    const run: Run = { seed, daily, depth: 0, hearts: START_HEARTS, relics: [] };
    marathonStart.current = Date.now();
    start({ kind: 'expedition', d: 1, nonce: seed, exp: run });
    marathonStart.current = Date.now();
  };
  const pickRelic = (r: RelicId) => {
    if (!relicChoice) return;
    const run: Run = { ...relicChoice.run, relics: [...relicChoice.run.relics, r], hearts: r === 'heart' ? Math.min(MAX_HEARTS, relicChoice.run.hearts + 1) : relicChoice.run.hearts };
    setRelicChoice(null);
    const r0 = rulesFor({ kind: 'expedition', d: 1, nonce: run.seed, exp: run });
    setMode({ kind: 'expedition', d: makeFloor(run.seed, run.depth).d, nonce: run.seed, exp: run });
    setEnd(null);
    setDeadline(r0.timeMs !== null ? Date.now() + r0.timeMs : null);
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
    if (m.kind === 'level') {
      const i = levelInfo(m.level!);
      return i.finale ? t.finaleLabel : `${i.boss ? t.boss + ', ' : ''}${t.level} ${i.step + 1}`;
    }
    if (m.kind === 'practice') return t.practice;
    if (m.kind === 'event') { const ev = EVENTS.find((e) => e.id === m.ref); return fmtS(SHOP_STRINGS[lang].message, { n: (m.idx ?? 0) + 1 }) + (ev ? `, ${ev.title[lang]}` : ''); }
    if (m.kind === 'pack') return `${catItem(`pack:${m.ref}`)?.name[lang] ?? ''} ${(m.idx ?? 0) + 1}`;
    if (m.kind === 'archive') return `${SHOP_STRINGS[lang].archives}, ${new Date(m.date!).toLocaleDateString(lang, { day: 'numeric', month: 'long' })}`;
    if (m.kind === 'expedition') return floorName(lang, makeFloor(m.exp!.seed, m.exp!.depth));
    if (m.kind === 'message') return fmtS(FRIEND_STRINGS[lang].msgFrom, { n: m.msg?.f || FRIEND_STRINGS[lang].msgSomeone });
    return (t[`mode_${m.kind}` as 'mode_zen'] as string[])[0];
  };
  const title = mode ? modeName(mode) : '';
  const floor = mode?.kind === 'expedition' ? makeFloor(mode.exp!.seed, mode.exp!.depth) : null;
  const levelI = mode?.kind === 'level' ? levelInfo(mode.level!) : null;
  const subtitle = !puzzle
    ? []
    : floor
      ? [t.floorN.replace('{n}', String(floor.depth + 1)), t.d[floor.d]]
      : levelI
        ? [STORY[lang].chapters[levelI.chapter].name, t.d[puzzle.difficulty]]
        : mode?.kind === 'marathon'
      ? [t.d[marathonDifficulty(mode.run ?? 0)], `${mode.run ?? 0} ${t.grids}`]
      : mode?.kind === 'message'
      ? [t.d[puzzle.difficulty]]
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
    start({ kind: 'level', level, d: levelInfo(level).d, nonce: '' });
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
      {end.type === 'win' && <WinFx text={puzzle.phraseText} stars={end.stars} variant={save.equip.effect} />}
      <div className={`sheet result ${end.type}`} role="dialog" aria-label={end.type === 'win' ? t.solved : t.failTitle}>
        {end.type === 'win' && (
          <>
            <div className="stage win" title={MODE_ICON[mode.kind]}><Loupi mood="happy" size={136} className="pop-in" /></div>
            <div className="stars">{[1, 2, 3].map((i) => <Icon key={i} name="starFill" size={28} className={i <= end.stars ? 'on' : ''} />)}</div>
            <h2>{t.solved}</h2>
          </>
        )}
        {end.type === 'fail' && (
          <>
            <div className="stage fail"><Loupi mood="sad" size={124} className="pop-in" /><span className="badge"><Icon name={end.reason === 'time' ? 'hourglass' : 'heart'} size={18} /></span></div>
            <h2>{t.failTitle}</h2>
            <p className="lead">{end.reason === 'time' ? t.failTime : t.failMistakes}</p>
          </>
        )}
        {end.type === 'marathon' && end.depth === undefined && (
          <>
            <div className="stage"><Loupi mood="wow" size={124} className="pop-in" /></div>
            <h2>{t.marathonOver}</h2>
            <div className="bignum">{end.run} <small>{t.grids}</small></div>
          </>
        )}
        {end.depth !== undefined && (
          <>
            <div className="stage"><Loupi mood="think" size={124} className="pop-in" /></div>
            <h2>{t.expOver}</h2>
            <p className="lead">{end.floor}</p>
            <div className="bignum">{end.depth} <small>{t.depth}</small></div>
          </>
        )}
        {end.type === 'win' && levelI?.finale && <p className="chapnum">{t.storyUnlocked}</p>}
        <p className="quote">{puzzle.phraseText}</p>
        {end.type === 'win' && levelI?.finale && <p className="story" style={{ fontSize: 16 }}>{STORY[lang].chapters[levelI.chapter].outro}</p>}
        {end.type !== 'marathon' && (
          <div className="kpis">
            <div><b><CountUp to={end.score} /></b><small>{t.score}</small></div>
            <div><b>{fmt(end.ms)}</b><small>{t.time}</small></div>
            <div><b>{end.maxCombo}</b><small>{t.combo}</small></div>
            <div><b>{end.mistakes}</b><small>{t.mistakes}</small></div>
          </div>
        )}
        <div className="gains">
          {mode.kind !== 'message' && <span className="gain xp"><Icon name="sparkle" size={14} />+{end.xp} {t.xp}</span>}
          {end.timeBonus > 0 && <span className="gain time"><Icon name="hourglass" size={14} />+{end.timeBonus}</span>}
          {end.ratingDelta !== 0 && (
            <span className={`gain ${end.ratingDelta >= 0 ? 'up' : 'down'}`}><Icon name="brain" size={14} />{t.ratingLabel} {save.rating} ({end.ratingDelta >= 0 ? '+' : ''}{end.ratingDelta})</span>
          )}
          {end.record && <span className="gain rec"><Icon name="trophy" size={14} />{t.newRecord}</span>}
          {end.assisted && <span className="gain"><Icon name="bulb" size={14} />{SHOP_STRINGS[lang].assisted}</span>}
        </div>
        <div className="row">
          <button className="btn" onClick={shareResult}><Icon name="share" size={18} />{t.share}</button>
          {end.type === 'win' && (mode.kind === 'event' || mode.kind === 'pack') ? (
            <button className="btn primary" onClick={() => {
              const ev = EVENTS.find((e) => e.id === mode.ref);
              const max = mode.kind === 'event' ? ev?.levels ?? 0 : 40;
              const idx = (mode.idx ?? 0) + 1;
              if (idx >= max) { setEnd(null); setMode(null); setScreen(mode.kind === 'event' ? 'event' : 'packs'); return; }
              start({ ...mode, idx, d: mode.kind === 'event' ? eventDifficulty(idx) : mode.d, nonce: String(idx) });
            }}>{t.next}</button>
          ) : end.type === 'win' && mode.kind === 'message' ? (
            <button className="btn primary" onClick={() => { setEnd(null); setMode(null); setScreen('friends'); }}><Icon name="send" size={18} />{FRIEND_STRINGS[lang].msgReply}</button>
          ) : end.type === 'win' && mode.kind === 'level' ? (
            <button className="btn primary" onClick={nextLevel}>{levelI?.finale ? t.nextChapter : t.next}</button>
          ) : end.depth !== undefined ? (
            <button className="btn primary" onClick={() => startExpedition(false)}>{t.expFree}</button>
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

  const worldTheme =
    screen === 'play'
      ? mode?.kind === 'level' ? `theme-${themeOf(mode.level!)}` : ''
      : '';

  function chapterChips(i: ReturnType<typeof levelInfo>) {
    const chips: { icon: string; label: string }[] = [];
    const p = puzzle!;
    if (p.mods?.ink) chips.push({ icon: MOD_ICON.ink, label: t.m_ink });
    if (p.mods?.fog) chips.push({ icon: MOD_ICON.fog, label: t.m_fog });
    if (p.mods?.chain) chips.push({ icon: MOD_ICON.chain, label: t.m_chain });
    if (p.mods?.smudge) chips.push({ icon: MOD_ICON.smudge, label: t.m_smudge });
    if (p.words.some((w) => w.tier === 3) && !p.cryptogram) chips.push({ icon: MOD_ICON.cryptic, label: t.m_cryptic });
    if (p.cryptogram) chips.push({ icon: MOD_ICON.cipher, label: t.m_cipher });
    return i.chapter === 0 && i.cycle === 0 ? [] : chips;
  }
  function expPerks(run: Run): Perks {
    return { shield: count(run, 'seal'), reveal: 2 * count(run, 'lantern'), freeLetters: count(run, 'quill') };
  }

  const qs = freshQuests(day, save.quests);
  const questReady = questsFor(day).some((q) => (qs.progress[q.id] ?? 0) >= q.target && !qs.claimed.includes(q.id));
  const se = freshSeason(day, save.season);
  const tierReady = Array.from({ length: seasonTier(se.xp) }, (_, i) => i + 1).some((tier) => !se.claimed.includes(tier));

  return (
    <OutfitCtx.Provider value={outfit}>
    <div className={`app skin-${save.skin} ${worldTheme} ${event?.theme ?? ''} kbs-${save.equip.keyboard}`}>
      {event?.decor === 'xmas' && screen !== 'play' && <Snowfall />}
      {screen === 'home' && <Home t={t} save={save} day={day} lang={lang} daily={daily} onStart={start} go={setScreen} setSave={setSave} claimQuest={claimQuest} claimQuestBonus={claimQuestBonus} toast={toast} event={event} openArchive={() => setScreen('archive')} />}
      {screen === 'arena' && <Arena t={t} save={save} lang={lang} day={day} onStart={start} setSave={setSave} go={setScreen} onExpedition={startExpedition} />}
      {screen === 'adventure' && <AdventureScreen t={t} save={save} lang={lang} onStart={start} back={() => setScreen('home')} />}
      {screen === 'season' && <Season t={t} save={save} day={day} go={setScreen} claimTier={claimTier} setSave={setSave} />}
      {screen === 'ranking' && <Ranking t={t} save={save} lang={lang} day={day} go={setScreen} />}
      {screen === 'profile' && <Profile t={t} save={save} lang={lang} day={day} go={setScreen} friendRequests={friendRequests} />}
      {screen === 'friends' && (
        <Suspense fallback={<div className="lazy-wait" />}>
          <Friends
            lang={lang}
            save={save}
            toast={toast}
            initialCode={friendLink}
            onCount={setFriendRequests}
            back={() => {
              if (friendLink) {
                setFriendLink(undefined);
                history.replaceState(null, '', location.pathname);
              }
              setScreen('profile');
            }}
          />
        </Suspense>
      )}
      {screen === 'album' && <Album t={t} save={save} lang={lang} back={() => setScreen('profile')} />}
      {screen === 'league' && <League t={t} save={save} lang={lang} back={() => setScreen('home')} />}
      {screen === 'settings' && <Settings t={t} save={save} setSave={setSave} back={() => setScreen('home')} />}
      {screen === 'shop' && <Shop ctx={shopCtx} back={() => setScreen('home')} openWardrobe={() => setScreen('wardrobe')} openPacks={() => setScreen('packs')} />}
      {screen === 'wardrobe' && <Wardrobe ctx={shopCtx} back={() => setScreen('shop')} />}
      {screen === 'event' && event && <EventScreen ev={event} ctx={shopCtx} day={day} back={() => setScreen('home')} play={(idx) => start({ kind: 'event', ref: event.id, idx, d: eventDifficulty(idx), nonce: String(idx) })} />}
      {screen === 'packs' && <PacksScreen ctx={shopCtx} back={() => setScreen('shop')} play={(ref, idx) => start({ kind: 'pack', ref, idx, d: 2, nonce: String(idx) })} openShop={() => setScreen('shop')} />}
      {screen === 'archive' && <ArchiveScreen ctx={shopCtx} day={day} back={() => setScreen('profile')} play={(date) => start({ kind: 'archive', date, d: 2, nonce: date })} openShop={() => setScreen('shop')} />}
      {screen === 'multi' && (
        <Suspense fallback={<div className="lazy-wait" />}>
        <MultiFlow
          lang={lang}
          save={save}
          start={multiStart}
          toast={toast}
          onReward={multiReward}
          onExit={() => {
            setMultiStart({ to: 'hub' });
            if (location.search.includes('salon=') || location.search.includes('defi=')) history.replaceState(null, '', location.pathname);
            setScreen('home');
          }}
        />
        </Suspense>
      )}
      {screen === 'premium' && <Premium t={t} save={save} setSave={setSave} back={() => setScreen('home')} />}
      {TAB_SCREENS.includes(screen) && <TabBar t={t} screen={screen} go={setScreen} badges={{ home: questReady, season: tierReady, profile: friendRequests > 0 }} />}

      {screen === 'play' && puzzle && rules && mode && (
        <Play
          key={mode.kind === 'marathon' ? `m-${mode.nonce}-${mode.run ?? 0}` : mode.kind === 'expedition' ? `x-${mode.nonce}-${mode.exp!.depth}` : `${mode.kind}-${mode.nonce}-${mode.level ?? ''}-${mode.d}`}
          puzzle={puzzle}
          palette={floor ? floorPalette(floor.hue) : undefined}
          chips={floor ? [...floor.mods.map((m) => ({ icon: MOD_ICON[m], label: t[`m_${m}` as 'm_ink'] as string })), ...[...new Set(mode.exp!.relics)].map((r) => ({ icon: RELIC_ICON[r], label: `${(t[`r_${r}` as 'r_heart'] as string[])[0]}${count(mode.exp!, r) > 1 ? ` x${count(mode.exp!, r)}` : ''}` }))] : levelI ? chapterChips(levelI) : undefined}
          perks={mode.kind === 'expedition' ? expPerks(mode.exp!) : undefined}
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

      {intro && (
        <ChapterIntro
          t={t}
          lang={lang}
          chapter={intro.chapter}
          cycle={intro.cycle}
          onBegin={() => {
            setSave((s) => ({ ...s, seenChapters: [...s.seenChapters, intro.abs] }));
            const m = intro.mode;
            setIntro(null);
            start(m, true);
          }}
        />
      )}
      {relicChoice && <RelicPicker t={t} lang={lang} run={relicChoice.run} offer={relicChoice.offer} next={relicChoice.next} onPick={pickRelic} />}

      {adOpen && (
        <div className="modal" onClick={() => adOpen === 'offer' && setAdOpen(null)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            {adOpen === 'offer' ? (
              <>
                <h2>{t.notEnoughTokens}</h2>
                <button className="btn primary block lg" onClick={watchAd}><Icon name="play" size={16} />{t.watchAd}</button>
                <button className="btn block" onClick={() => { setAdOpen(null); setScreen('shop'); }}><Icon name="crown" size={18} />{t.premium}</button>
              </>
            ) : (
              <div className="adplaying"><div className="spinner" />{t.adPlaying}</div>
            )}
          </div>
        </div>
      )}
      <div className="toasts" aria-live="polite">
        {toasts.slice(0, 1).map((x) => (
          <div key={x.id} className={`toast toast-${x.kind}`}>
            {x.icon && <span className="ti"><Icon name={x.icon} size={17} /></span>}
            <span>{x.text}{x.sub && <small>{x.sub}</small>}</span>
          </div>
        ))}
      </div>
    </div>
    </OutfitCtx.Provider>
  );
}
