// Parcours du jeu à plusieurs : accueil, file d'attente, salons, partie en direct, fantômes et défis.
// L'état de chaque partie vient du serveur ; cet écran ne fait qu'afficher et transmettre les frappes.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Difficulty, Lang, Puzzle } from '../engine/types';
import { PACKS } from '../content';
import { isCorrect, replay, wordSolved } from '../engine/game';
import { STRINGS } from '../i18n';
import { MULTI_STRINGS } from '../i18n-multi';
import { BOOSTERS } from '../meta';
import { puzzleFor, type Mode } from '../modes';
import { challengePuzzle, lettersToFind, multiPuzzle } from '../multi/match';
import { MULTI_RULES, PLAYER_COLORS, type Emote, type Look, type PlayerPub, type RoomKind, type RoomState, type ServerMsg, type TrapKind } from '../multi/protocol';
import { apiEnabled, challenges, ensureSession, fetchGhost, myMulti, type ChallengeInfo, type Ghost } from '../services/api';
import { createRoom, findDuel, joinByCode, onlineCount, type Conn } from '../services/multi';
import type { Save } from '../storage';
import { sfx } from '../sound';
import { Icon } from './Icon';
import { Loupi } from './mascot';
import { Play, fmt, type FinishInfo } from './Play';
import {
  Bubble, ChallengeInvite, ChallengeShare, Lobby, Matchmaking, MultiDock, MultiHub, MultiResult, RivalStrip, TeamStrip, Versus, fm, type Gains,
} from './multi';

export type FlowStart = { to: 'hub' } | { to: 'room'; code: string } | { to: 'challenge'; code: string };

export interface RewardInfo {
  kind: RoomKind | 'ghost' | 'challenge';
  won: boolean;
  rank: number;
  players: number;
  ms: number;
  mistakes: number;
  words: number;
  d: Difficulty;
}

interface Props {
  lang: Lang;
  save: Save;
  start: FlowStart;
  toast: (text: string, kind?: 'info' | 'lvl' | 'ach', icon?: string, sub?: string) => void;
  onExit: () => void;
  /** Applique XP et jetons (avec le plafond du jour) et renvoie ce qui a été gagné. */
  onReward: (r: RewardInfo) => Gains;
}

type View =
  | { v: 'hub' }
  | { v: 'search'; since: number; cancel: () => void }
  | { v: 'room'; conn: Conn }
  | { v: 'ghost'; ghost: Ghost; puzzle: Puzzle; key: string }
  | { v: 'challenge-play'; code: string; puzzle: Puzzle; d: Difficulty; owner?: ChallengeInfo; attemptId?: string }
  | { v: 'challenge-share'; code: string; score: number; ms: number }
  | { v: 'challenge-invite'; info: ChallengeInfo }
  | { v: 'busy'; text: string };

const RULES = { timeMs: MULTI_RULES.timeMs, lives: null, noHints: true, cheapHints: false, mistakePenaltyMs: 0, mult: 1, boosters: false };
const NO_BOOSTERS = Object.fromEntries(BOOSTERS.map((b) => [b, 0])) as Save['boosters'];
/** Adresse publique du jeu, pour les liens d'invitation (sur téléphone, l'origine locale ne sert à rien). */
const PUBLIC_URL = ((import.meta.env.VITE_PUBLIC_URL as string | undefined) || (typeof location !== 'undefined' ? location.origin + location.pathname.replace(/[^/]*$/, '') : '')).replace(/\/?$/, '/');

/** Difficulté proposée selon le niveau du joueur. */
const dFor = (rating: number): Difficulty => (rating < 950 ? 2 : rating < 1100 ? 3 : 4);

export function lookOf(save: Save): Look {
  const e = save.equip;
  return { hat: e.hat, neck: e.neck, loupe: e.loupe, back: e.back, title: e.title, frame: e.frame };
}

async function shareText(text: string, url: string, copied: string, toast: Props['toast']) {
  try {
    if (navigator.share) {
      await navigator.share({ text, url });
      return;
    }
  } catch {
    /* partage annulé */
  }
  try {
    await navigator.clipboard.writeText(`${text} ${url}`);
    toast(copied, 'info', 'copy');
  } catch {
    /* presse-papiers indisponible */
  }
}

export function MultiFlow({ lang, save, start, toast, onExit, onReward }: Props) {
  const M = MULTI_STRINGS[lang];
  const t = STRINGS[lang];
  const profile = { name: save.name, city: save.city, country: save.country };
  const look = lookOf(save);
  const [view, setView] = useState<View>(start.to === 'hub' ? { v: 'hub' } : { v: 'busy', text: M.connecting });
  const [online, setOnline] = useState<number | null>(null);
  /** Cote de duel tenue par le serveur (distincte du niveau solo). */
  const [duelRating, setDuelRating] = useState(1000);
  const fail = useCallback(
    (e: unknown) => {
      const msg = (e as Error)?.message ?? '';
      if (msg === 'cancelled') return setView({ v: 'hub' });
      toast(msg === 'offline' ? M.offline : /introuvable|404/.test(msg) ? M.roomGone : /complet|full/.test(msg) ? M.roomFull : msg || M.offline, 'info', 'offline');
      setView({ v: 'hub' });
    },
    [M, toast],
  );

  /** Les défis passent par l'API : il faut une identité avant le premier appel. */
  const authed = <T,>(f: () => Promise<T>) => ensureSession(profile).then(f);

  useEffect(() => {
    void onlineCount().then(setOnline);
    if (apiEnabled) authed(myMulti).then((m) => setDuelRating(m.duelRating), () => undefined);
    if (start.to === 'room') joinByCode(start.code, profile, look).then((conn) => setView({ v: 'room', conn }), fail);
    if (start.to === 'challenge') challenges.get(start.code).then((info) => setView({ v: 'challenge-invite', info }), fail);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const leaveTo = (v: View = { v: 'hub' }) => {
    if (view.v === 'room') view.conn.leave();
    setView(v);
  };

  const startGhost = async () => {
    setView({ v: 'busy', text: M.connecting });
    // Les fantômes viennent des parties d'arène (jamais du défi du jour, pour ne rien dévoiler).
    for (const key of ['timeattack:3', 'timeattack:2', 'survival:3', 'sudden:3', 'timeattack:4', 'timeattack:1']) {
      const g = await fetchGhost(lang, key, save.rating);
      if (g && g.log?.[0]?.length) {
        setView({ v: 'ghost', ghost: g, key, puzzle: puzzleFor(PACKS[lang], g.mode as Mode) });
        return;
      }
    }
    toast(M.noGhost, 'info', 'ghost');
    setView({ v: 'hub' });
  };

  // ---------- Accueil ----------
  if (view.v === 'hub')
    return (
      <MultiHub
        lang={lang}
        rating={duelRating}
        look={look}
        rival={{ hat: 'beret', neck: 'bowtie', loupe: 'crystal' }}
        online={online}
        offline={!apiEnabled}
        back={onExit}
        onDuel={() => {
          const q = findDuel(lang, profile, look, (x) => setOnline(x.online));
          setView({ v: 'search', since: Date.now(), cancel: q.cancel });
          q.promise.then((conn) => {
            sfx.unlock();
            setView({ v: 'room', conn });
          }, fail);
        }}
        onParty={() => {
          setView({ v: 'busy', text: M.connecting });
          createRoom('party', lang, dFor(save.rating), profile, look).then((conn) => setView({ v: 'room', conn }), fail);
        }}
        onCoop={() => {
          setView({ v: 'busy', text: M.connecting });
          createRoom('coop', lang, 2, profile, look).then((conn) => setView({ v: 'room', conn }), fail);
        }}
        onJoin={(code) => {
          setView({ v: 'busy', text: M.connecting });
          joinByCode(code, profile, look).then((conn) => setView({ v: 'room', conn }), fail);
        }}
        onChallenge={() => {
          setView({ v: 'busy', text: M.connecting });
          const d = dFor(save.rating);
          authed(() => challenges.create(lang, d)).then((c) => setView({ v: 'challenge-play', code: c.code, d, puzzle: challengePuzzle(lang, d, c.nonce) }), fail);
        }}
        onGhost={startGhost}
      />
    );

  if (view.v === 'busy')
    return (
      <div className="mm">
        <Loupi size={120} mood="think" />
        <p className="muted">{view.text}</p>
        <button className="btn ghost mm-cancel" onClick={() => setView({ v: 'hub' })}>{M.cancel}</button>
      </div>
    );

  if (view.v === 'search')
    return (
      <Matchmaking
        lang={lang}
        rating={duelRating}
        look={look}
        since={view.since}
        onCancel={() => {
          view.cancel();
          setView({ v: 'hub' });
        }}
        onGhost={() => {
          view.cancel();
          void startGhost();
        }}
      />
    );

  if (view.v === 'room') return <RoomView key={view.conn.meId} conn={view.conn} lang={lang} save={save} toast={toast} onReward={onReward} onLeave={() => leaveTo()} />;

  if (view.v === 'ghost') return <GhostRace ghost={view.ghost} puzzle={view.puzzle} lang={lang} save={save} onReward={onReward} onLeave={() => setView({ v: 'hub' })} />;

  if (view.v === 'challenge-invite') {
    const info = view.info;
    const from: PlayerPub = { id: info.owner.id, name: info.owner.name, place: info.owner.place, rating: 0, look: info.owner.look, color: 2, host: false, ready: true, connected: true, letters: 0, words: 0, mistakes: 0, doneMs: info.ms, traps: 0 };
    return (
      <div className="app-dim">
        <ChallengeInvite
          lang={lang}
          from={from}
          score={info.score}
          ms={info.ms}
          d={info.d}
          onLater={onExit}
          onAccept={() => {
            setView({ v: 'busy', text: M.connecting });
            authed(() => challenges.start(info.code)).then(
              (a) => setView({ v: 'challenge-play', code: info.code, d: info.d, puzzle: challengePuzzle(info.lang, info.d, info.nonce), owner: info, attemptId: a.attemptId }),
              (e) => {
                if (/propre|own|409/.test((e as Error).message)) toast(M.ownChallenge, 'info', 'send');
                else fail(e);
                setView({ v: 'hub' });
              },
            );
          }}
        />
      </div>
    );
  }

  if (view.v === 'challenge-share')
    return (
      <div className="app-dim">
        <ChallengeShare
          lang={lang}
          name={save.name || t.you}
          score={view.score}
          ms={view.ms}
          link={`${PUBLIC_URL}?defi=${view.code}`}
          onClose={() => setView({ v: 'hub' })}
          onCopy={() => {
            void navigator.clipboard?.writeText(`${PUBLIC_URL}?defi=${view.code}`);
            toast(M.linkCopied, 'info', 'copy');
          }}
          onShare={() => shareText(fm(M.challengeText, { n: save.name || t.you, s: view.score, t: fmt(view.ms) }), `${PUBLIC_URL}?defi=${view.code}`, M.linkCopied, toast)}
        />
      </div>
    );

  // ---------- Défi : partie ----------
  return <ChallengePlay key={view.code} view={view} lang={lang} save={save} toast={toast} onReward={onReward} onDone={setView} onLeave={() => setView({ v: 'hub' })} />;
}

// ---------------- Partie en direct ----------------

function RoomView({ conn, lang, save, toast, onReward, onLeave }: { conn: Conn; lang: Lang; save: Save; toast: Props['toast']; onReward: Props['onReward']; onLeave: () => void }) {
  const M = MULTI_STRINGS[lang];
  const t = STRINGS[lang];
  const [s, setS] = useState<RoomState | null>(conn.state);
  const [incoming, setIncoming] = useState<{ n: number; code: number; letter: string; color: string }[]>([]);
  const [bubble, setBubble] = useState<{ who: PlayerPub; text: string; icon?: string; id: number } | null>(null);
  const [trap, setTrap] = useState<{ kind: TrapKind; until: number } | null>(null);
  const [hits, setHits] = useState<Record<string, TrapKind | undefined>>({});
  const [result, setResult] = useState<{ delta?: number; gains: Gains } | null>(null);
  const [, force] = useState(0);
  const seq = useRef(0);
  const sRef = useRef(s);
  sRef.current = s;
  const rewarded = useRef<string | null>(null);

  const say = useCallback((who: PlayerPub | undefined, text: string, icon?: string) => {
    if (!who) return;
    const id = Date.now();
    setBubble({ who, text, icon, id });
    setTimeout(() => setBubble((b) => (b?.id === id ? null : b)), 2600);
  }, []);

  useEffect(() => {
    // Un état a pu arriver entre l'ouverture de la salle et cet abonnement : on le reprend, puis on redemande.
    if (conn.state) setS(conn.state);
    conn.send({ t: 'sync' });
  }, [conn]);

  useEffect(
    () =>
      conn.on((m: ServerMsg) => {
        const cur = sRef.current;
        const who = (id: string) => cur?.players.find((p) => p.id === id);
        if (m.t === 'state') {
          if (cur && cur.phase !== m.s.phase && m.s.phase === 'countdown') {
            setIncoming([]);
            setResult(null);
            setTrap(null);
          }
          if (cur) for (const p of cur.players) if (p.connected && !m.s.players.find((q) => q.id === p.id)?.connected && p.id !== conn.meId) toast(fm(M.left, { n: p.name }), 'info', 'user');
          setS(m.s);
        } else if (m.t === 'move') {
          const p = who(m.by);
          setIncoming((x) => [...x.slice(-60), { n: ++seq.current, code: m.code, letter: m.letter, color: p ? PLAYER_COLORS[p.color % 5] : '#fff' }]);
        } else if (m.t === 'trapped') {
          setHits((h) => ({ ...h, [m.target]: m.kind }));
          setTimeout(() => setHits((h) => ({ ...h, [m.target]: undefined })), Math.max(0, m.until - Date.now()));
          if (m.target === conn.meId) {
            sfx.bad();
            setTrap({ kind: m.kind, until: m.until });
            setTimeout(() => setTrap(null), Math.max(0, m.until - Date.now()));
            say(who(m.by), fm(m.kind === 'ink' ? M.trappedInk : M.trappedFreeze, { n: who(m.by)?.name ?? '' }), m.kind === 'ink' ? 'inkwell' : 'snow');
          } else if (m.by === conn.meId) toast(fm(M.trapSent, { n: who(m.target)?.name ?? '' }), 'info', 'bolt');
        } else if (m.t === 'emote') {
          if (m.by !== conn.meId) say(who(m.by), M.emotes[m.e], 'chat');
        } else if (m.t === 'ping') {
          if (m.by !== conn.meId) say(who(m.by), fm(M.needHelp, { n: who(m.by)?.name ?? '' }), 'wave');
        } else if (m.t === 'result') {
          const st = sRef.current;
          if (!st || rewarded.current === st.seed) return;
          rewarded.current = st.seed;
          const mine = m.ranking.find((r) => r.id === conn.meId);
          const rank = mine?.rank ?? m.ranking.length;
          const won = st.kind === 'coop' ? m.ranking.every((r) => r.ms !== null) : rank === 1 && (mine?.ms ?? null) !== null;
          won ? sfx.win() : sfx.fail();
          const gains = onReward({ kind: st.kind, won, rank, players: m.ranking.length, ms: mine?.ms ?? 0, mistakes: mine?.mistakes ?? 0, words: mine?.words ?? 0, d: st.options.d });
          setResult({ delta: m.ratingDelta?.[conn.meId], gains });
        } else if (m.t === 'error') {
          if (m.reason === 'left') onLeave();
          else toast(m.reason, 'info', 'offline');
        }
      }),
    [conn], // eslint-disable-line react-hooks/exhaustive-deps
  );

  // Le compte à rebours et la levée des pièges ont besoin d'un battement local.
  useEffect(() => {
    const id = setInterval(() => force((x) => x + 1), 500);
    return () => clearInterval(id);
  }, []);

  const puzzle = useMemo(() => (s?.seed ? multiPuzzle(s.options.lang, s.options.d, s.seed) : null), [s?.seed, s?.options.lang, s?.options.d]);
  const blotted = useMemo(() => {
    if (trap?.kind !== 'ink' || !puzzle) return undefined;
    const n = puzzle.words.length;
    const a = Math.floor((trap.until / 7) % n);
    return [a, (a + 1 + Math.floor(n / 2)) % n];
  }, [trap, puzzle]);

  if (!s) return <div className="mm"><Loupi size={120} mood="think" /><p className="muted">{M.connecting}</p></div>;
  const me = s.players.find((p) => p.id === conn.meId);

  if (s.phase === 'lobby')
    return (
      <Lobby
        lang={lang}
        state={s}
        meId={conn.meId}
        onReady={(r) => conn.send({ t: 'ready', ready: r })}
        onStart={() => conn.send({ t: 'start' })}
        onOptions={(o) => conn.send({ t: 'options', options: o })}
        onCopy={() => {
          void navigator.clipboard?.writeText(`${PUBLIC_URL}?salon=${s.code}`);
          toast(M.linkCopied, 'info', 'copy');
        }}
        onShare={() => shareText(`${M.lobbyCode} : ${s.code}`, `${PUBLIC_URL}?salon=${s.code}`, M.linkCopied, toast)}
        onLeave={onLeave}
      />
    );

  if (s.phase === 'countdown' && s.kind === 'duel') {
    const opp = s.players.find((p) => p.id !== conn.meId);
    if (me && opp) return <Versus lang={lang} me={me} opp={opp} startAt={s.startAt!} />;
  }

  if (!puzzle || !me) return null;
  const waiting = s.phase === 'countdown';
  const ahead = s.players
    .filter((p) => p.id !== conn.meId && p.connected && p.doneMs === null && p.letters >= me.letters)
    .sort((a, b) => a.letters - b.letters)[0];
  const coopOwner = (wi: number) => {
    const id = s.clueOwner?.[wi];
    if (!id || id === conn.meId) return null;
    const p = s.players.find((x) => x.id === id);
    return p ? { name: fm(M.clueOf, { n: p.name }, lang), color: PLAYER_COLORS[p.color % 5] } : null;
  };
  const strip =
    s.kind === 'coop' ? (
      <TeamStrip lang={lang} players={s.players} meId={conn.meId} lives={s.teamLives ?? 0} maxLives={MULTI_RULES.coopLives} />
    ) : (
      <RivalStrip lang={lang} players={s.players} meId={conn.meId} total={s.total} trapped={hits} />
    );
  const overlay =
    s.phase === 'done' && result ? (
      <MultiResult lang={lang} state={s} meId={conn.meId} ratingDelta={result.delta} gains={result.gains} onRematch={() => conn.send({ t: 'rematch' })} onLeave={onLeave} />
    ) : (
      <div className="modal">
        <div className="sheet mres">
          <Loupi size={96} mood="happy" className="pop-in" />
          <h2>{M.waitOthers}</h2>
          {strip}
          <button className="btn ghost block" onClick={onLeave}>{M.leave}</button>
        </div>
      </div>
    );
  const noop = () => undefined;

  return (
    <>
      <Play
        key={s.seed}
        puzzle={puzzle}
        title={s.kind === 'coop' ? M.coop : s.kind === 'party' ? M.party : M.duel}
        subtitle={[t.d[s.options.d], M.noHints]}
        t={t}
        tokens={save.tokens}
        premium={false}
        rules={RULES}
        deadline={s.endAt}
        boosters={NO_BOOSTERS}
        useBooster={() => false}
        onFreeze={noop}
        spend={() => false}
        onNeedTokens={noop}
        onFinish={(_: FinishInfo) => undefined}
        onFail={noop}
        onExit={onLeave}
        overlay={overlay}
        showTutorial={false}
        onTutorialDone={noop}
        rivals={strip}
        clueOwner={s.kind === 'coop' ? coopOwner : undefined}
        blotted={blotted}
        keysLocked={waiting || (trap?.kind === 'freeze' && Date.now() < trap.until)}
        onMove={(code, letter) => conn.send({ t: 'move', code, letter })}
        incoming={incoming}
        dockExtra={
          <MultiDock
            lang={lang}
            kind={s.kind}
            traps={s.options.traps}
            charges={me.traps}
            target={ahead?.name ?? null}
            immune={false}
            onTrap={(k) => ahead && conn.send({ t: 'trap', target: ahead.id, kind: k })}
            onEmote={(e: Emote) => conn.send({ t: 'emote', e })}
            onHelp={() => conn.send({ t: 'ping', word: 0 })}
          />
        }
      />
      {waiting && s.startAt && (
        <div className="modal center countdown">
          <span className="vs-count" key={Math.ceil((s.startAt - Date.now()) / 1000)}>{Math.max(1, Math.ceil((s.startAt - Date.now()) / 1000))}</span>
          <p>{M.getReady}</p>
        </div>
      )}
      {bubble && <Bubble key={bubble.id} who={bubble.who} text={bubble.text} icon={bubble.icon} />}
    </>
  );
}

// ---------------- Course contre un fantôme ----------------

/** Lettres trouvées par un journal enregistré, à un instant donné de la partie. */
function ghostLetters(puzzle: Puzzle, log: [number, number, string][], ms: number) {
  const s = replay(puzzle, log.filter((m) => m[0] <= ms), null);
  return {
    letters: lettersToFind(puzzle).filter((c) => isCorrect(s, c)).length,
    words: puzzle.words.filter((_, i) => wordSolved(s, i)).length,
    mistakes: s.mistakes,
    done: s.finished ? s.elapsedMs : null,
  };
}

function useGhost(puzzle: Puzzle, log: [number, number, string][] | null, startedAt: number | null) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 400);
    return () => clearInterval(id);
  }, []);
  return useMemo(() => (log && startedAt ? ghostLetters(puzzle, log, now - startedAt) : null), [puzzle, log, startedAt, Math.floor(now / 400)]); // eslint-disable-line react-hooks/exhaustive-deps
}

function GhostRace({ ghost, puzzle, lang, save, onReward, onLeave }: { ghost: Ghost; puzzle: Puzzle; lang: Lang; save: Save; onReward: Props['onReward']; onLeave: () => void }) {
  const M = MULTI_STRINGS[lang];
  const t = STRINGS[lang];
  const [startedAt] = useState(Date.now());
  const [mine, setMine] = useState({ letters: 0, words: 0, mistakes: 0, done: null as number | null });
  const [end, setEnd] = useState<{ gains: Gains } | null>(null);
  const g = useGhost(puzzle, ghost.log[0], startedAt);
  const found = useRef(new Set<number>());
  const toFind = useMemo(() => new Set(lettersToFind(puzzle)), [puzzle]);
  const total = lettersToFind(puzzle).length;
  const me = pubOf('me', save.name || t.you, save.city, save.rating, lookOf(save), 0, mine);
  const gh = pubOf('ghost', ghost.name, ghost.city || ghost.country, ghost.rating, ghost.look ?? {}, 1, g ?? { letters: 0, words: 0, mistakes: 0, done: null });
  const state: RoomState = { kind: 'duel', code: '', phase: 'done', options: { lang, d: puzzle.difficulty, traps: false }, players: [me, gh], total, seed: null, startAt: startedAt, endAt: null, clueOwner: null, teamLives: null };
  const finish = (info: FinishInfo) => {
    const done = { ...mine, done: info.ms, letters: total, words: puzzle.words.length, mistakes: info.mistakes };
    setMine(done);
    const won = info.ms < ghost.ms;
    setEnd({ gains: onReward({ kind: 'ghost', won, rank: won ? 1 : 2, players: 2, ms: info.ms, mistakes: info.mistakes, words: info.words, d: puzzle.difficulty }) });
  };
  const noop = () => undefined;
  return (
    <Play
      puzzle={puzzle}
      title={M.ghost}
      subtitle={[fm(M.ghostLabel, { n: ghost.name }, lang), M.noHints]}
      t={t}
      tokens={save.tokens}
      premium={false}
      rules={{ ...RULES, timeMs: null }}
      deadline={null}
      boosters={NO_BOOSTERS}
      useBooster={() => false}
      onFreeze={noop}
      spend={() => false}
      onNeedTokens={noop}
      onFinish={finish}
      onFail={noop}
      onExit={onLeave}
      overlay={end ? <MultiResult lang={lang} state={{ ...state, players: [{ ...me, doneMs: mine.done }, { ...gh, doneMs: ghost.ms }] }} meId="me" ghostId="ghost" gains={end.gains} onLeave={onLeave} /> : null}
      showTutorial={false}
      onTutorialDone={noop}
      rivals={<RivalStrip lang={lang} players={[me, gh]} meId="me" total={total} ghostId="ghost" />}
      dockExtra={<p className="nohints"><Icon name="ghost" size={15} />{M.ghostNote}</p>}
      onMove={(code, letter) => {
        if (letter === puzzle.codeToLetter[code] && !found.current.has(code) && toFind.has(code)) {
          found.current.add(code);
          setMine((m) => ({ ...m, letters: found.current.size }));
        }
      }}
    />
  );
}

function pubOf(id: string, name: string, place: string, rating: number, look: Look, color: number, p: { letters: number; words: number; mistakes: number; done: number | null }): PlayerPub {
  return { id, name, place, rating, look, color, host: false, ready: true, connected: true, letters: p.letters, words: p.words, mistakes: p.mistakes, doneMs: p.done, traps: 0 };
}

// ---------------- Défi entre amis ----------------

function ChallengePlay({ view, lang, save, toast, onReward, onDone, onLeave }: {
  view: Extract<View, { v: 'challenge-play' }>;
  lang: Lang;
  save: Save;
  toast: Props['toast'];
  onReward: Props['onReward'];
  onDone: (v: View) => void;
  onLeave: () => void;
}) {
  const M = MULTI_STRINGS[lang];
  const t = STRINGS[lang];
  const [startedAt] = useState(Date.now());
  const [mine, setMine] = useState({ letters: 0, words: 0, mistakes: 0, done: null as number | null });
  const [end, setEnd] = useState<{ gains: Gains; won: boolean; ms: number } | null>(null);
  const owner = view.owner;
  const g = useGhost(view.puzzle, owner?.log ?? null, startedAt);
  const found = useRef(new Set<number>());
  const toFind = useMemo(() => new Set(lettersToFind(view.puzzle)), [view.puzzle]);
  const total = lettersToFind(view.puzzle).length;
  const me = pubOf('me', save.name || t.you, save.city, save.rating, lookOf(save), 0, mine);
  const op = owner ? pubOf('owner', owner.owner.name, owner.owner.place, 0, owner.owner.look ?? {}, 2, g ?? { letters: 0, words: 0, mistakes: 0, done: null }) : null;
  const finish = (info: FinishInfo) => {
    setMine({ letters: total, words: view.puzzle.words.length, mistakes: info.mistakes, done: info.ms });
    if (!owner) {
      challenges.finish(view.code, info.log).then(
        (r) => onDone({ v: 'challenge-share', code: r.code, score: r.score, ms: r.ms }),
        () => {
          toast(M.rejected, 'info', 'offline');
          onLeave();
        },
      );
      return;
    }
    challenges.answer(view.attemptId!, info.log).then(
      (r) => setEnd({ won: r.won, ms: r.ms, gains: onReward({ kind: 'challenge', won: r.won, rank: r.won ? 1 : 2, players: 2, ms: r.ms, mistakes: info.mistakes, words: info.words, d: view.d }) }),
      () => {
        toast(M.rejected, 'info', 'offline');
        onLeave();
      },
    );
  };
  const noop = () => undefined;
  const state: RoomState | null = op
    ? { kind: 'duel', code: '', phase: 'done', options: { lang, d: view.d, traps: false }, players: [{ ...me, doneMs: end?.ms ?? mine.done }, { ...op, doneMs: owner!.ms, letters: total }], total, seed: null, startAt: startedAt, endAt: null, clueOwner: null, teamLives: null }
    : null;
  return (
    <Play
      puzzle={view.puzzle}
      title={owner ? fm(M.challengeFrom, { n: owner.owner.name }) : M.challenge}
      subtitle={[t.d[view.d], M.noHints]}
      t={t}
      tokens={save.tokens}
      premium={false}
      rules={{ ...RULES, timeMs: null }}
      deadline={null}
      boosters={NO_BOOSTERS}
      useBooster={() => false}
      onFreeze={noop}
      spend={() => false}
      onNeedTokens={noop}
      onFinish={finish}
      onFail={noop}
      onExit={onLeave}
      overlay={
        end && state ? (
          <MultiResult lang={lang} state={state} meId="me" ghostId="owner" gains={end.gains} onLeave={onLeave} />
        ) : (
          <div className="modal"><div className="sheet mres"><Loupi size={90} mood="think" className="pop-in" /><p className="lead">{M.sending}</p></div></div>
        )
      }
      showTutorial={false}
      onTutorialDone={noop}
      rivals={op ? <RivalStrip lang={lang} players={[me, op]} meId="me" total={total} ghostId="owner" /> : undefined}
      dockExtra={<p className="nohints"><Icon name="shield" size={15} />{M.noHints}</p>}
      onMove={(code, letter) => {
        if (letter === view.puzzle.codeToLetter[code] && !found.current.has(code) && toFind.has(code)) {
          found.current.add(code);
          setMine((m) => ({ ...m, letters: found.current.size }));
        }
      }}
    />
  );
}

