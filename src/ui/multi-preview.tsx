// Maquettes du jeu à plusieurs : les vrais écrans, nourris par des joueurs simulés.
// Ouvertes avec ?preview=mp-… ; jamais affichées en dehors de ce mode.

import { useEffect, useMemo, useState } from 'react';
import type { Lang } from '../engine/types';
import { PACKS } from '../content';
import { practicePuzzle } from '../engine/generator';
import { STRINGS } from '../i18n';
import { MULTI_STRINGS } from '../i18n-multi';
import { BOOSTERS } from '../meta';
import { MULTI_RULES, type Look, type PlayerPub, type RoomKind, type RoomState } from '../multi/protocol';
import type { Save } from '../storage';
import { Play } from './Play';
import { Bubble, ChallengeInvite, ChallengeShare, Lobby, Matchmaking, MultiDock, MultiHub, MultiResult, RivalStrip, TeamStrip, Versus, fm } from './multi';

const FAKE: [string, string, number, Look][] = [
  ['Nina', 'Montréal', 1062, { hat: 'beret', neck: 'bowtie', loupe: 'crystal' }],
  ['Kofi', 'Lomé', 1018, { hat: 'conductor', neck: 'scarf', loupe: 'gold' }],
  ['Inès', 'Rabat', 987, { hat: 'tophat', neck: 'bowtie', loupe: 'steam', back: 'cape' }],
  ['Hugo', 'Lyon', 951, { neck: 'scarf', loupe: 'gold' }],
];

function player(i: number, over: Partial<PlayerPub> = {}): PlayerPub {
  const [name, place, rating, look] = FAKE[i];
  return { id: `p${i}`, name, place, rating, look, color: i + 1, host: false, ready: true, connected: true, letters: 0, words: 0, mistakes: 0, doneMs: null, traps: 0, ...over };
}

function room(kind: RoomKind, me: PlayerPub, n: number, over: Partial<RoomState> = {}): RoomState {
  return {
    kind,
    code: 'K7PQ',
    phase: 'play',
    options: { lang: 'fr', d: 2, traps: kind === 'party' },
    players: [me, ...Array.from({ length: n }, (_, i) => player(i))],
    total: 16,
    seed: 'apercu',
    startAt: Date.now(),
    endAt: Date.now() + MULTI_RULES.timeMs,
    clueOwner: null,
    teamLives: kind === 'coop' ? 4 : null,
    ...over,
  };
}

export function MultiPreview({ which, lang, save }: { which: string; lang: Lang; save: Save }) {
  const t = STRINGS[lang];
  const M = MULTI_STRINGS[lang];
  const look: Look = { ...save.equip };
  const me: PlayerPub = { id: 'me', name: save.name || 'Raouf', place: save.city || 'Lomé', rating: save.rating, look, color: 0, host: true, ready: true, connected: true, letters: 0, words: 0, mistakes: 0, doneMs: null, traps: 0 };
  const puzzle = useMemo(() => practicePuzzle(PACKS[lang], 2, 'apercu-multi'), [lang]);
  const total = puzzle.maxCode;
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((x) => x + 1), 1200);
    return () => clearInterval(id);
  }, []);
  const noop = () => undefined;

  if (which === 'mp-hub')
    return <MultiHub lang={lang} rating={save.rating} look={look} rival={FAKE[0][3]} online={128} offline={false} back={noop} onDuel={noop} onParty={noop} onCoop={noop} onJoin={noop} onChallenge={noop} onGhost={noop} />;
  if (which === 'mp-search') return <Matchmaking lang={lang} rating={save.rating} look={look} since={Date.now() - 17_000} onCancel={noop} onGhost={noop} />;
  if (which === 'mp-versus') return <Versus lang={lang} me={me} opp={player(0, { look: { ...FAKE[0][3], title: 'Fin limier' } })} startAt={Date.now() + 2_400} />;
  if (which === 'mp-lobby') {
    const s = room('party', me, 3, { phase: 'lobby', players: [me, player(0), player(1, { ready: false }), player(2)] });
    return <Lobby lang={lang} state={s} meId="me" onReady={noop} onStart={noop} onOptions={noop} onShare={noop} onCopy={noop} onLeave={noop} />;
  }
  if (which === 'mp-invite')
    return (
      <div style={{ minHeight: '100vh' }}>
        <ChallengeInvite lang={lang} from={player(1)} score={1240} ms={154_000} d={3} onAccept={noop} onLater={noop} />
      </div>
    );
  if (which === 'mp-challenge')
    return (
      <div style={{ minHeight: '100vh' }}>
        <ChallengeShare lang={lang} name={me.name} score={1180} ms={148_000} link="https://lexicode.app/d/7FQ2XK" onShare={noop} onCopy={noop} onClose={noop} />
      </div>
    );

  // Écrans de partie : la vraie grille, des rivaux qui avancent.
  const kind: RoomKind = which.includes('coop') ? 'coop' : which.includes('party') ? 'party' : 'duel';
  const ghost = which.includes('ghost');
  const n = kind === 'duel' ? 1 : kind === 'coop' ? 2 : 4;
  const progress = (i: number) => Math.min(total, Math.floor(3 + (tick + i * 2) * (0.5 + 0.15 * ((i * 7) % 4))));
  const others = Array.from({ length: n }, (_, i) => player(i, { letters: progress(i), words: Math.floor(progress(i) / 4), mistakes: i % 2 }));
  const myLetters = 6;
  const s = room(kind, { ...me, letters: myLetters, words: 1 }, 0, { players: [{ ...me, letters: myLetters, words: 1 }, ...others] });

  if (which.startsWith('mp-res')) {
    const done: PlayerPub[] = s.players.map((p, i) => ({ ...p, letters: kind === 'coop' ? [7, 5, 4][i] : total, doneMs: kind === 'coop' ? 171_000 : [118_000, 104_000, 131_000, 142_000, null][i] ?? null, words: 6, mistakes: [1, 0, 2, 1, 3][i] }));
    if (kind === 'party') done[4] = { ...done[4], letters: 11, doneMs: null };
    return (
      <div style={{ minHeight: '100vh' }}>
        <MultiResult lang={lang} state={{ ...s, players: done, phase: 'done' }} meId="me" ratingDelta={kind === 'duel' ? -9 : undefined} gains={{ xp: kind === 'coop' ? 120 : 90, tokens: 15 }} onRematch={noop} onLeave={noop} />
      </div>
    );
  }

  const trapped = which.includes('trap');
  const owners = kind === 'coop' ? puzzle.words.map((_, wi) => s.players[wi % s.players.length]) : null;
  const strip =
    kind === 'coop' ? (
      <TeamStrip lang={lang} players={s.players} meId="me" lives={s.teamLives ?? 0} maxLives={MULTI_RULES.coopLives} />
    ) : (
      <RivalStrip lang={lang} players={s.players} meId="me" total={total} ghostId={ghost ? 'p0' : undefined} trapped={trapped ? { me: 'ink' } : undefined} />
    );
  const leader = others.filter((o) => o.letters > myLetters).sort((a, b) => a.letters - b.letters)[0];
  return (
    <>
      <Play
        puzzle={puzzle}
        title={kind === 'coop' ? M.coop : kind === 'party' ? M.party : ghost ? M.ghost : M.duel}
        subtitle={[kind === 'coop' ? '' : t.d[2], M.noHints].filter(Boolean)}
        t={t}
        tokens={save.tokens}
        premium={false}
        rules={{ timeMs: MULTI_RULES.timeMs, lives: null, noHints: true, cheapHints: false, mistakePenaltyMs: MULTI_RULES.mistakePenaltyMs, mult: 1, boosters: false }}
        deadline={Date.now() + MULTI_RULES.timeMs - 38_000}
        boosters={Object.fromEntries(BOOSTERS.map((b) => [b, 0])) as Save['boosters']}
        useBooster={() => false}
        onFreeze={noop}
        spend={() => false}
        onNeedTokens={noop}
        onFinish={noop}
        onFail={noop}
        onExit={noop}
        overlay={null}
        showTutorial={false}
        onTutorialDone={noop}
        rivals={strip}
        blotted={trapped ? [1, 3] : undefined}
        clueOwner={owners ? (wi) => (owners[wi].id === 'me' ? null : { name: fm(M.clueOf, { n: owners[wi].name }, lang), color: ['#ffb938', '#3fd6a6', '#ff5d62'][wi % 3] }) : undefined}
        dockExtra={
          <MultiDock lang={lang} kind={kind} traps={kind === 'party' || trapped} charges={kind === 'party' ? 1 : 0} target={leader?.name ?? null} immune={false} onTrap={noop} onEmote={noop} onHelp={noop} />
        }
      />
      {trapped && <Bubble who={others[0]} icon="inkwell" text={fm(M.trappedInk, { n: others[0].name })} />}
      {kind === 'coop' && <Bubble who={others[1]} icon="wave" text={fm(M.needHelp, { n: others[1].name, w: 3 })} />}
    </>
  );
}
