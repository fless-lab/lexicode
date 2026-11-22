import { useEffect, useMemo, useRef, useState } from 'react';
import type { Puzzle } from '../engine/types';
import {
  initGame, select, typeLetter, erase, revealSelected, revealWord, codeAt, isCorrect, isWrong,
  wordSolved, progress, usedLetters, computeScore, stars, oracleSearch, wordPattern, failGame,
  livesLeft, isOver, type GameState, type Sel,
} from '../engine/game';
import { KEYBOARDS, type Strings } from '../i18n';
import { PACKS } from '../content';
import { COST } from '../services/monetization';
import type { Rules } from '../modes';
import { sfx } from '../sound';

export interface FinishInfo {
  score: number;
  stars: 1 | 2 | 3;
  ms: number;
  mistakes: number;
  hints: number;
  remainingMs: number | null;
}

interface Props {
  puzzle: Puzzle;
  title: string;
  subtitle?: string;
  t: Strings;
  tokens: number;
  premium: boolean;
  rules: Rules;
  /** Échéance absolue du chrono (ms epoch), si chrono. */
  deadline: number | null;
  spend: (n: number) => boolean;
  onNeedTokens: () => void;
  onFinish: (info: FinishInfo) => void;
  onFail: (reason: 'time' | 'mistakes', info: FinishInfo) => void;
  onMistake?: () => void;
  onExit: () => void;
  overlay: React.ReactNode;
  showTutorial: boolean;
  onTutorialDone: () => void;
}

export function fmt(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export function Play(props: Props) {
  const { puzzle, title, subtitle, t, tokens, premium, rules, deadline, spend, onNeedTokens, onFinish, onFail, onMistake, onExit, overlay } = props;
  const [g, setG] = useState<GameState>(() => initGame(puzzle, Date.now(), rules.lives));
  const [now, setNow] = useState(Date.now());
  const [oracle, setOracle] = useState<{ pattern: string; results: string[]; empty?: boolean } | null>(null);
  const [shake, setShake] = useState(false);
  const [flashWord, setFlashWord] = useState<number | null>(null);
  const [tuto, setTuto] = useState(props.showTutorial ? 0 : -1);
  const reported = useRef<string | null>(null);

  useEffect(() => {
    setG(initGame(puzzle, Date.now(), rules.lives));
    reported.current = null;
    if (location.search.includes('qa')) (window as unknown as { __lexi: () => Puzzle }).__lexi = () => puzzle;
  }, [puzzle, rules.lives]);

  useEffect(() => {
    if (isOver(g)) return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [g.finished, g.failed]);

  const remaining = deadline !== null ? deadline - (isOver(g) ? g.startedAt + g.elapsedMs : now) : null;

  // Fin du chrono.
  useEffect(() => {
    if (remaining !== null && remaining <= 0 && !isOver(g) && tuto < 0) setG((s) => failGame(s, 'time'));
  }, [remaining, g, tuto]);

  // Tic-tac des dix dernières secondes.
  const lastTick = useRef(-1);
  useEffect(() => {
    if (remaining === null || isOver(g)) return;
    const sec = Math.ceil(remaining / 1000);
    if (sec <= 10 && sec > 0 && sec !== lastTick.current) {
      lastTick.current = sec;
      sfx.tick();
    }
  }, [remaining, g]);

  useEffect(() => {
    if (reported.current === puzzle.id + g.startedAt) return;
    const info = (): FinishInfo => ({
      score: computeScore(g),
      stars: stars(g),
      ms: g.elapsedMs,
      mistakes: g.mistakes,
      hints: g.hints + g.oracle,
      remainingMs: deadline !== null ? Math.max(0, deadline - (g.startedAt + g.elapsedMs)) : null,
    });
    if (g.finished) {
      reported.current = puzzle.id + g.startedAt;
      sfx.win();
      onFinish(info());
    } else if (g.failed && g.failReason) {
      reported.current = puzzle.id + g.startedAt;
      sfx.fail();
      onFail(g.failReason, info());
    }
  }, [g, puzzle.id, onFinish, onFail, deadline]);

  const selCode = g.sel ? codeAt(puzzle, g.sel) : null;
  const selWord = g.sel?.kind === 'word' ? g.sel.w : null;
  const used = useMemo(() => usedLetters(g), [g]);
  const lexicon = useMemo(() => PACKS[puzzle.lang].entries.map((e) => e.w), [puzzle.lang]);

  const press = (l: string) => {
    if (tuto >= 0) return;
    setG((s) => {
      const next = typeLetter(s, l);
      if (next.mistakes > s.mistakes) {
        setShake(true);
        setTimeout(() => setShake(false), 350);
        sfx.bad();
        onMistake?.();
      } else if (next !== s && !next.finished) {
        const solvedNow = s.puzzle.words.findIndex((_, i) => !wordSolved(s, i) && wordSolved(next, i));
        if (solvedNow >= 0) {
          sfx.word();
          setFlashWord(solvedNow);
          setTimeout(() => setFlashWord(null), 600);
        } else if (next.guesses !== s.guesses) sfx.good();
      }
      return next;
    });
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (oracle) return;
      const k = e.key.toUpperCase();
      if (/^[A-Z]$/.test(k)) press(k);
      else if (e.key === 'Backspace') setG((s) => erase(s));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

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

  const hintLetter = () => {
    if (isOver(g)) return;
    if (pay(COST.letter)) setG((s) => revealSelected(s));
  };
  const hintWord = () => {
    if (isOver(g)) return;
    const w = selWord ?? g.puzzle.words.findIndex((_, i) => !wordSolved(g, i));
    if (w < 0 || wordSolved(g, w)) return;
    if (pay(COST.word)) setG((s) => revealWord(s, w));
  };
  const openOracle = () => {
    if (isOver(g)) return;
    const w = selWord ?? g.puzzle.words.findIndex((_, i) => !wordSolved(g, i));
    if (w < 0) return;
    const pattern = wordPattern(g, w);
    if (!/[A-Z]/.test(pattern)) {
      setOracle({ pattern, results: [], empty: true });
      return;
    }
    if (!pay(COST.oracle)) return;
    setG((s) => ({ ...s, oracle: s.oracle + 1 }));
    setOracle({ pattern, results: oracleSearch(pattern, lexicon) });
  };

  const elapsed = isOver(g) ? g.elapsedMs : Math.max(0, now - g.startedAt);
  const pct = Math.round(progress(g) * 100);
  const lives = livesLeft(g);
  const urgent = remaining !== null && remaining < 15_000 && !isOver(g);

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
    return cls.join(' ');
  };

  const timeTotal = rules.timeMs ?? 1;
  const timePct = remaining !== null ? Math.max(0, Math.min(100, (remaining / timeTotal) * 100)) : 0;

  return (
    <div className={`play ${urgent ? 'urgent' : ''} ${g.failed ? 'failed' : ''}`}>
      <header className="topbar">
        <button className="icon" onClick={onExit} aria-label={t.back}>‹</button>
        <div className="title">
          <div className="t1">{title}</div>
          <div className="t2">{subtitle ?? `${t.d[puzzle.difficulty]} · ${t[`cat_${puzzle.category}` as 'cat_fact'] ?? puzzle.category}`}</div>
        </div>
        <div className="chips">
          {remaining !== null ? (
            <span className={`chip timer ${urgent ? 'hot' : ''}`}>⏳ {fmt(remaining)}</span>
          ) : (
            <span className="chip">⏱ {fmt(elapsed)}</span>
          )}
          {lives !== null ? (
            <span className="chip lives">{'❤️'.repeat(lives)}{'🖤'.repeat(Math.max(0, (rules.lives ?? 0) - lives))}</span>
          ) : (
            <span className="chip">✕ {g.mistakes}</span>
          )}
          {!rules.noHints && <span className="chip gold">{premium ? '∞' : tokens} ◆</span>}
        </div>
      </header>
      {remaining !== null ? (
        <div className="bar time"><div style={{ width: `${timePct}%` }} /></div>
      ) : (
        <div className="bar"><div style={{ width: `${pct}%` }} /></div>
      )}

      <section className={`phrase ${shake ? 'shake' : ''}`}>
        {groups.map((grp, gi) => (
          <div className="pgroup" key={gi}>
            {grp.map((i) => {
              const c = puzzle.phrase[i];
              if (c.kind === 'sep') return <span className="psep" key={i}>{c.ch}</span>;
              const sel: Sel = { kind: 'phrase', i };
              const isSel = g.sel?.kind === 'phrase' && g.sel.i === i;
              const good = isCorrect(g, c.code);
              const showFail = g.failed;
              return (
                <button key={i} className={cellClass(c.code, isSel) + (good ? ' pgood' : '') + (showFail && !good ? ' reveal' : '')} onClick={() => { sfx.tap(); setG((s) => select(s, sel)); }}>
                  <span className="l">{good || showFail ? c.shown : g.guesses[c.code] ?? ''}</span>
                  <span className="n">{c.code}</span>
                </button>
              );
            })}
          </div>
        ))}
      </section>

      <section className="words">
        {puzzle.words.map((w, wi) => {
          const solved = wordSolved(g, wi);
          return (
            <div key={wi} className={`wrow ${selWord === wi ? 'active' : ''} ${solved ? 'done' : ''} ${flashWord === wi ? 'pop' : ''}`}>
              <div className="clue">{w.clue}</div>
              <div className="wcells">
                {w.codes.map((code, ci) => {
                  const sel: Sel = { kind: 'word', w: wi, i: ci };
                  const isSel = g.sel?.kind === 'word' && g.sel.w === wi && g.sel.i === ci;
                  return (
                    <button key={ci} className={cellClass(code, isSel, solved)} onClick={() => { sfx.tap(); setG((s) => select(s, sel)); }}>
                      <span className="l">{g.failed ? w.answer[ci] : g.guesses[code] ?? ''}</span>
                      <span className="n">{code}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </section>

      {!isOver(g) && (
        <footer className="dock">
          {rules.noHints ? (
            <p className="nohints">🚫 {t.hintsOff}</p>
          ) : (
            <div className="tools">
              <button onClick={hintLetter}>💡 {t.hint} <small>{premium ? '' : `${price(COST.letter)}◆`}</small></button>
              <button onClick={openOracle}>🔎 {t.oracle} <small>{premium ? '' : `${price(COST.oracle)}◆`}</small></button>
              <button onClick={hintWord}>✨ {t.hintWord} <small>{premium ? '' : `${price(COST.word)}◆`}</small></button>
            </div>
          )}
          <div className="kb">
            {KEYBOARDS[puzzle.lang].map((row, ri) => (
              <div className="kbrow" key={ri}>
                {[...row].map((k) => (
                  <button key={k} className={`key ${used.has(k) ? 'used' : ''}`} onClick={() => press(k)}>{k}</button>
                ))}
                {ri === 2 && <button className="key wide" onClick={() => setG((s) => erase(s))} aria-label="⌫">⌫</button>}
              </div>
            ))}
          </div>
        </footer>
      )}

      {oracle && (
        <div className="modal" onClick={() => setOracle(null)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <h3>🔎 {t.oracleTitle}</h3>
            <p className="muted">{t.oracleSub}</p>
            <div className="pattern">{[...oracle.pattern].map((c, i) => <span key={i}>{c === '_' ? '·' : c}</span>)}</div>
            {oracle.empty ? (
              <p className="muted">{t.oracleNeedLetter}</p>
            ) : oracle.results.length ? (
              <div className="results">{oracle.results.map((r) => <span key={r}>{r}</span>)}</div>
            ) : (
              <p className="muted">{t.oracleNone}</p>
            )}
            <button className="primary" onClick={() => setOracle(null)}>OK</button>
          </div>
        </div>
      )}

      {tuto >= 0 && (
        <div className="modal center">
          <div className="sheet tuto">
            <div className="tutostep">{tuto + 1} / {t.tutorial.length}</div>
            <div className="tutodemo">
              {tuto === 0 && <div className="wcells">{['S', 'A', 'L', 'U', 'T'].map((l, i) => <span className="cell" key={i}><span className="l">{i === 1 ? l : ''}</span><span className="n">{[10, 3, 9, 4, 5][i]}</span></span>)}</div>}
              {tuto === 1 && <div className="clue">💬 « {puzzle.words[0]?.clue} »</div>}
              {tuto === 2 && <div className="stars big">★★★</div>}
            </div>
            <p>{t.tutorial[tuto]}</p>
            <button className="primary" onClick={() => {
              if (tuto + 1 < t.tutorial.length) setTuto(tuto + 1);
              else {
                setTuto(-1);
                setG(initGame(puzzle, Date.now(), rules.lives));
                props.onTutorialDone();
              }
            }}>{tuto + 1 < t.tutorial.length ? t.tutoNext : t.tutoStart}</button>
          </div>
        </div>
      )}

      {isOver(g) && overlay}
    </div>
  );
}
