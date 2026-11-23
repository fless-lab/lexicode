// Écrans du jeu à plusieurs : accueil, recherche d'adversaire, face-à-face, salon, bandeau des rivaux,
// pièges, résultats et défis entre amis. Ils ne connaissent que l'état de salle (multi/protocol) :
// la même interface sert au serveur réel et aux maquettes.

import { useEffect, useState } from 'react';
import type { Difficulty, Lang } from '../engine/types';
import { MULTI_STRINGS } from '../i18n-multi';
import { STRINGS } from '../i18n';
import { PLAYER_COLORS, MULTI_RULES, type Emote, type Look, type PlayerPub, type RoomKind, type RoomState, type TrapKind } from '../multi/protocol';
import { Icon } from './Icon';
import { Loupi, type HatId, type LoupeId, type Mood, type NeckId, type Outfit } from './mascot';
import { fmt } from './Play';

export const fm = (s: string, v: Record<string, string | number>, lang?: Lang) => {
  const out = s.replace(/\{(\w+)\}/g, (_, k) => String(v[k] ?? ''));
  // En français, « de » s'élide devant une voyelle : « Fantôme d'Ama ».
  return lang === 'fr' ? out.replace(/\bde ([AEIOUYÉÈÊÂÎaeiouyéèêâî])/g, "d'$1") : out;
};
export const colorOf = (p: { color: number }) => PLAYER_COLORS[p.color % PLAYER_COLORS.length];

export function lookOutfit(l: Look): Outfit {
  return { hat: l.hat as HatId | undefined, neck: (l.neck ?? 'scarf') as NeckId, loupe: (l.loupe ?? 'gold') as LoupeId, back: l.back as 'cape' | undefined };
}

/** Portrait d'un joueur : Loupi dans sa tenue, dans un médaillon à sa couleur. */
export function Avatar({ p, size = 48, mood = 'idle', ghost, flip }: { p: { look: Look; color: number }; size?: number; mood?: Mood; ghost?: boolean; flip?: boolean }) {
  return (
    <span className={`avatar ${ghost ? 'ghosted' : ''} ${flip ? 'flip' : ''}`} style={{ '--pc': colorOf(p), width: size, height: size } as React.CSSProperties}>
      <Loupi bust mood={mood} size={size * 1.05} outfit={lookOutfit(p.look)} />
      {ghost && <Icon name="ghost" size={Math.round(size * 0.36)} className="gh" />}
    </span>
  );
}

function Head({ title, back, right, lang }: { title: string; back: () => void; right?: React.ReactNode; lang: Lang }) {
  return (
    <header className="subhead">
      <button className="iconbtn" onClick={back} aria-label={MULTI_STRINGS[lang].back}><Icon name="back" /></button>
      <h2>{title}</h2>
      {right}
    </header>
  );
}

// ---------------- Accueil du jeu à plusieurs ----------------

export interface HubProps {
  lang: Lang;
  rating: number;
  look: Look;
  rival: Look;
  online: number | null;
  offline: boolean;
  back: () => void;
  onDuel: () => void;
  onParty: () => void;
  onCoop: () => void;
  onJoin: (code: string) => void;
  onChallenge: () => void;
  onGhost: () => void;
}

export function MultiHub(p: HubProps) {
  const M = MULTI_STRINGS[p.lang];
  const [code, setCode] = useState('');
  return (
    <div>
      <Head
        title={M.hub}
        back={p.back}
        lang={p.lang}
        right={p.online !== null && !p.offline ? <span className="online"><i />{fm(M.online, { n: p.online })}</span> : undefined}
      />
      <div className="screen mhub" style={{ paddingTop: 6 }}>
        <section className="vshero">
          <div className="vs-side l"><Loupi size={124} mood="think" outfit={lookOutfit(p.look)} /></div>
          <div className="vs-side r"><Loupi size={124} mood="wow" outfit={lookOutfit(p.rival)} /></div>
          <span className="vs-badge">VS</span>
          <p>{M.hubSub}</p>
        </section>

        {p.offline && <p className="offline-note"><Icon name="offline" size={18} />{M.offline}</p>}

        <article className="mcard duel">
          <div className="mc-top">
            <span className="mc-ico"><Icon name="arena" size={30} /></span>
            <div>
              <b>{M.duel}</b>
              <small>{M.duelSub}</small>
            </div>
          </div>
          <div className="mc-facts">
            <span><Icon name="brain" size={15} />{fm(M.rating, { n: p.rating })}</span>
            <span><Icon name="user" size={15} />1 {M.vs} 1</span>
            <span><Icon name="hourglass" size={15} />{fmt(MULTI_RULES.timeMs)}</span>
          </div>
          <button className="btn primary lg block" disabled={p.offline} onClick={p.onDuel}><Icon name="search" size={20} />{M.search}</button>
        </article>

        <section className="tiles">
          <button className="tile t-violet" disabled={p.offline} onClick={p.onParty}>
            <Icon name="users" size={34} />
            <b>{M.party}</b>
            <small>2 – 5</small>
          </button>
          <button className="tile t-teal" disabled={p.offline} onClick={p.onCoop}>
            <Icon name="handshake" size={34} />
            <b>{M.coop}</b>
            <small>2 – 4</small>
          </button>
        </section>

        <form
          className="joinrow"
          onSubmit={(e) => {
            e.preventDefault();
            if (code.length === 4) p.onJoin(code);
          }}
        >
          <label>
            <span>{M.joinCode}</span>
            <input value={code} maxLength={4} placeholder={M.codePh} autoCapitalize="characters" onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))} />
          </label>
          <button className="btn gold" disabled={code.length !== 4 || p.offline}>{M.join}</button>
        </form>

        <button className="rowlink" disabled={p.offline} onClick={p.onChallenge}>
          <span className="rl-icon"><Icon name="send" size={22} /></span>
          <span className="rl-main"><b>{M.challenge}</b><small>{M.challengeSub}</small></span>
          <Icon name="back" size={18} className="chev" />
        </button>
        <button className="rowlink" disabled={p.offline} onClick={p.onGhost}>
          <span className="rl-icon"><Icon name="ghost" size={22} /></span>
          <span className="rl-main"><b>{M.ghost}</b><small>{M.ghostSub}</small></span>
          <Icon name="back" size={18} className="chev" />
        </button>
        <p className="fair"><Icon name="shield" size={14} /> {M.noHints}</p>
      </div>
    </div>
  );
}

// ---------------- Recherche d'un adversaire ----------------

export function Matchmaking({ lang, rating, look, since, onCancel, onGhost }: { lang: Lang; rating: number; look: Look; since: number; onCancel: () => void; onGhost: () => void }) {
  const M = MULTI_STRINGS[lang];
  const [now, setNow] = useState(Date.now());
  const [patient, setPatient] = useState(false);
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, []);
  const waited = now - since;
  const offerGhost = waited > 15_000 && !patient;
  return (
    <div className="mm">
      <div className="radar">
        <i /><i /><i />
        <Avatar p={{ look, color: 0 }} size={128} mood="think" />
        {[0, 1, 2, 3, 4].map((k) => <span key={k} className="blip" style={{ '--k': k } as React.CSSProperties} />)}
      </div>
      <h2>{M.searching}</h2>
      <p className="muted">{fm(M.searchingSub, { r: rating })}</p>
      <span className="mm-time">{fmt(waited)}</span>
      {offerGhost && (
        <div className="mm-offer">
          <p className="bubble">{M.noOne}</p>
          <div className="row">
            <button className="btn" onClick={() => setPatient(true)}>{M.keepWaiting}</button>
            <button className="btn primary" onClick={onGhost}><Icon name="ghost" size={18} />{M.playGhost}</button>
          </div>
        </div>
      )}
      <button className="btn ghost mm-cancel" onClick={onCancel}>{M.cancel}</button>
    </div>
  );
}

// ---------------- Face-à-face avant le départ ----------------

export function Versus({ lang, me, opp, startAt, ghost }: { lang: Lang; me: PlayerPub; opp: PlayerPub; startAt: number; ghost?: boolean }) {
  const M = MULTI_STRINGS[lang];
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(id);
  }, []);
  const left = Math.ceil((startAt - now) / 1000);
  const card = (p: PlayerPub, side: 'top' | 'bot', isMe: boolean) => (
    <div className={`vs-half ${side}`} style={{ '--pc': colorOf(p) } as React.CSSProperties}>
      <div className="vs-card">
        <Loupi size={150} mood={isMe ? 'think' : 'wow'} outfit={lookOutfit(p.look)} className={side === 'top' ? 'flip' : ''} />
        <div className="vs-id">
          {ghost && !isMe && <span className="ptag lock"><Icon name="ghost" size={13} />{M.ghostNote}</span>}
          <b>{isMe ? M.you : ghost ? fm(M.ghostLabel, { n: p.name }, lang) : p.name}</b>
          <small>{p.place}</small>
          <span className="vs-rating"><Icon name="brain" size={15} />{p.rating}</span>
          {p.look.title && <em className="vs-title">{p.look.title}</em>}
        </div>
      </div>
    </div>
  );
  return (
    <div className="versus">
      {card(opp, 'top', false)}
      <div className="vs-mid">
        <span className="vs-badge big">VS</span>
        <span className="vs-count" key={left} aria-label={M.getReady}>{left > 0 ? left : '!'}</span>
      </div>
      {card(me, 'bot', true)}
    </div>
  );
}

// ---------------- Bandeau des rivaux pendant la partie ----------------

export function RivalStrip({ lang, players, meId, total, ghostId, trapped }: { lang: Lang; players: PlayerPub[]; meId: string; total: number; ghostId?: string; trapped?: Record<string, TrapKind | undefined> }) {
  const M = MULTI_STRINGS[lang];
  const pct = (p: PlayerPub) => (p.doneMs !== null ? 100 : Math.min(100, Math.round((p.letters / Math.max(1, total)) * 100)));
  const order = [...players].sort((a, b) => (a.doneMs ?? Infinity) - (b.doneMs ?? Infinity) || b.letters - a.letters);
  const me = players.find((x) => x.id === meId);
  const rank = order.findIndex((x) => x.id === meId) + 1;
  // Le joueur passe devant les autres à l'écran ; les plus avancés sont dessinés en dernier.
  const drawn = [...players].sort((a, b) => (a.id === meId ? 1 : b.id === meId ? -1 : pct(a) - pct(b)));
  const duo = players.length === 2;
  const opp = duo ? players.find((x) => x.id !== meId) : undefined;
  return (
    <div className="race">
      {duo && opp && (
        <div className="race-names">
          <span style={{ '--pc': colorOf(me ?? opp) } as React.CSSProperties}>{M.you} <b>{me ? pct(me) : 0}%</b></span>
          <span style={{ '--pc': colorOf(opp) } as React.CSSProperties}>{opp.id === ghostId ? fm(M.ghostLabel, { n: opp.name }, lang) : opp.name} <b>{pct(opp)}%</b></span>
        </div>
      )}
      <div className="track">
        <span className="lane" />
        {me && <span className="lane-me" style={{ width: `${pct(me)}%`, '--pc': colorOf(me) } as React.CSSProperties} />}
        <Icon name="flag" size={20} className="finish" />
        {drawn.map((p) => (
          <span key={p.id} className={`runner ${p.id === meId ? 'me' : ''} ${p.connected ? '' : 'gone'}`} style={{ left: `${pct(p)}%` }}>
            <Avatar p={p} size={p.id === meId ? 32 : 26} ghost={p.id === ghostId} mood={p.doneMs !== null ? 'happy' : 'idle'} />
            {trapped?.[p.id] && <Icon name={trapped[p.id] === 'ink' ? 'inkwell' : 'snow'} size={13} className="hit" />}
          </span>
        ))}
      </div>
      {!duo && (
        <span className="race-rank">
          <b>{rank}</b>/{players.length}
        </span>
      )}
    </div>
  );
}

/** Coop : l'équipe et ses cœurs partagés. */
export function TeamStrip({ lang, players, meId, lives, maxLives }: { lang: Lang; players: PlayerPub[]; meId: string; lives: number; maxLives: number }) {
  const M = MULTI_STRINGS[lang];
  return (
    <div className="team">
      <div className="team-avs">
        {players.map((p) => (
          <span key={p.id} className="team-p" style={{ '--pc': colorOf(p) } as React.CSSProperties}>
            <Avatar p={p} size={34} />
            <small>{p.id === meId ? M.you : p.name}</small>
            <em>{p.letters}</em>
          </span>
        ))}
      </div>
      <span className="team-lives" aria-label={`${M.teamLives} ${lives}`}>
        {Array.from({ length: maxLives }, (_, i) => <Icon key={i} name={i < lives ? 'heartFill' : 'heart'} size={15} className={i < lives ? '' : 'lost'} />)}
      </span>
    </div>
  );
}

// ---------------- Barre d'actions au-dessus du clavier ----------------

export function MultiDock({ lang, kind, traps, charges, target, immune, onTrap, onEmote, onHelp }: {
  lang: Lang;
  kind: RoomKind;
  traps: boolean;
  charges: number;
  target: string | null;
  immune: boolean;
  onTrap: (k: TrapKind) => void;
  onEmote: (e: Emote) => void;
  onHelp: () => void;
}) {
  const M = MULTI_STRINGS[lang];
  const [emotes, setEmotes] = useState(false);
  return (
    <div className="tools mdock">
      {kind === 'coop' ? (
        <button className="tool" onClick={onHelp}><Icon name="wave" size={17} />{M.askHelp}</button>
      ) : traps ? (
        (['ink', 'freeze'] as TrapKind[]).map((k) => (
          <button key={k} className={`tool trapbtn ${charges > 0 && target && !immune ? 'armed' : ''}`} disabled={charges === 0 || !target || immune} onClick={() => onTrap(k)}>
            <Icon name={k === 'ink' ? 'inkwell' : 'snow'} size={18} />
            <span className="tb-txt">{k === 'ink' ? M.trapInk : M.trapFreeze}<small>{immune ? M.immune : target ? `→ ${target}` : ''}</small></span>
          </button>
        ))
      ) : (
        <p className="nohints"><Icon name="shield" size={15} />{M.noHints}</p>
      )}
      {traps && kind !== 'coop' && <span className="charges" aria-label={M.trap}><Icon name="bolt" size={14} />{charges}</span>}
      <span className="emotewrap">
        <button className="tool boost" onClick={() => setEmotes(!emotes)} aria-label={M.emotesLabel}><Icon name="chat" size={18} /></button>
        {emotes && (
          <span className="emotes">
            {(Object.keys(M.emotes) as Emote[]).map((e) => (
              <button key={e} onClick={() => { onEmote(e); setEmotes(false); }}>{M.emotes[e]}</button>
            ))}
          </span>
        )}
      </span>
    </div>
  );
}

/** Bulle éphémère au-dessus de la grille : émote, demande d'aide, piège reçu. */
export function Bubble({ who, text, icon }: { who: PlayerPub; text: string; icon?: string }) {
  return (
    <div className="mbubble" style={{ '--pc': colorOf(who) } as React.CSSProperties}>
      <Avatar p={who} size={28} />
      <span>{icon && <Icon name={icon} size={15} />}{text}</span>
    </div>
  );
}

// ---------------- Salon ----------------

export function Lobby({ lang, state, meId, onReady, onStart, onOptions, onShare, onCopy, onLeave }: {
  lang: Lang;
  state: RoomState;
  meId: string;
  onReady: (r: boolean) => void;
  onStart: () => void;
  onOptions: (o: { d?: Difficulty; traps?: boolean }) => void;
  onShare: () => void;
  onCopy: () => void;
  onLeave: () => void;
}) {
  const M = MULTI_STRINGS[lang];
  const T = STRINGS[lang];
  const me = state.players.find((p) => p.id === meId);
  const host = !!me?.host;
  const max = MULTI_RULES.maxPlayers[state.kind];
  const min = MULTI_RULES.minPlayers[state.kind];
  const others = state.players.filter((p) => !p.host);
  const canStart = state.players.length >= min && others.every((p) => p.ready);
  const seats = Array.from({ length: max }, (_, i) => state.players[i] ?? null);
  return (
    <div>
      <Head title={state.kind === 'coop' ? M.coop : M.party} back={onLeave} lang={lang} />
      <div className="screen lobby" style={{ paddingTop: 6 }}>
        <section className="codecard">
          <small>{M.lobbyCode}</small>
          <div className="codetiles">{state.code.split('').map((c, i) => <span key={i}>{c}</span>)}</div>
          <div className="row">
            <button className="btn" onClick={onCopy}><Icon name="copy" size={18} />{M.copy}</button>
            <button className="btn gold" onClick={onShare}><Icon name="share" size={18} />{M.share}</button>
          </div>
        </section>

        <div className="sechead"><h3>{state.players.length < max ? M.waitingFor : M.lobby}</h3><span className="aside">{state.players.length} / {max}</span></div>
        <section className={`seats n${max}`}>
          {seats.map((p, i) =>
            p ? (
              <div key={p.id} className={`seat ${p.ready || p.host ? 'ok' : ''}`} style={{ '--pc': colorOf(p) } as React.CSSProperties}>
                {p.host && <span className="seat-host"><Icon name="crown" size={14} />{M.host}</span>}
                <Avatar p={p} size={64} mood={p.ready || p.host ? 'happy' : 'idle'} />
                <b>{p.id === meId ? M.you : p.name}</b>
                <small>{p.place}</small>
                {!p.host && <span className={`seat-ready ${p.ready ? 'on' : ''}`}>{p.ready ? <><Icon name="check" size={13} />{M.ready}</> : M.notReady}</span>}
              </div>
            ) : (
              <div key={`e${i}`} className="seat empty"><Icon name="user" size={30} /><small>{M.emptySeat}</small></div>
            ),
          )}
        </section>

        <section className="panel lobbyset">
          <div className="sechead"><h3>{M.settings}</h3></div>
          <label className="ls-row"><span>{M.difficulty}</span></label>
          <div className="seg" role="radiogroup">
            {([1, 2, 3, 4, 5] as Difficulty[]).map((x) => (
              <button key={x} disabled={!host} className={state.options.d === x ? 'on' : ''} onClick={() => onOptions({ d: x })} role="radio" aria-checked={state.options.d === x}>{T.d[x]}</button>
            ))}
          </div>
          {state.kind === 'party' && (
            <button className="ls-row toggle-row" disabled={!host} onClick={() => onOptions({ traps: !state.options.traps })}>
              <span><b><Icon name="bolt" size={16} />{M.trapsOn}</b><small>{M.trapsHint}</small></span>
              <span className={`switch ${state.options.traps ? 'on' : ''}`}><i /></span>
            </button>
          )}
        </section>

        {host ? (
          <button className="btn primary lg block" disabled={!canStart} onClick={onStart}>
            <Icon name="play" size={18} />{M.start}
            {state.players.length < min && <small>{fm(M.needPlayers, { n: min })}</small>}
          </button>
        ) : (
          <>
            <button className={`btn lg block ${me?.ready ? '' : 'primary'}`} onClick={() => onReady(!me?.ready)}>
              {me?.ready ? <><Icon name="check" size={18} />{M.ready}</> : M.imReady}
            </button>
            <p className="fair">{M.waitHost}</p>
          </>
        )}
      </div>
    </div>
  );
}

// ---------------- Résultats ----------------

export interface Gains {
  xp: number;
  tokens: number;
}

export function MultiResult({ lang, state, meId, ratingDelta, gains, ghostId, onRematch, onLeave }: {
  lang: Lang;
  state: RoomState;
  meId: string;
  ratingDelta?: number;
  gains: Gains;
  ghostId?: string;
  onRematch?: () => void;
  onLeave: () => void;
}) {
  const M = MULTI_STRINGS[lang];
  const order = [...state.players].sort((a, b) =>
    a.doneMs !== null && b.doneMs !== null ? a.doneMs - b.doneMs : a.doneMs !== null ? -1 : b.doneMs !== null ? 1 : b.letters - a.letters || a.mistakes - b.mistakes,
  );
  const myRank = order.findIndex((p) => p.id === meId) + 1;
  const name = (p: PlayerPub) => (p.id === meId ? M.you : p.id === ghostId ? fm(M.ghostLabel, { n: p.name }, lang) : p.name);
  const gainRow = (
    <div className="gains">
      <span className="gain xp"><Icon name="sparkle" size={14} />+{gains.xp} XP</span>
      {gains.tokens > 0 && <span className="gain"><Icon name="token" size={14} />+{gains.tokens}</span>}
      {ratingDelta !== undefined && (
        <span className={`gain ${ratingDelta >= 0 ? 'rec' : ''}`}><Icon name="brain" size={14} />{M.ratingDelta} {ratingDelta >= 0 ? '+' : ''}{ratingDelta}</span>
      )}
    </div>
  );
  const buttons = (
    <div className="row">
      <button className="btn" onClick={onLeave}>{M.leave}</button>
      {onRematch && <button className="btn primary" onClick={onRematch}><Icon name="rotate" size={18} />{M.rematch}</button>}
    </div>
  );

  if (state.kind === 'coop') {
    const won = state.players.length > 0 && state.players.every((p) => p.doneMs !== null);
    const best = [...state.players].sort((a, b) => b.letters - a.letters)[0];
    const time = Math.max(0, ...state.players.map((p) => p.doneMs ?? 0));
    return (
      <div className="modal">
        <div className={`sheet result mres ${won ? 'win' : ''}`}>
          <Loupi size={110} mood={won ? 'happy' : 'sad'} className="pop-in" />
          <h2>{won ? M.teamWin : M.teamLose}</h2>
          <div className="team-res">
            {state.players.map((p) => (
              <span key={p.id} className="team-p" style={{ '--pc': colorOf(p) } as React.CSSProperties}>
                <Avatar p={p} size={52} mood={won ? 'happy' : 'sad'} />
                <small>{name(p)}</small>
                <em>{p.letters}</em>
              </span>
            ))}
          </div>
          <div className="stats-row">
            <div><b>{fmt(time)}</b><small>{M.teamTime}</small></div>
            {best && <div><b>{name(best)}</b><small>{M.mvp}</small></div>}
          </div>
          {gainRow}
          {buttons}
        </div>
      </div>
    );
  }

  if (state.kind === 'duel') {
    const [a, b] = order;
    const won = a?.id === meId && a.doneMs !== null;
    const me = state.players.find((p) => p.id === meId)!;
    const opp = state.players.find((p) => p.id !== meId)!;
    return (
      <div className="modal">
        <div className={`sheet result mres ${won ? 'win' : ''}`}>
          <h2>{won ? M.win : a && b && a.doneMs === null && b.doneMs === null && a.letters === b.letters ? M.draw : M.lose}</h2>
          <div className="duel-res">
            {[me, opp].map((p) => (
              <div key={p.id} className={`dr ${order[0]?.id === p.id ? 'top' : ''}`} style={{ '--pc': colorOf(p) } as React.CSSProperties}>
                {order[0]?.id === p.id && <Icon name="crown" size={26} className="dr-crown" />}
                <Avatar p={p} size={86} mood={order[0]?.id === p.id ? 'happy' : 'sad'} ghost={p.id === ghostId} />
                <b>{name(p)}</b>
                <span className="dr-time">{p.doneMs !== null ? fmt(p.doneMs) : `${Math.round((p.letters / Math.max(1, state.total)) * 100)}%`}</span>
                <small className="dr-meta"><span><Icon name="check" size={12} />{fm(M.words, { n: p.words })}</span><span><Icon name="close" size={12} />{p.mistakes}</span></small>
              </div>
            ))}
          </div>
          {gainRow}
          {buttons}
        </div>
      </div>
    );
  }

  const podium = [order[1], order[0], order[2]];
  return (
    <div className="modal">
      <div className={`sheet result mres ${myRank === 1 ? 'win' : ''}`}>
        <h2>{myRank === 1 ? M.win : fm(M.place, { n: myRank })}</h2>
        <div className="podium">
          {podium.map((p, i) =>
            p ? (
              <div key={p.id} className={`pod p${[2, 1, 3][i]}`} style={{ '--pc': colorOf(p) } as React.CSSProperties}>
                {i === 1 && <Icon name="crown" size={26} className="dr-crown" />}
                <Avatar p={p} size={i === 1 ? 70 : 56} mood={i === 1 ? 'happy' : 'idle'} />
                <b>{name(p)}</b>
                <span className="step"><em>{[2, 1, 3][i]}</em><small>{p.doneMs !== null ? fmt(p.doneMs) : `${p.letters}`}</small></span>
              </div>
            ) : (
              <div key={i} className="pod" />
            ),
          )}
        </div>
        {order.length > 3 && (
          <ol className="podrest" start={4}>
            {order.slice(3).map((p) => (
              <li key={p.id} className={p.id === meId ? 'you' : ''} style={{ '--pc': colorOf(p) } as React.CSSProperties}>
                <Avatar p={p} size={30} />
                <b>{name(p)}</b>
                <span>{p.doneMs !== null ? fmt(p.doneMs) : `${Math.round((p.letters / Math.max(1, state.total)) * 100)}%`}</span>
              </li>
            ))}
          </ol>
        )}
        {gainRow}
        {buttons}
      </div>
    </div>
  );
}

// ---------------- Défis entre amis ----------------

export function ChallengeShare({ lang, name, score, ms, link, onShare, onCopy, onClose }: { lang: Lang; name: string; score: number; ms: number; link: string; onShare: () => void; onCopy: () => void; onClose: () => void }) {
  const M = MULTI_STRINGS[lang];
  return (
    <div className="modal" onClick={onClose}>
      <div className="sheet chshare" onClick={(e) => e.stopPropagation()}>
        <Loupi size={104} mood="wow" className="pop-in" />
        <h2>{M.challengeReady}</h2>
        <p className="lead">{M.challengeShare}</p>
        <p className="bubble">{fm(M.challengeText, { n: name, s: score, t: fmt(ms) })}</p>
        <div className="linkrow">
          <code>{link}</code>
          <button className="btn sm" onClick={onCopy}><Icon name="copy" size={16} /></button>
        </div>
        <button className="btn primary lg block" onClick={onShare}><Icon name="send" size={19} />{M.share}</button>
      </div>
    </div>
  );
}

export function ChallengeInvite({ lang, from, score, ms, d, onAccept, onLater }: { lang: Lang; from: PlayerPub; score: number; ms: number; d: Difficulty; onAccept: () => void; onLater: () => void }) {
  const M = MULTI_STRINGS[lang];
  const T = STRINGS[lang];
  return (
    <div className="modal center">
      <div className="sheet chinvite" style={{ '--pc': colorOf(from) } as React.CSSProperties}>
        <div className="ci-head">
          <Avatar p={from} size={92} mood="wow" />
          <span className="vs-badge">VS</span>
        </div>
        <h2>{fm(M.challengeFrom, { n: from.name })}</h2>
        <p className="lead">{fm(M.challengeFromSub, { s: score, t: fmt(ms) })}</p>
        <div className="mc-facts center">
          <span><Icon name="target" size={15} />{T.d[d]}</span>
          <span><Icon name="ghost" size={15} />{fm(M.ghostLabel, { n: from.name }, lang)}</span>
        </div>
        <button className="btn primary lg block" onClick={onAccept}><Icon name="play" size={18} />{M.accept}</button>
        <button className="btn ghost block" onClick={onLater}>{M.later}</button>
      </div>
    </div>
  );
}
