import { useState } from 'react';
import type { Lang } from '../engine/types';
import type { Strings } from '../i18n';
import type { Save } from '../storage';
import { STORY } from '../content/story';
import { CHAPTERS, LEVELS_PER_CHAPTER, levelInfo } from '../chapters';
import { levelMode, type Mode } from '../modes';
import { RELICS, type RelicId, type Run, type Floor, floorName, START_HEARTS } from '../expedition';
import { Icon } from './Icon';
import { sfx } from '../sound';
import { Scene, type SceneKind } from './scenes';

const fill = (s: string, n: number | string) => s.replace('{n}', String(n));
const roman = (n: number) => ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'][n] ?? String(n + 1);

export const RELIC_ICON: Record<RelicId, string> = {
  heart: 'heartFill',
  hourglass: 'hourglass',
  lantern: 'lantern',
  quill: 'quill',
  inkwell: 'inkwell',
  compass: 'compass',
  prism: 'prism',
  seal: 'seal',
};

export const MOD_ICON: Record<string, string> = {
  ink: 'eye',
  fog: 'fog',
  chain: 'chain',
  smudge: 'smudge',
  timer: 'hourglass',
  cryptic: 'brain',
  bare: 'target',
  cipher: 'key',
};

/** Niveau atteint dans l'aventure pour une langue. */
export function campaignLevel(save: Save, lang: Lang): number {
  return save.campaign[lang]?.level ?? 1;
}

export function themeOf(level: number): string {
  return CHAPTERS[levelInfo(level).chapter].theme;
}

function Trail({ t, save, lang, chapterAbs, onStart }: { t: Strings; save: Save; lang: Lang; chapterAbs: number; onStart: (m: Mode) => void }) {
  const camp = save.campaign[lang] ?? { level: 1, stars: {} };
  const reached = camp.level;
  return (
    <div className="trail">
      {Array.from({ length: LEVELS_PER_CHAPTER }, (_, i) => {
        const n = chapterAbs * LEVELS_PER_CHAPTER + i + 1;
        const info = levelInfo(n);
        const st = camp.stars[n] ?? 0;
        return (
          <button key={n} className={`stop ${n === reached ? 'cur' : ''} ${st ? 'cleared' : ''} ${info.boss ? 'boss' : ''}`} disabled={n > reached} onClick={() => onStart(levelMode(n))} aria-label={`${t.level} ${n}`}>
            {info.finale ? <Icon name="key" size={19} /> : info.boss ? <Icon name="crown" size={19} /> : n > reached ? <Icon name="lock" size={15} /> : i + 1}
            <span className="st">{Array.from({ length: st }, (_, k) => <Icon key={k} name="starFill" size={8} />)}</span>
          </button>
        );
      })}
    </div>
  );
}

/** Carte de l'aventure sur l'accueil : le chapitre en cours. */
export function AdventureCard({ t, save, lang, onStart, open }: { t: Strings; save: Save; lang: Lang; onStart: (m: Mode) => void; open: () => void }) {
  const level = campaignLevel(save, lang);
  const info = levelInfo(level);
  const story = STORY[lang];
  const ch = story.chapters[info.chapter];
  const chapterAbs = Math.floor((level - 1) / LEVELS_PER_CHAPTER);
  return (
    <section className="sec">
      <div className="sechead">
        <h3>{story.title}</h3>
        <button className="aside" onClick={open}>{t.chapters}</button>
      </div>
      <div className={`chapcard theme-${info.def.theme}`}>
        <Scene kind={info.def.theme as SceneKind} />
        <button className="ct" onClick={open} style={{ textAlign: 'left' }}>
          <span className="disc"><Icon name={info.def.icon} size={22} /></span>
          <span>
            <small>{fill(t.chapterN, info.chapter + 1)} / {CHAPTERS.length}{info.cycle > 0 ? `, ${story.cycle} ${roman(info.cycle)}` : ''}</small>
            <b>{ch.name}</b>
          </span>
        </button>
        <p className="intro-txt">{ch.intro}</p>
        <Trail t={t} save={save} lang={lang} chapterAbs={chapterAbs} onStart={onStart} />
        <button className="btn primary block stack" onClick={() => onStart(levelMode(level))}>
          <span style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
            {info.finale ? <Icon name="key" size={18} /> : info.boss ? <Icon name="crown" size={18} /> : null}
            {info.finale ? t.finaleLabel : info.boss ? t.boss : `${t.level} ${info.step + 1}`}
          </span>
          <small>{t.d[info.d]}</small>
        </button>
      </div>
    </section>
  );
}

/** Écran de l'aventure : tous les chapitres, leur récit et leurs niveaux. */
export function AdventureScreen({ t, save, lang, onStart, back }: { t: Strings; save: Save; lang: Lang; onStart: (m: Mode) => void; back: () => void }) {
  const level = campaignLevel(save, lang);
  const curAbs = Math.floor((level - 1) / LEVELS_PER_CHAPTER);
  const [sel, setSel] = useState(curAbs);
  const story = STORY[lang];
  const shownCycle = Math.floor(sel / CHAPTERS.length);
  const info = levelInfo(sel * LEVELS_PER_CHAPTER + 1);
  const ch = story.chapters[info.chapter];
  const done = sel < curAbs;
  return (
    <div>
      <header className="subhead">
        <button className="iconbtn" onClick={back} aria-label={t.back}><Icon name="back" /></button>
        <h2>{story.title}</h2>
      </header>
      <div className="screen" style={{ paddingTop: 6 }}>
        <p className="muted">{story.prologue}</p>
        <div className={`chapcard theme-${info.def.theme}`}>
          <Scene kind={info.def.theme as SceneKind} />
          <div className="ct">
            <span className="disc"><Icon name={info.def.icon} size={22} /></span>
            <span>
              <small>{fill(t.chapterN, info.chapter + 1)}{shownCycle > 0 ? `, ${story.cycle} ${roman(shownCycle)}` : ''}</small>
              <b>{ch.name}</b>
            </span>
          </div>
          <p className="intro-txt">{ch.intro}</p>
          <div className="twist"><Icon name="sparkle" size={18} /><span><b>{t.twistLabel}</b>{ch.twist}</span></div>
          {done && <p className="quote">{ch.phrase}</p>}
          {done && <p className="intro-txt">{ch.outro}</p>}
          <Trail t={t} save={save} lang={lang} chapterAbs={sel} onStart={onStart} />
        </div>
        <section className="sec">
          <h3>{t.chapters}</h3>
          <div className="chaplist">
            {Array.from({ length: Math.max(CHAPTERS.length, curAbs + 1) }, (_, abs) => {
              const c = abs % CHAPTERS.length;
              const cyc = Math.floor(abs / CHAPTERS.length);
              const locked = abs > curAbs;
              const stars = Array.from({ length: LEVELS_PER_CHAPTER }, (_, i) => save.campaign[lang]?.stars[abs * LEVELS_PER_CHAPTER + i + 1] ?? 0).reduce((a, b) => a + b, 0);
              return (
                <button key={abs} className={`chaprow ${locked ? 'locked' : ''} ${abs === sel ? 'on' : ''}`} disabled={locked} onClick={() => { sfx.tap(); setSel(abs); }}>
                  <span className="disc"><Icon name={locked ? 'lock' : CHAPTERS[c].icon} size={20} /></span>
                  <span>
                    <b>{story.chapters[c].name}</b>
                    <small>{locked ? t.lockedChapter : `${fill(t.chapterN, c + 1)}${cyc ? `, ${story.cycle} ${roman(cyc)}` : ''}`}</small>
                  </span>
                  <small>{locked ? '' : `${stars}/${LEVELS_PER_CHAPTER * 3}`}</small>
                </button>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}

/** Ouverture d'un chapitre, avant son premier niveau. */
export function ChapterIntro({ t, lang, chapter, cycle, onBegin }: { t: Strings; lang: Lang; chapter: number; cycle: number; onBegin: () => void }) {
  const story = STORY[lang];
  const ch = story.chapters[chapter];
  return (
    <div className="modal center">
      <div className={`sheet chapter theme-${CHAPTERS[chapter].theme}`}>
        <Scene kind={CHAPTERS[chapter].theme as SceneKind} />
        <span className="seal run"><Icon name={CHAPTERS[chapter].icon} size={32} /></span>
        <p className="chapnum">{fill(t.chapterN, chapter + 1)}{cycle ? `, ${story.cycle} ${roman(cycle)}` : ''}</p>
        <h2>{ch.name}</h2>
        {chapter === 0 && cycle === 0 && <p className="lead">{story.prologue}</p>}
        <p className="story">{ch.intro}</p>
        <div className="twist"><Icon name="sparkle" size={18} /><span><b>{t.twistLabel}</b>{ch.twist}</span></div>
        <button className="btn primary lg block" onClick={onBegin}>{t.begin}</button>
      </div>
    </div>
  );
}

// ---------------- Expédition ----------------

export function ExpeditionCard({ t, save, lang, day, onDaily, onFree }: { t: Strings; save: Save; lang: Lang; day: string; onDaily: () => void; onFree: () => void }) {
  const best = save.records[lang]?.expedition?.best ?? 0;
  const today = save.expDaily[`${lang}:${day}`];
  return (
    <section className="expcard">
      <Scene kind="expedition" />
      <h3><Icon name="flag" size={22} />{t.expedition}</h3>
      <p>{t.expeditionSub}</p>
      <div className="depthline">
        <span>{t.bestDepth} <b>{best}</b></span>
        {today !== undefined && <span>{t.expDaily} <b>{today}</b></span>}
      </div>
      <div className="row">
        <button className="btn primary" disabled={today !== undefined} onClick={onDaily}>{today !== undefined ? t.expDone : t.expDaily}</button>
        <button className="btn" onClick={onFree}>{t.expFree}</button>
      </div>
      <p className="small">{t.expDailySub}</p>
    </section>
  );
}

export function RunBar({ t, run }: { t: Strings; run: Run }) {
  return (
    <div className="runbar">
      <span>{fill(t.floorN, run.depth + 1)}</span>
      <span className="hearts" aria-label={`${t.hearts} ${run.hearts}`}>{Array.from({ length: run.hearts }, (_, i) => <Icon key={i} name="heartFill" size={14} />)}</span>
      {run.relics.length > 0 && <span className="relicicons">{run.relics.map((r, i) => <Icon key={i} name={RELIC_ICON[r]} size={15} />)}</span>}
    </div>
  );
}

export function RelicPicker({ t, lang, run, offer, next, onPick }: { t: Strings; lang: Lang; run: Run; offer: RelicId[]; next: Floor; onPick: (r: RelicId) => void }) {
  return (
    <div className="modal">
      <div className="sheet">
        <span className="seal win"><Icon name="flag" size={30} /></span>
        <h2>{t.chooseRelic}</h2>
        <RunBar t={t} run={run} />
        <div className="relics">
          {offer.map((r) => {
            const [name, desc] = t[`r_${r}` as 'r_heart'] as string[];
            return (
              <button key={r} className="relic" onClick={() => { sfx.unlock(); onPick(r); }}>
                <span className="disc"><Icon name={RELIC_ICON[r]} size={22} /></span>
                <b>{name}</b>
                <small>{desc}</small>
              </button>
            );
          })}
        </div>
        <div className="twist">
          <Icon name="flag" size={18} />
          <span>
            <b>{fill(t.floorN, next.depth + 1)}, {floorName(lang, next)}</b>
            {next.mods.length ? next.mods.map((m) => t[`m_${m}` as 'm_ink']).join(', ') : t.sanctuary}
          </span>
        </div>
      </div>
    </div>
  );
}

export { RELICS, START_HEARTS };
