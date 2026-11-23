import { useEffect, useMemo, useRef, useState } from 'react';
import type { Puzzle } from '../engine/types';
import {
  initGame, select, typeLetter, erase, revealSelected, revealWord, codeAt, isCorrect, isWrong,
  wordSolved, progress, usedLetters, computeScore, stars, oracleSearch, wordPattern, failGame,
  livesLeft, isOver, addShield, revealPhraseLetters, selFor, type GameState, type Sel,
} from '../engine/game';
import { KEYBOARDS, type Strings } from '../i18n';
import { PACKS } from '../content';
import { COST } from '../services/monetization';
import type { Rules } from '../modes';
import { FREEZE_MS, REVEAL_N, type BoosterId } from '../meta';
import { sfx } from '../sound';
import { Loupi } from './mascot';
import { Icon, BOOSTER_ICON } from './Icon';

export interface FinishInfo {
  score: number;
  stars: 1 | 2 | 3;
  ms: number;
  mistakes: number;
  hints: number;
  remainingMs: number | null;
  maxCombo: number;
  words: number;
  /** Journal des coups, envoyé au serveur pour les parties classées. */
  log: [number, number, string][];
}

export interface Perks {
  shield: number;
  reveal: number;
  freeLetters: number;
}

interface Props {
  puzzle: Puzzle;
  palette?: React.CSSProperties;
  chips?: { icon: string; label: string }[];
  perks?: Perks;
  title: string;
  subtitle: string[];
  t: Strings;
  tokens: number;
  premium: boolean;
  rules: Rules;
  deadline: number | null;
  boosters: Record<BoosterId, number>;
  useBooster: (id: BoosterId) => boolean;
  onFreeze: (ms: number) => void;
  spend: (n: number) => boolean;
  onNeedTokens: () => void;
  onFinish: (info: FinishInfo) => void;
  onFail: (reason: 'time' | 'mistakes', info: FinishInfo) => void;
  onMistake?: () => void;
  onExit: () => void;
  overlay: React.ReactNode;
  showTutorial: boolean;
  onTutorialDone: () => void;
  /** Jeu à plusieurs : bandeau des rivaux sous la jauge. */
  rivals?: React.ReactNode;
  /** Jeu à plusieurs : bouton ajouté au-dessus du clavier (pièges, aide). */
  dockExtra?: React.ReactNode;
  /** Coop : propriétaire de chaque indice ; null si c'est le sien. */
  clueOwner?: (wi: number) => { name: string; color: string } | null;
  /** Piège « tache d'encre » : indices masqués. */
  blotted?: number[];
  /** Piège « clavier gelé ». */
  keysLocked?: boolean;
  /** Chaque frappe est transmise (au serveur de la salle). */
  onMove?: (code: number, letter: string) => void;
  /** Coop : frappes des coéquipiers à appliquer, numérotées. */
  incoming?: { n: number; code: number; letter: string; color: string }[];
}

export function fmt(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export function Play(props: Props) {
  const { puzzle, title, subtitle, t, tokens, premium, rules, deadline, boosters, useBooster, onFreeze, spend, onNeedTokens, onFinish, onFail, onMistake, onExit, overlay } = props;
  const perks = props.perks;
  const start = () => {
    let s0 = initGame(puzzle, Date.now(), rules.lives);
    if (perks?.shield) s0 = addShield(s0, perks.shield);
    if (perks?.reveal) s0 = { ...revealPhraseLetters(s0, perks.reveal), hints: 0 };
    return s0;
  };
  const [g, setG] = useState<GameState>(start);
  const [freeLeft, setFreeLeft] = useState(perks?.freeLetters ?? 0);
  const [now, setNow] = useState(Date.now());
  const [oracle, setOracle] = useState<{ pattern: string; results: string[]; empty?: boolean } | null>(null);
  const [shake, setShake] = useState(false);
  const [flashWord, setFlashWord] = useState<number | null>(null);
  const [tuto, setTuto] = useState(props.showTutorial ? 0 : -1);
  const [frozen, setFrozen] = useState<{ until: number; shown: number } | null>(null);
  const [bump, setBump] = useState(0);
  const reported = useRef<string | null>(null);
  /** Coop : couleur du coéquipier qui a posé chaque lettre. */
  const [marks, setMarks] = useState<Record<number, string>>({});
  const applied = useRef(0);

  useEffect(() => {
    const fresh = (props.incoming ?? []).filter((m) => m.n > applied.current);
    if (!fresh.length) return;
    applied.current = fresh[fresh.length - 1].n;
    setG((s) => {
      let cur = s;
      for (const m of fresh) {
        const keep = cur.sel;
        const target = selFor(cur.puzzle, m.code);
        if (!target) continue;
        cur = { ...typeLetter(select(cur, target), m.letter), sel: keep };
      }
      return cur;
    });
    setMarks((mk) => ({ ...mk, ...Object.fromEntries(fresh.map((m) => [m.code, m.color])) }));
  }, [props.incoming]);

  useEffect(() => {
    if (location.search.includes('qa')) (window as unknown as { __lexi: () => Puzzle }).__lexi = () => puzzle;
  }, [puzzle]);

  // Une horloge à la seconde suffit à l'affichage ; on passe au quart de seconde dans les quinze dernières secondes
  // d'un chrono, pour le décompte sonore. Avant, l'écran entier se redessinait cinq fois par seconde.
  const lastSeconds = deadline !== null && deadline - now < 16000;
  useEffect(() => {
    if (isOver(g)) return;
    const id = setInterval(() => setNow(Date.now()), lastSeconds ? 250 : 1000);
    return () => clearInterval(id);
  }, [g.finished, g.failed, lastSeconds]); // eslint-disable-line react-hooks/exhaustive-deps

  const isFrozen = frozen !== null && now < frozen.until;
  const remaining = deadline !== null ? deadline - (isOver(g) ? g.startedAt + g.elapsedMs : now) : null;

  useEffect(() => {
    if (remaining !== null && remaining <= 0 && !isOver(g) && tuto < 0) setG((s) => failGame(s, 'time'));
  }, [remaining, g, tuto]);

  const lastTick = useRef(-1);
  const endTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => {
    if (remaining === null || isOver(g) || isFrozen) return;
    const sec = Math.ceil(remaining / 1000);
    if (sec <= 10 && sec > 0 && sec !== lastTick.current) {
      lastTick.current = sec;
      sfx.tick(sec <= 5);
    }
  }, [remaining, g, isFrozen]);

  useEffect(() => {
    const key = puzzle.id + g.startedAt;
    if (reported.current === key) return;
    const info = (): FinishInfo => ({
      score: computeScore(g),
      stars: stars(g),
      ms: g.elapsedMs,
      mistakes: g.mistakes,
      hints: g.hints + g.oracle,
      remainingMs: deadline !== null ? Math.max(0, deadline - (g.startedAt + g.elapsedMs)) : null,
      maxCombo: g.maxCombo,
      words: puzzle.words.filter((_, i) => wordSolved(g, i)).length,
      log: g.log,
    });
    if (g.finished) {
      reported.current = key;
      sfx.win();
      // La phrase s'illumine avant l'écran de résultat.
      endTimer.current = setTimeout(() => onFinish(info()), 900);
    } else if (g.failed && g.failReason) {
      reported.current = key;
      sfx.fail();
      endTimer.current = setTimeout(() => onFail(g.failReason!, info()), 500);
    }
  }, [g, puzzle, onFinish, onFail, deadline]);
  // Quitter la partie pendant l'illumination finale ne doit pas ouvrir l'écran de résultat.
  useEffect(() => () => clearTimeout(endTimer.current), []);

  // Exemple du tutoriel : un vrai mot de la grille où un numéro revient, et seule cette lettre est dévoilée,
  // pour montrer que le même numéro cache toujours la même lettre.
  const tutoExample = useMemo(() => {
    const words = puzzle.words.filter((w) => w.answer.length <= 8);
    const withRepeat = words.find((w) => new Set(w.codes).size < w.codes.length) ?? words[0] ?? puzzle.words[0];
    const codes = withRepeat?.codes ?? [];
    const shown = codes.find((c, i) => codes.indexOf(c) !== i) ?? codes[0];
    return { letters: [...(withRepeat?.answer ?? '')], codes, shown };
  }, [puzzle]);

  const selCode = g.sel ? codeAt(puzzle, g.sel) : null;
  const selWord = g.sel?.kind === 'word' ? g.sel.w : null;
  const used = useMemo(() => usedLetters(g), [g]);
  const lexicon = useMemo(() => PACKS[puzzle.lang].entries.map((e) => e.w), [puzzle.lang]);

  const press = (l: string) => {
    if (tuto >= 0 || props.keysLocked) return;
    sfx.key();
    const mc = g.sel ? codeAt(puzzle, g.sel) : null;
    if (props.onMove && mc !== null && !isOver(g)) props.onMove(mc, l);
    setG((s) => {
      const next = typeLetter(s, l);
      if (next.mistakes > s.mistakes) {
        setShake(true);
        setTimeout(() => setShake(false), 340);
        sfx.bad();
        onMistake?.();
      } else if (next.shield < s.shield) {
        sfx.booster();
      } else if (next.combo > s.combo) {
        const solvedNow = s.puzzle.words.findIndex((_, i) => !wordSolved(s, i) && wordSolved(next, i));
        if (solvedNow >= 0) {
          sfx.word(next.combo);
          setFlashWord(solvedNow);
          setTimeout(() => setFlashWord(null), 600);
        } else sfx.good(next.combo);
        if (next.combo % 10 === 0) sfx.combo();
        setBump((b) => b + 1);
      }
      return next;
    });
  };

  // Écouteur posé une seule fois ; il lit la dernière version de press par une référence.
  const pressRef = useRef(press);
  pressRef.current = press;
  const oracleRef = useRef(oracle);
  oracleRef.current = oracle;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (oracleRef.current || e.metaKey || e.ctrlKey) return;
      const k = e.key.toUpperCase();
      if (/^[A-Z]$/.test(k)) pressRef.current(k);
      else if (e.key === 'Backspace') setG((s) => erase(s));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const price = (n: number) => (rules.cheapHints ? Math.ceil(n / 2) : n);
  const pay = (n: number): boolean => {
    if (premium) return true;
    const p = price(n);
    if (tokens < p) {
      onNeedTokens();
      return false;
    }
    sfx.coin();
    return spend(p);
  };

  const nextWord = () => selWord ?? g.puzzle.words.findIndex((_, i) => !wordSolved(g, i));
  const hintLetter = () => {
    if (isOver(g)) return;
    if (freeLeft > 0) {
      setFreeLeft(freeLeft - 1);
      sfx.booster();
      setG((s) => revealSelected(s));
      return;
    }
    if (pay(COST.letter)) setG((s) => revealSelected(s));
  };
  const hintWord = () => {
    const w = nextWord();
    if (isOver(g) || w < 0 || wordSolved(g, w)) return;
    if (pay(COST.word)) setG((s) => revealWord(s, w));
  };
  const openOracle = () => {
    const w = nextWord();
    if (isOver(g) || w < 0) return;
    const pattern = wordPattern(g, w);
    if (!/[A-Z]/.test(pattern)) return setOracle({ pattern, results: [], empty: true });
    if (!pay(COST.oracle)) return;
    setG((s) => ({ ...s, oracle: s.oracle + 1 }));
    setOracle({ pattern, results: oracleSearch(pattern, lexicon) });
  };

  const boost = (id: BoosterId) => {
    if (isOver(g) || !useBooster(id)) return;
    sfx.booster();
    if (id === 'freeze' && remaining !== null) {
      setFrozen({ until: Date.now() + FREEZE_MS, shown: remaining });
      onFreeze(FREEZE_MS);
    } else if (id === 'shield') setG((s) => addShield(s));
    else if (id === 'reveal') setG((s) => revealPhraseLetters(s, REVEAL_N));
  };

  const elapsed = isOver(g) ? g.elapsedMs : Math.max(0, now - g.startedAt);
  const pct = Math.round(progress(g) * 100);
  const lives = livesLeft(g);
  const shownRemaining = isFrozen ? frozen!.shown : remaining;
  const urgent = shownRemaining !== null && shownRemaining < 15_000 && !isOver(g) && !isFrozen;
  const timePct = shownRemaining !== null ? Math.max(0, Math.min(100, (shownRemaining / (rules.timeMs ?? 1)) * 100)) : 0;

  const groups: number[][] = [];
  let cur: number[] = [];
  puzzle.phrase.forEach((c, i) => {
    if (c.kind === 'sep' && c.ch === ' ') {
      if (cur.length) groups.push(cur);
      cur = [];
    } else cur.push(i);
  });
  if (cur.length) groups.push(cur);

  const cellClass = (code: number, isSel: boolean, solvedWord = false) => {
    const cls = ['cell'];
    if (isSel) cls.push('sel');
    else if (selCode === code) cls.push('same');
    if (puzzle.given.includes(code)) cls.push('given');
    if (isWrong(g, code)) cls.push('wrong');
    if (solvedWord) cls.push('ok');
    if (marks[code]) cls.push('mate');
    return cls.join(' ');
  };

  const canFreeze = remaining !== null && !isFrozen;
  // Le mot le plus long doit tenir sur la largeur de l'écran.
  const longest = Math.max(...groups.map((gr) => gr.length));
  const avail = Math.min(window.innerWidth, 520) - 28;
  const base = puzzle.cryptogram ? 34 : 30;
  const cw = Math.max(20, Math.min(base, Math.floor((avail - (longest - 1) * 3) / longest)));
  const showBoosters = rules.boosters && !isOver(g);
  let li = 0;

  return (
    <div className={`play ${urgent ? 'urgent' : ''} ${props.palette ? 'themed' : ''}`} style={props.palette}>
      <header className="playbar">
        <button className="iconbtn" onClick={onExit} aria-label={t.back}><Icon name="back" /></button>
        <div className="ttl">
          <div className="t1">{title}</div>
          <div className="t2">{subtitle.join(', ')}</div>
        </div>
        <div className="counters">
          {shownRemaining !== null ? (
            <span className={`counter timer ${urgent ? 'hot' : ''} ${isFrozen ? 'frozen' : ''}`}><Icon name={isFrozen ? 'snow' : 'hourglass'} size={16} />{fmt(shownRemaining)}</span>
          ) : (
            <span className="counter timer"><Icon name="clock" size={16} />{fmt(elapsed)}</span>
          )}
          {lives !== null && (
            <span className="counter lives" aria-label={`${t.lives} ${lives}`}>
              {Array.from({ length: rules.lives ?? 0 }, (_, i) => <Icon key={i} name={i < lives ? 'heartFill' : 'heart'} size={15} className={i < lives ? '' : 'lost'} />)}
            </span>
          )}
          {!rules.noHints && <span className="counter gold"><Icon name="token" size={16} />{premium ? '∞' : tokens}</span>}
        </div>
      </header>
      {shownRemaining !== null ? (
        <div className={`gauge time ${urgent ? 'hot' : ''}`}><i style={{ width: `${timePct}%` }} /></div>
      ) : (
        <div className="gauge"><i style={{ width: `${pct}%` }} /></div>
      )}

      {props.rivals}

      {props.chips && props.chips.length > 0 && (
        <div className="modchips">{props.chips.map((c) => <span key={c.label}><Icon name={c.icon} size={13} />{c.label}</span>)}</div>
      )}

      {puzzle.cryptogram && g.mistakes === 0 && pct < 40 && (
        <p className="cryptotip"><Icon name="key" size={18} />{t.cryptoTip}</p>
      )}

      <section className={`phrase ${shake ? 'shake' : ''} ${puzzle.cryptogram ? 'crypto' : ''} ${g.finished ? 'won' : ''}`} style={{ '--cw': `${cw}px`, '--cg': cw < 26 ? '2px' : '3px' } as React.CSSProperties}>
        {groups.map((grp, gi) => (
          <div className="pgroup" key={gi}>
            {grp.map((i) => {
              const c = puzzle.phrase[i];
              if (c.kind === 'sep') return <span className="psep" key={i}>{c.ch}</span>;
              const sel: Sel = { kind: 'phrase', i };
              const isSel = g.sel?.kind === 'phrase' && g.sel.i === i;
              const good = isCorrect(g, c.code);
              const idx = li++;
              const fogged = !!puzzle.mods?.fog && !good && !puzzle.given.includes(c.code);
              return (
                <button
                  key={i}
                  style={{ '--i': idx, '--mate': marks[c.code] } as React.CSSProperties}
                  className={cellClass(c.code, isSel) + (good ? ' good' : '') + (g.failed && !good ? ' reveal' : '') + (fogged && !g.failed ? ' fogged' : '')}
                  onClick={() => { sfx.tap(); setG((s) => select(s, sel)); }}
                  aria-label={`${c.code}`}
                >
                  <span className="l">{good || g.failed ? c.shown : g.guesses[c.code] ?? ''}</span>
                  <span className="n">{c.code}</span>
                </button>
              );
            })}
          </div>
        ))}
      </section>

      <div className="meter" aria-live="polite">
        <Loupi bust size={44} className="buddy" mood={g.finished ? 'happy' : shake ? 'sad' : g.combo >= 5 ? 'wow' : g.combo >= 3 ? 'think' : 'idle'} />
        {g.combo >= 3 && (
          <span className={`combo ${bump % 2 ? 'bump' : ''}`} key={bump}>
            <Icon name="combo" size={18} /> {t.combo} {g.combo}
            <span className="cbar"><i style={{ width: `${(g.combo % 10) * 10}%` }} /></span>
          </span>
        )}
        {g.shield > 0 && <span className="state"><Icon name="shield" size={15} />{t.shieldOn}</span>}
        {isFrozen && <span className="state"><Icon name="snow" size={15} />{t.frozen}</span>}
      </div>

      {!puzzle.cryptogram && (
        <section className="words">
          {puzzle.words.map((w, wi) => {
            const solved = wordSolved(g, wi);
            const sealed = !!puzzle.mods?.chain && wi > 0 && !solved && !wordSolved(g, wi - 1) && !g.failed;
            const owner = !solved && !g.failed ? props.clueOwner?.(wi) ?? null : null;
            const blot = !solved && !!props.blotted?.includes(wi);
            return (
              <div key={wi} className={`wrow ${selWord === wi ? 'active' : ''} ${solved ? 'done' : ''} ${flashWord === wi ? 'pop' : ''} ${sealed ? 'sealed' : ''} ${blot ? 'blot' : ''}`}>
                <div className="clue">
                  {sealed ? (
                    <span className="sealedclue"><Icon name="lock" size={14} />{t.chainLocked}</span>
                  ) : owner ? (
                    <span className="mateclue" style={{ '--mate': owner.color } as React.CSSProperties}><i />{owner.name}</span>
                  ) : blot ? (
                    <span className="blotclue"><Icon name="inkwell" size={16} /></span>
                  ) : (
                    <>
                      {w.shown ?? w.clue}
                      {w.tier === 3 && <span className="tierbadge">{t.tierHard}</span>}
                    </>
                  )}
                </div>
                <div className="wcells">
                  {w.codes.map((code, ci) => {
                    const sel: Sel = { kind: 'word', w: wi, i: ci };
                    const isSel = g.sel?.kind === 'word' && g.sel.w === wi && g.sel.i === ci;
                    const inked = !!puzzle.mods?.ink?.includes(code) && !isCorrect(g, code) && !g.failed;
                    return (
                      <button key={ci} style={{ '--j': ci, '--mate': marks[code] } as React.CSSProperties} className={cellClass(code, isSel, solved) + (inked ? ' inked' : '')} onClick={() => { sfx.tap(); setG((s) => select(s, sel)); }}>
                        <span className="l">{g.failed ? w.answer[ci] : g.guesses[code] ?? ''}</span>
                        <span className="n">{inked ? '?' : code}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </section>
      )}

      {!isOver(g) && (
        <footer className={`dock ${props.keysLocked ? 'iced' : ''}`}>
          {props.dockExtra}
          {props.dockExtra ? null : rules.noHints ? (
            <p className="nohints"><Icon name="lock" size={15} />{t.hintsOff}</p>
          ) : (
            <div className={`tools ${showBoosters ? 'compact' : ''}`}>
              <button className="tool" onClick={hintLetter}><Icon name="bulb" size={17} />{t.hint}{freeLeft > 0 ? <small>{t.free} x{freeLeft}</small> : !premium && <small><Icon name="token" size={12} />{price(COST.letter)}</small>}</button>
              {!puzzle.cryptogram && <button className="tool" onClick={openOracle}><Icon name="search" size={17} />{t.oracle}{!premium && <small><Icon name="token" size={12} />{price(COST.oracle)}</small>}</button>}
              {!puzzle.cryptogram && <button className="tool" onClick={hintWord}><Icon name="sparkle" size={17} />{t.hintWord}{!premium && <small><Icon name="token" size={12} />{price(COST.word)}</small>}</button>}
              {showBoosters && (['freeze', 'shield', 'reveal'] as BoosterId[]).map((id) => (
                <button
                  key={id}
                  className={`tool boost ${(id === 'shield' && g.shield > 0) || (id === 'freeze' && isFrozen) ? 'active' : ''}`}
                  disabled={!boosters[id] || (id === 'freeze' && !canFreeze)}
                  onClick={() => boost(id)}
                  aria-label={(t[`b_${id}` as 'b_freeze'] as string[])[0]}
                  title={(t[`b_${id}` as 'b_freeze'] as string[])[1]}
                >
                  <Icon name={BOOSTER_ICON[id]} size={18} />
                  {boosters[id] > 0 && <em>{boosters[id]}</em>}
                </button>
              ))}
            </div>
          )}
          <div className="kb">
            {KEYBOARDS[puzzle.lang].map((row, ri) => (
              <div className="kbrow" key={ri}>
                {[...row].map((k) => (
                  <button key={k} className={`key ${used.has(k) ? 'used' : ''}`} onClick={() => press(k)}>{k}</button>
                ))}
                {ri === 2 && <button className="key wide" onClick={() => setG((s) => erase(s))} aria-label={t.erase}><Icon name="erase" /></button>}
              </div>
            ))}
          </div>
        </footer>
      )}

      {oracle && (
        <div className="modal" onClick={() => setOracle(null)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <h2>{t.oracleTitle}</h2>
            <p className="lead">{t.oracleSub}</p>
            <div className="pattern">
              {[...oracle.pattern].map((c, i) => (
                <span key={i} className={`cell ${c === '_' ? '' : 'good'}`}><span className="l">{c === '_' ? '' : c}</span></span>
              ))}
            </div>
            {oracle.empty ? (
              <p className="lead">{t.oracleNeedLetter}</p>
            ) : oracle.results.length ? (
              <div className="results">{oracle.results.map((r) => <span key={r}>{r}</span>)}</div>
            ) : (
              <p className="lead">{t.oracleNone}</p>
            )}
            <button className="btn primary block" onClick={() => setOracle(null)}>OK</button>
          </div>
        </div>
      )}

      {tuto >= 0 && (
        <div className="modal center">
          <div className="sheet tuto">
            <Loupi mood="think" size={96} className="pop-in tuto-loupi" />
            <div className="tutostep">{t.tutorial.map((_, i) => <i key={i} className={i <= tuto ? 'on' : ''} />)}</div>
            <div className="tutodemo">
              {tuto === 0 && (
                <div className="wcells">
                  {tutoExample.letters.map((l, i) => (
                    <span className={`cell ${tutoExample.codes[i] === tutoExample.shown ? 'good' : ''}`} key={i}><span className="l">{tutoExample.codes[i] === tutoExample.shown ? l : ''}</span><span className="n">{tutoExample.codes[i]}</span></span>
                  ))}
                </div>
              )}
              {tuto === 1 && <div className="clue serif">« {puzzle.words[0]?.clue ?? puzzle.phraseText.split(' ')[0]} »</div>}
              {tuto === 2 && <div className="stars">{[0, 1, 2].map((i) => <Icon key={i} name="starFill" size={34} className="on" />)}</div>}
            </div>
            <p>{t.tutorial[tuto]}</p>
            <button
              className="btn primary block lg"
              onClick={() => {
                if (tuto + 1 < t.tutorial.length) setTuto(tuto + 1);
                else {
                  setTuto(-1);
                  setG(start());
                  props.onTutorialDone();
                }
              }}
            >
              {tuto + 1 < t.tutorial.length ? t.tutoNext : t.tutoStart}
            </button>
          </div>
        </div>
      )}

      {isOver(g) && overlay}
    </div>
  );
}
