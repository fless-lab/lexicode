import { useEffect, useMemo, useState } from 'react';
import type { Difficulty, Lang, PhraseCell, Puzzle } from '../engine/types';
import { PACKS, LANGS, detectLang } from '../content';
import { STRINGS, COUNTRIES, type Strings } from '../i18n';
import { liveStreak, emptySave, today, type Save } from '../storage';
import { ranking, type RankRow, type Scope } from '../services/ranking';
import { billing, REWARD } from '../services/monetization';
import { rngFromSeed } from '../engine/rng';
import { ARENA, TIME_LIMIT, rulesFor, type Mode, type ModeKind } from '../modes';
import { levelProgress, titleIndex, LEAGUE_SIZE, PROMOTE, DEMOTE, leagueRows, weekKey, weekFraction, ACHIEVEMENTS, playerLevel } from '../progress';
import {
  questsFor, freshQuests, QUEST_BONUS, BOOSTERS, SKINS, SEASON_TIERS, TIER_XP, seasonOf, seasonDaysLeft, seasonTier,
  tierReward, freshSeason, type Reward,
} from '../meta';
import { fmt } from './Play';
import { sfx } from '../sound';
import { Icon, MODE_ICON, BOOSTER_ICON, achIcon } from './Icon';
import { AdventureCard, ExpeditionCard } from './adventure';
import { Scene } from './scenes';
import { Loupi, type Mood, type Outfit } from './mascot';
import { EventBanner } from './shop';
import { SHOP_STRINGS } from '../i18n-shop';
import type { SeasonalEvent } from '../events';

export type Screen = 'home' | 'play' | 'arena' | 'season' | 'ranking' | 'profile' | 'album' | 'league' | 'settings' | 'premium' | 'adventure' | 'shop' | 'wardrobe' | 'event' | 'packs' | 'archive';
type SetSave = React.Dispatch<React.SetStateAction<Save>>;

const fill = (s: string, n: number | string) => s.replace('{n}', String(n));
const modeLabel = (t: Strings, k: ModeKind): string[] =>
  k === 'daily' ? [t.daily, t.dailySub] : k === 'level' ? [t.adventure, ''] : k === 'practice' ? [t.practice, ''] : k === 'expedition' ? [t.expedition, t.expeditionSub] : ((t[`mode_${k}` as 'mode_zen'] as string[] | undefined) ?? [k, '']);

function untilSunday(): string {
  const now = new Date();
  const end = new Date(now);
  end.setDate(now.getDate() + (7 - ((now.getDay() + 6) % 7)));
  end.setHours(0, 0, 0, 0);
  const h = Math.max(0, Math.round((end.getTime() - now.getTime()) / 3600000));
  return h >= 24 ? `${Math.floor(h / 24)} j ${h % 24} h` : `${h} h`;
}

export function Wordmark({ small }: { small?: boolean }) {
  return (
    <div className={`wordmark ${small ? 'sm' : ''}`} aria-label="Lexicode">
      {'LEXICODE'.split('').map((c, i) => <span key={i} style={{ '--i': i } as React.CSSProperties} className={i >= 4 ? 'dim' : ''}>{c}</span>)}
    </div>
  );
}

export function RewardView({ r, t }: { r: Reward; t: Strings }) {
  if (r.skin) return <span className={`reward skin-${r.skin}`}><span className="sw"><span /><span /></span>{t[`skin_${r.skin}` as 'skin_ivory']}</span>;
  if (r.booster) return <span className="reward"><Icon name={BOOSTER_ICON[r.booster]} size={15} />{(t[`b_${r.booster}` as 'b_freeze'] as string[])[0]}</span>;
  return <span className="reward"><Icon name="token" size={15} />{r.tokens}</span>;
}

/** Loupi sur les toits de l'accueil : on le touche, il saute de joie. */
function HeroLoupi({ outfit }: { outfit?: Outfit }) {
  const [mood, setMood] = useState<Mood>('idle');
  return (
    <button className="hero-loupi" aria-label="Loupi" onClick={() => { sfx.star(mood === 'happy' ? 2 : 0); setMood('happy'); setTimeout(() => setMood('idle'), 1400); }}>
      <Loupi mood={mood} size={96} outfit={outfit} />
    </button>
  );
}

// ---------------- Choix de la langue ----------------

export function LangPicker({ onPick }: { onPick: (l: Lang) => void }) {
  const [sel, setSel] = useState<Lang>(detectLang());
  const t = STRINGS[sel];
  return (
    <div className="app">
      <div className="intro">
        <div className="intro-scene">
          <Scene kind="home" />
          <Loupi mood="happy" size={118} className="intro-loupi pop-in" title="Loupi" />
          <Wordmark />
        </div>
        <h1>{t.tagline}</h1>
        <p className="muted">{t.chooseLangSub}</p>
        <div className="langs" role="radiogroup" aria-label={t.chooseLang}>
          {LANGS.map((l) => (
            <button key={l.code} role="radio" aria-checked={sel === l.code} className={`lang ${sel === l.code ? 'on' : ''}`} onClick={() => { sfx.tap(); setSel(l.code); }}>
              {l.name}
              <small>{l.code.toUpperCase()}</small>
            </button>
          ))}
        </div>
        <button className="btn primary lg block" onClick={() => onPick(sel)}>{t.continue}</button>
      </div>
    </div>
  );
}

// ---------------- Barre d'onglets et barre d'état ----------------

export function TabBar({ t, screen, go, badges }: { t: Strings; screen: Screen; go: (s: Screen) => void; badges: Partial<Record<Screen, boolean>> }) {
  const tabs: [Screen, string, string][] = [
    ['home', 'home', t.tabHome],
    ['arena', 'arena', t.tabArena],
    ['season', 'flag', t.tabSeason],
    ['ranking', 'trophy', t.tabRank],
    ['profile', 'user', t.tabProfile],
  ];
  return (
    <nav className="tabs">
      {tabs.map(([s, ic, label]) => (
        <button key={s} className={`tab ${screen === s ? 'on' : ''}`} onClick={() => { sfx.tap(); go(s); }} aria-current={screen === s ? 'page' : undefined}>
          <Icon name={ic} size={22} />
          {label}
          {badges[s] && <span className="dot" />}
        </button>
      ))}
    </nav>
  );
}

function StatusBar({ t, save, day, go }: { t: Strings; save: Save; day: string; go: (s: Screen) => void }) {
  const lp = levelProgress(save.xp);
  return (
    <header className="status">
      <button className="me" onClick={() => go('profile')}>
        <span className={`lvbadge ${save.equip.frame ? `framed fr-${save.equip.frame}` : ''}`}>{lp.level}</span>
        <span className="who">
          <b>{save.name || t.titles[titleIndex(lp.level)]}</b>
          <span className="xpbar"><i style={{ width: `${(lp.cur / lp.need) * 100}%` }} /></span>
        </span>
      </button>
      <div className="counters">
        <span className="counter fire" title={t.streak}><Icon name="flame" size={16} />{liveStreak(save, day)}</span>
        <button className="counter gold" onClick={() => go('shop')} title={t.tokens}><Icon name="token" size={16} />{save.premium ? '∞' : save.tokens}</button>
        <button className="iconbtn" onClick={() => go('settings')} aria-label={t.settings}><Icon name="gear" /></button>
      </div>
    </header>
  );
}

function splitWords(cells: PhraseCell[]): PhraseCell[][] {
  const words: PhraseCell[][] = [[]];
  cells.forEach((c) => (c.kind === 'sep' && c.ch === ' ' ? words.push([]) : words[words.length - 1].push(c)));
  return words.filter((w) => w.length);
}

// ---------------- Accueil ----------------

interface HomeProps {
  t: Strings;
  save: Save;
  day: string;
  lang: Lang;
  daily: Puzzle;
  onStart: (m: Mode) => void;
  go: (s: Screen) => void;
  setSave: SetSave;
  claimQuest: (id: string) => void;
  claimQuestBonus: () => void;
  toast: (m: string, kind?: 'ach' | 'lvl' | 'info', icon?: string) => void;
  event?: SeasonalEvent | null;
  openArchive?: () => void;
}

export function Home({ t, save, day, lang, daily, onStart, go, setSave, claimQuest, claimQuestBonus, toast, event }: HomeProps) {
  const done = save.daily[lang]?.[day];
  const plv = playerLevel(save.xp);
  const quests = questsFor(day);
  const qs = freshQuests(day, save.quests);
  const allDone = quests.every((q) => qs.claimed.includes(q.id));
  const rows = leagueRows(save.league.week ?? weekKey(), save.league.tier, save.league.xp, save.name || t.you, weekFraction());
  const myRank = rows.findIndex((r) => r.isYou) + 1;
  const season = freshSeason(day, save.season);
  const sTier = seasonTier(season.xp);
  const chestReady = save.lastChest !== day;

  const openChest = () => {
    const r = REWARD.chest[Math.floor(rngFromSeed(`chest|${day}`)() * REWARD.chest.length)];
    setSave((s) => ({ ...s, lastChest: day, tokens: s.tokens + r }));
    sfx.coin();
    toast(`${t.dailyChest} : +${r}`, 'info', 'gift');
  };

  const week = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return !!save.daily[lang]?.[today(d)];
  });

  return (
    <div className="screen">
      <StatusBar t={t} save={save} day={day} go={go} />

      {event && <EventBanner ev={event} lang={lang} day={day} save={save} open={() => go('event')} />}

      <section className="hero" aria-label={t.dailyHero}>
        <Scene kind={(save.equip.decor as 'home') ?? 'home'} decor={event?.decor === 'xmas' ? 'xmas' : null} />
        <HeroLoupi />
        <div className="top">
          <h2>{done ? t.dailyDone : t.dailyHero}</h2>
          <span className="date">{new Date().toLocaleDateString(lang, { day: 'numeric', month: 'long' })}</span>
        </div>
        <div className="cipher" aria-hidden="true">
          {splitWords(daily.phrase).map((w, wi) => (
            <div className="w" key={wi}>
              {w.map((c, ci) =>
                c.kind === 'sep' ? (
                  <span key={ci} className="psep" style={{ fontSize: 16, marginTop: -10 }}>{c.ch}</span>
                ) : (
                  <span key={ci} className={`cell ${done || daily.given.includes(c.code) ? 'good' : ''}`}>
                    <span className="l">{done || daily.given.includes(c.code) ? c.shown : ''}</span>
                    <span className="n">{c.code}</span>
                  </span>
                ),
              )}
            </div>
          ))}
        </div>
        {done ? (
          <div className="row">
            <div className="done-line"><span className="done-score">{done.score}</span>{fmt(done.ms)}</div>
            <button className="btn ghost" style={{ marginLeft: 'auto' }} onClick={() => go('ranking')}><Icon name="trophy" size={18} />{t.ranking}</button>
          </div>
        ) : (
          <div className="row">
            <button className="btn primary lg" onClick={() => onStart({ kind: 'daily', d: daily.difficulty, nonce: day, date: day })}>{t.playToday}</button>
            <button className="iconbtn" style={{ width: 54, height: 54, borderRadius: 14 }} onClick={() => go('ranking')} aria-label={t.ranking}><Icon name="trophy" /></button>
          </div>
        )}
        <div className="week" aria-label={t.streak}>
          {week.map((on, i) => <i key={i} className={on ? 'on' : ''} />)}
          <span title={t.streak}><Icon name="flame" size={15} />{liveStreak(save, day)}<Icon name="shield" size={15} />{save.streak.freezes}</span>
        </div>
      </section>

      {chestReady && (
        <button className="rowlink" onClick={openChest}>
          <span className="rl-icon"><Icon name="gift" size={22} /></span>
          <span className="rl-main"><b>{t.dailyChest}</b><small>{t.freeTokens}</small></span>
          <span className="btn primary claim">{t.open}</span>
        </button>
      )}

      <AdventureCard t={t} save={save} lang={lang} onStart={onStart} open={() => go('adventure')} />

      <section className="tiles" aria-label={t.arena}>
        <button className="tile t-violet" onClick={() => go('arena')}>
          <Icon name="flag" size={34} />
          <b>{t.expedition}</b>
          <small>{t.bestDepth} {save.records[lang]?.expedition?.best ?? 0}</small>
        </button>
        <button className="tile t-coral" onClick={() => go('arena')}>
          <Icon name="arena" size={34} />
          <b>{t.arena}</b>
          <small>{ARENA.filter((a) => plv >= a.unlockLevel).length} / {ARENA.length}</small>
        </button>
        <button className="tile t-gold" onClick={() => go('season')}>
          <span className="tnum">{sTier}</span>
          <b>{fill(t.seasonN, season.id || seasonOf(day))}</b>
          <small>{fill(t.daysLeft, seasonDaysLeft(day))}</small>
        </button>
        <button className="tile t-teal" onClick={() => go('league')}>
          <Icon name="medal" size={34} />
          <b>{t.leagueNames[save.league.tier]}</b>
          <small className={myRank <= PROMOTE ? 'zone-up' : myRank > LEAGUE_SIZE - DEMOTE ? 'zone-down' : ''}>{t.rank} {myRank} / {LEAGUE_SIZE}</small>
        </button>
        <button className="tile t-wide t-blue" onClick={() => onStart({ kind: 'practice', d: 2, nonce: String(Date.now()) })}>
          <Icon name="target" size={30} />
          <span><b>{t.practice}</b><small>{t.d[2]}</small></span>
        </button>
      </section>

      <section className="sec">
        <div className="sechead">
          <h3>{t.quests}</h3>
          <span className="aside">{t.questsSub}</span>
        </div>
        <div className="panel">
          {quests.map((q) => {
            const p = qs.progress[q.id] ?? 0;
            const claimed = qs.claimed.includes(q.id);
            const ready = p >= q.target && !claimed;
            return (
              <div key={q.id} className={`quest ${claimed ? 'done' : ''}`}>
                <span className="qt">{fill(t[`q_${q.id}` as 'q_win3'], q.target)}</span>
                <span className="qbar"><i style={{ width: `${(Math.min(p, q.target) / q.target) * 100}%` }} /></span>
                <span className="qside">
                  {ready ? (
                    <button className="btn primary claim" onClick={() => claimQuest(q.id)}>{t.claim}</button>
                  ) : claimed ? (
                    <Icon name="check" size={16} />
                  ) : (
                    <span>{Math.min(p, q.target)}/{q.target}</span>
                  )}
                  <RewardView t={t} r={q.reward.booster ? { booster: q.reward.booster } : { tokens: q.reward.tokens }} />
                </span>
              </div>
            );
          })}
          <div className={`quest ${qs.bonusClaimed ? 'done' : ''}`}>
            <span className="qt">{t.questBonus}</span>
            <span className="qbar"><i style={{ width: `${(qs.claimed.filter((id) => quests.some((q) => q.id === id)).length / 3) * 100}%` }} /></span>
            <span className="qside">
              {allDone && !qs.bonusClaimed ? (
                <button className="btn primary claim" onClick={claimQuestBonus}>{t.claim}</button>
              ) : (
                <Icon name={qs.bonusClaimed ? 'check' : 'gift'} size={16} />
              )}
              <span className="reward"><Icon name="token" size={15} />{QUEST_BONUS.tokens}</span>
            </span>
          </div>
        </div>
      </section>
    </div>
  );
}

// ---------------- Arène ----------------

export function Arena({ t, save, lang, day, onStart, setSave, go, onExpedition }: { t: Strings; save: Save; lang: Lang; day: string; onStart: (m: Mode) => void; setSave: SetSave; go: (s: Screen) => void; onExpedition: (daily: boolean) => void }) {
  const [diffs, setDiffs] = useState<Record<string, Difficulty>>({});
  const plv = playerLevel(save.xp);
  return (
    <div className="screen">
      <StatusBar t={t} save={save} day={day} go={go} />
      <div className="sec">
        <h2>{t.arena}</h2>
        <p className="muted">{t.arenaSub}</p>
      </div>
      <ExpeditionCard t={t} save={save} lang={lang} day={day} onDaily={() => onExpedition(true)} onFree={() => onExpedition(false)} />
      {ARENA.map((a) => {
        const [name, desc] = modeLabel(t, a.kind);
        const d = (a.kind === 'hardcore' ? 5 : diffs[a.kind] ?? 2) as Difficulty;
        const key = a.pickD ? `${a.kind}:${d}` : a.kind;
        const rec = save.records[lang]?.[key];
        const locked = plv < a.unlockLevel;
        const r = rulesFor({ kind: a.kind, d, nonce: '' });
        return (
          <article key={a.kind} className={`modecard ${a.kind} ${locked ? 'locked' : ''}`}>
            <span className="disc"><Icon name={locked ? 'lock' : MODE_ICON[a.kind]} size={24} /></span>
            <h3>
              {name}
              {locked ? <small><Icon name="lock" size={13} />{t.lvl} {a.unlockLevel}</small> : rec && rec.best > 0 ? <small><Icon name="trophy" size={13} />{rec.best}{a.kind === 'marathon' ? ` ${t.grids}` : ''}</small> : null}
            </h3>
            <p>{desc}</p>
            {!locked && (
              <div className="more">
                <div className="facts">
                  {r.timeMs !== null && <span><Icon name="hourglass" size={14} />{fmt(a.kind === 'timeattack' ? TIME_LIMIT[d] : r.timeMs)}</span>}
                  {r.lives !== null && <span><Icon name="heart" size={14} />{r.lives}</span>}
                  {r.mult !== 1 && <span><Icon name="sparkle" size={14} />x{r.mult}</span>}
                  {rec && rec.played > 0 && <span><Icon name="chart" size={14} />{rec.wins}/{rec.played}</span>}
                </div>
                {a.pickD && (
                  <div className="seg" role="radiogroup">
                    {([1, 2, 3, 4, 5] as Difficulty[]).map((x) => (
                      <button key={x} className={d === x ? 'on' : ''} onClick={() => setDiffs({ ...diffs, [a.kind]: x })} role="radio" aria-checked={d === x}>{t.d[x]}</button>
                    ))}
                  </div>
                )}
                <button className="btn primary block" onClick={() => onStart({ kind: a.kind, d, nonce: String(Date.now()), run: 0 })}><Icon name="play" size={16} />{t.play}</button>
              </div>
            )}
          </article>
        );
      })}

      <section className="sec">
        <div className="sechead"><h3>{t.boosters}</h3></div>
        <p className="muted small">{t.boostersSub}</p>
        <div className="boosterlist">
          {BOOSTERS.map((id) => {
            const [n, desc] = t[`b_${id}` as 'b_freeze'] as string[];
            return (
              <div key={id} className="boost">
                <span className="disc"><Icon name={BOOSTER_ICON[id]} size={19} /></span>
                <b>{n}<em>{save.boosters[id] ?? 0}</em></b>
                <small>{desc}</small>
                {id === 'double' &&
                  (save.doubleArmed ? (
                    <span className="small" style={{ gridColumn: '1 / -1', color: 'var(--verdigris)', marginTop: 8 }}>{t.doubleArmed}</span>
                  ) : (
                    <button className="btn" disabled={!save.boosters.double} onClick={() => { sfx.booster(); setSave((s) => ({ ...s, doubleArmed: true, boosters: { ...s.boosters, double: s.boosters.double - 1 } })); }}>{t.arm}</button>
                  ))}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

// ---------------- Saison ----------------

export function Season({ t, save, day, go, claimTier, setSave }: { t: Strings; save: Save; day: string; go: (s: Screen) => void; claimTier: (tier: number, premium: boolean) => void; setSave: SetSave }) {
  const season = freshSeason(day, save.season);
  const reached = seasonTier(season.xp);
  return (
    <div className="screen">
      <StatusBar t={t} save={save} day={day} go={go} />
      <div className="sec">
        <h2>{fill(t.seasonN, season.id || seasonOf(day))}</h2>
        <p className="muted">{t.seasonSub}</p>
        <div className="rowlink" style={{ cursor: 'default' }}>
          <span className="rl-icon">{reached}</span>
          <span className="rl-main">
            <b>{t.tier} {reached} / {SEASON_TIERS}</b>
            <span className="xpbar wide"><i style={{ width: `${reached >= SEASON_TIERS ? 100 : ((season.xp % TIER_XP) / TIER_XP) * 100}%` }} /></span>
            <small>{season.xp % TIER_XP} / {TIER_XP} {t.xp}, {fill(t.daysLeft, seasonDaysLeft(day))}</small>
          </span>
        </div>
      </div>

      <section className="sec">
        <div className="sechead"><h3>{t.skins}</h3></div>
        <div className="skins">
          {SKINS.map((k) => {
            const owned = save.skins.includes(k);
            return (
              <button key={k} className={`skin skin-${k} ${owned ? '' : 'locked'} ${save.skin === k ? 'on' : ''}`} disabled={!owned} onClick={() => { sfx.tap(); setSave((s) => ({ ...s, skin: k })); }}>
                <span className="sw"><span>L</span><span>X</span></span>
                <b>{t[`skin_${k}` as 'skin_ivory']}</b>
                <small>{save.skin === k ? t.equipped : owned ? t.equip : <Icon name="lock" size={12} />}</small>
              </button>
            );
          })}
        </div>
      </section>

      <section className="sec">
        <div className="trackhead"><span>{t.freeTrack}</span><span /><span>{t.premiumTrack}</span></div>
        <div className="track">
          {Array.from({ length: SEASON_TIERS }, (_, i) => i + 1).map((tier) => {
            const ok = tier <= reached;
            const gotF = season.claimed.includes(tier);
            const gotP = season.claimedPremium.includes(tier);
            const cls = (got: boolean, can: boolean) => `rw ${got ? 'got' : can ? 'ready' : 'locked'}`;
            return (
              <div key={tier} className={`tierrow ${ok ? 'reached' : ''}`}>
                <button className={cls(gotF, ok)} disabled={!ok || gotF} onClick={() => claimTier(tier, false)}>
                  <RewardView t={t} r={tierReward(tier, false)} />
                  {ok && !gotF && <Icon name="gift" size={15} />}
                </button>
                <span className="tn">{tier}</span>
                <button className={`${cls(gotP, ok && save.premium)} prem right`} disabled={(save.premium && (!ok || gotP))} onClick={() => (save.premium ? claimTier(tier, true) : go('shop'))}>
                  <RewardView t={t} r={tierReward(tier, true)} />
                  {!save.premium && <Icon name="lock" size={14} />}
                </button>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

// ---------------- Écrans secondaires ----------------

function Sub({ title, back, children }: { title: string; back: () => void; children: React.ReactNode }) {
  return (
    <div>
      <header className="subhead">
        <button className="iconbtn" onClick={back} aria-label="Retour"><Icon name="back" /></button>
        <h2>{title}</h2>
      </header>
      <div className="screen" style={{ paddingTop: 6 }}>{children}</div>
    </div>
  );
}

const BOARDS: { key: string; kind: ModeKind; count?: boolean }[] = [
  { key: 'daily', kind: 'daily' },
  { key: 'timeattack:3', kind: 'timeattack' },
  { key: 'survival:3', kind: 'survival' },
  { key: 'sudden:3', kind: 'sudden' },
  { key: 'expedition', kind: 'expedition', count: true },
  { key: 'marathon', kind: 'marathon', count: true },
  { key: 'cryptogram:3', kind: 'cryptogram' },
  { key: 'hardcore', kind: 'hardcore' },
];

export function Ranking({ t, save, lang, day, go }: { t: Strings; save: Save; lang: Lang; day: string; go: (s: Screen) => void }) {
  const [scope, setScope] = useState<Scope>('country');
  const [board, setBoard] = useState(0);
  const [rows, setRows] = useState<RankRow[]>([]);
  const b = BOARDS[board];
  const mine = useMemo(() => {
    if (b.key === 'daily') return save.daily[lang]?.[day];
    const r = save.records[lang]?.[b.key];
    return r && r.best > 0 ? { score: r.best, ms: r.bestMs ?? 0 } : undefined;
  }, [b.key, save.daily, save.records, lang, day]);
  useEffect(() => {
    const me = mine ? { name: save.name || t.you, city: save.city, country: save.country, score: mine.score, ms: mine.ms } : null;
    ranking.board(lang, b.key === 'daily' ? `daily:${day}` : b.key, scope, me, { city: save.city, country: save.country }, b.count).then(setRows);
  }, [scope, b, lang, day, mine, save.name, save.city, save.country, t.you]);
  const scopes: [Scope, string][] = [['city', t.city], ['country', t.country], ['world', t.worldScope], ['friends', t.friends]];
  return (
    <div className="screen">
      <StatusBar t={t} save={save} day={day} go={go} />
      <h2>{t.ranking}</h2>
      <div className="pills">
        {BOARDS.map((x, i) => (
          <button key={x.key} className={board === i ? 'on' : ''} onClick={() => setBoard(i)}>
            {modeLabel(t, x.kind)[0]}{x.key.includes(':') ? `, ${t.d[3]}` : ''}
          </button>
        ))}
        <button onClick={() => go('league')}>{t.league}</button>
      </div>
      <div className="seg">
        {scopes.map(([s, l]) => <button key={s} className={scope === s ? 'on' : ''} onClick={() => setScope(s)}>{l}</button>)}
      </div>
      <ol className="board">
        {rows.map((r, i) => (
          <li key={i} className={r.isYou ? 'you' : ''}>
            <span className="pos">{i + 1}</span>
            <span className="who">{r.name}<small>{r.place}</small></span>
            <span className="sc">{r.score}{b.count ? ` ${b.kind === 'expedition' ? '' : t.grids}` : ''}<small>{fmt(r.ms)}</small></span>
          </li>
        ))}
      </ol>
      {ranking.demo && <p className="demo-note">{t.demoBoard}</p>}
    </div>
  );
}

export function League({ t, save, back }: { t: Strings; save: Save; back: () => void }) {
  const rows = leagueRows(save.league.week ?? weekKey(), save.league.tier, save.league.xp, save.name || t.you, weekFraction());
  return (
    <Sub title={`${t.league} ${t.leagueNames[save.league.tier]}`} back={back}>
      <div className="tiers">{t.leagueNames.map((n, i) => <i key={i} title={n} className={i === save.league.tier ? 'on' : i < save.league.tier ? 'past' : ''}>{i + 1}</i>)}</div>
      <p className="muted">{t.leagueSub}</p>
      <p className="small muted"><Icon name="hourglass" size={14} /> {t.leagueEnds} {untilSunday()}</p>
      <ol className="board">
        {rows.map((r, i) => (
          <li key={i} className={`${r.isYou ? 'you' : ''} ${i < PROMOTE ? 'zup' : i >= LEAGUE_SIZE - DEMOTE ? 'zdown' : ''}`}>
            <span className="pos">{i + 1}</span>
            <span className="who">{r.name}</span>
            <span className="sc">{r.xp}<small>{t.xp}</small></span>
          </li>
        ))}
      </ol>
      {ranking.demo && <p className="demo-note">{t.demoBoard}</p>}
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
    <Sub title={t.album} back={back}>
      <p className="muted">{t.albumSub}</p>
      <span className="xpbar wide"><i style={{ width: `${(found.size / phrases.length) * 100}%` }} /></span>
      <div className="pills">
        <button className={!cat ? 'on' : ''} onClick={() => setCat(null)}>{found.size} / {phrases.length}</button>
        {cats.map((c) => {
          const tot = phrases.filter((p) => p.k === c).length;
          const got = phrases.filter((p, i) => p.k === c && found.has(i)).length;
          return <button key={c} className={cat === c ? 'on' : ''} onClick={() => setCat(c)}>{t[`cat_${c}` as 'cat_fact'] ?? c} {got}/{tot}</button>;
        })}
      </div>
      {!found.size && <p className="demo-note">{t.albumEmpty}</p>}
      <div>
        {list.map(({ p, i }) => (
          <div key={i} className={`acard ${found.has(i) ? '' : 'lockedc'}`}>
            <small>{t[`cat_${p.k}` as 'cat_fact'] ?? p.k}</small>
            <p>{found.has(i) ? p.t : p.t.replace(/\p{L}/gu, '·').slice(0, 28)}</p>
          </div>
        ))}
      </div>
    </Sub>
  );
}

export function Profile({ t, save, lang, day, go }: { t: Strings; save: Save; lang: Lang; day: string; go: (s: Screen) => void }) {
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
  const sorted = [...ACHIEVEMENTS].sort((a, b) => Number(have.has(b.id)) - Number(have.has(a.id)));
  return (
    <div className="screen">
      <div className="profile-top">
        <span className="lvbadge">{lp.level}</span>
        <div className="pt">
          <h2>{save.name || t.you}</h2>
          <small>{t.titles[titleIndex(lp.level)]}, {t.league} {t.leagueNames[save.league.tier]}</small>
          <span className="xpbar wide"><i style={{ width: `${(lp.cur / lp.need) * 100}%` }} /></span>
          <small>{lp.cur} / {lp.need} {t.xp}</small>
        </div>
        <button className="iconbtn" onClick={() => go('settings')} aria-label={t.settings}><Icon name="gear" /></button>
      </div>
      <div className="stats">{items.map(([k, v]) => <div key={k}><b>{v}</b><small>{k}</small></div>)}</div>

      <div className="pair">
        <button className="rowlink" onClick={() => go('album')}>
          <span className="rl-icon"><Icon name="book" size={22} /></span>
          <span className="rl-main"><b>{t.album}</b><small>{(save.album[lang] ?? []).length} / {PACKS[lang].phrases.length}</small></span>
        </button>
        <button className="rowlink" onClick={() => go('shop')}>
          <span className="rl-icon"><Icon name="crown" size={22} /></span>
          <span className="rl-main"><b>{SHOP_STRINGS[lang].plusTitle}</b><small>{save.premium ? t.premiumActive : t.premiumTrial}</small></span>
        </button>
      </div>
      <div className="pair">
        <button className="rowlink" onClick={() => go('wardrobe')}>
          <span className="rl-icon loupi-ico"><Loupi bust size={40} /></span>
          <span className="rl-main"><b>{SHOP_STRINGS[lang].wardrobe}</b><small>{save.equip.title === 'elf' ? SHOP_STRINGS[lang].title : SHOP_STRINGS[lang].shop}</small></span>
        </button>
        <button className="rowlink" onClick={() => go('archive')}>
          <span className="rl-icon"><Icon name="calendar" size={22} /></span>
          <span className="rl-main"><b>{SHOP_STRINGS[lang].archives}</b><small>{save.premium ? '60' : SHOP_STRINGS[lang].plusTitle}</small></span>
        </button>
      </div>

      {recs.length > 0 && (
        <section className="sec">
          <h3>{t.record}</h3>
          <div className="panel records">
            {recs.map(([k, r]) => {
              const [kind, d] = k.split(':');
              return (
                <div key={k}>
                  <Icon name={MODE_ICON[kind] ?? 'target'} size={18} />
                  <span>{modeLabel(t, kind as ModeKind)[0]}{d ? `, ${t.d[Number(d)]}` : ''}</span>
                  <b>{r.best > 0 ? `${r.best}${kind === 'marathon' ? ` ${t.grids}` : ''}` : '–'}</b>
                  <small>{r.wins}/{r.played}</small>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <section className="sec">
        <div className="sechead"><h3>{t.achievements}</h3><span className="aside">{have.size} / {ACHIEVEMENTS.length}</span></div>
        <div className="achs">
          {sorted.map((a) => (
            <div key={a.id} className={`ach ${have.has(a.id) ? 'got' : ''}`}>
              <span className="disc"><Icon name={achIcon(a.id)} size={22} /></span>
              <b>{t.achs[a.id]?.[0]}</b>
              <small>{t.achs[a.id]?.[1]}</small>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

export function Settings({ t, save, setSave, back }: { t: Strings; save: Save; setSave: SetSave; back: () => void }) {
  const [confirm, setConfirm] = useState(false);
  const toggle = (k: 'sound' | 'haptics') => setSave((s) => ({ ...s, settings: { ...s.settings, [k]: !s.settings[k] } }));
  return (
    <Sub title={t.settings} back={back}>
      <label className="field">{t.language}
        <select value={save.lang ?? 'en'} onChange={(e) => setSave((s) => ({ ...s, lang: e.target.value as Lang }))}>
          {LANGS.map((l) => <option key={l.code} value={l.code}>{l.name}</option>)}
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
      <button className="toggle" onClick={() => toggle('sound')} role="switch" aria-checked={save.settings.sound}>
        <span><Icon name="sound" />{t.sound}</span><i className={`switch ${save.settings.sound ? 'on' : ''}`} />
      </button>
      <button className="toggle" onClick={() => toggle('haptics')} role="switch" aria-checked={save.settings.haptics}>
        <span><Icon name="vibrate" />{t.haptics}</span><i className={`switch ${save.settings.haptics ? 'on' : ''}`} />
      </button>
      <button className="btn danger block" onClick={() => {
        if (!confirm) return setConfirm(true);
        setSave((s) => ({ ...emptySave(), lang: s.lang, name: s.name, city: s.city, country: s.country, premium: s.premium, tutorialDone: true }));
        setConfirm(false);
      }}>{confirm ? t.resetConfirm : t.reset}</button>
    </Sub>
  );
}

export function Premium({ t, save, setSave, back }: { t: Strings; save: Save; setSave: SetSave; back: () => void }) {
  const buy = async (plan: 'monthly' | 'yearly') => {
    if (await billing.purchase(plan)) {
      sfx.unlock();
      setSave((s) => ({ ...s, premium: true }));
    }
  };
  return (
    <Sub title={t.premiumTitle} back={back}>
      <ul className="perks">
        {[...t.premiumPerks, `${t.premiumTrack} : ${t.season}`].map((p) => <li key={p}><Icon name="check" />{p}</li>)}
      </ul>
      {save.premium ? (
        <p className="demo-note">{t.premiumActive}</p>
      ) : (
        <>
          <button className="btn primary lg block stack" onClick={() => buy('yearly')}>{t.premiumYearly}<small>{t.premiumTrial}</small></button>
          <button className="btn block" onClick={() => buy('monthly')}>{t.premiumMonthly}</button>
        </>
      )}
      <p className="demo-note">{t.premiumNote}</p>
    </Sub>
  );
}
