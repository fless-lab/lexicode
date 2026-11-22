import { useEffect, useMemo, useRef, useState } from 'react';
import type { Puzzle } from '../engine/types';
import {
  initGame, select, typeLetter, erase, revealSelected, revealWord, codeAt, isCorrect, isWrong,
  wordSolved, progress, usedLetters, computeScore, stars, oracleSearch, wordPattern,
  type GameState, type Sel,
} from '../engine/game';
import { KEYBOARDS, type Strings } from '../i18n';
import { PACKS } from '../content';
import { COST } from '../services/monetization';

export interface FinishInfo {
  score: number;
  stars: 1 | 2 | 3;
  ms: number;
  mistakes: number;
  hints: number;
}

interface Props {
  puzzle: Puzzle;
  title: string;
  t: Strings;
  tokens: number;
  premium: boolean;
  spend: (n: number) => boolean;
  onNeedTokens: () => void;
  onFinish: (info: FinishInfo) => void;
  onExit: () => void;
  result: React.ReactNode;
}

function fmt(ms: number): string {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export function Play({ puzzle, title, t, tokens, premium, spend, onNeedTokens, onFinish, onExit, result }: Props) {
  const [g, setG] = useState<GameState>(() => initGame(puzzle));
  const [now, setNow] = useState(Date.now());
  const [oracle, setOracle] = useState<{ pattern: string; results: string[]; empty?: boolean } | null>(null);
  const [shake, setShake] = useState(false);
  const reported = useRef<string | null>(null);

  useEffect(() => {
    setG(initGame(puzzle));
    reported.current = null;
    // Accès de test automatisé uniquement (?qa dans l'URL).
    if (location.search.includes('qa')) (window as unknown as { __lexi: () => Puzzle }).__lexi = () => puzzle;
  }, [puzzle]);

  useEffect(() => {
    if (g.finished) return;
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, [g.finished]);

  useEffect(() => {
    if (g.finished && reported.current !== puzzle.id) {
      reported.current = puzzle.id;
      onFinish({ score: computeScore(g), stars: stars(g), ms: g.elapsedMs, mistakes: g.mistakes, hints: g.hints + g.oracle });
    }
  }, [g, puzzle.id, onFinish]);

  const selCode = g.sel ? codeAt(puzzle, g.sel) : null;
  const selWord = g.sel?.kind === 'word' ? g.sel.w : null;
  const used = useMemo(() => usedLetters(g), [g]);
  const lexicon = useMemo(() => PACKS[puzzle.lang].entries.map((e) => e.w), [puzzle.lang]);

  const press = (l: string) => {
    setG((s) => {
      const next = typeLetter(s, l);
      if (next.mistakes > s.mistakes) {
        setShake(true);
        setTimeout(() => setShake(false), 350);
        navigator.vibrate?.(40);
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
  }, [oracle]);

  const pay = (n: number): boolean => {
    if (premium) return true;
    if (tokens < n) {
      onNeedTokens();
      return false;
    }
    return spend(n);
  };

  const hintLetter = () => {
    if (g.finished) return;
    if (pay(COST.letter)) setG((s) => revealSelected(s));
  };
  const hintWord = () => {
    if (g.finished) return;
    const w = selWord ?? g.puzzle.words.findIndex((_, i) => !wordSolved(g, i));
    if (w < 0 || wordSolved(g, w)) return;
    if (pay(COST.word)) setG((s) => revealWord(s, w));
  };
  const openOracle = () => {
    if (g.finished) return;
    const w = selWord ?? g.puzzle.words.findIndex((_, i) => !wordSolved(g, i));
    if (w < 0) return;
    const pattern = wordPattern(g, w);
    // Une recherche sans aucune lettre connue ne sert à rien : elle n'est pas facturée.
    if (!/[A-Z]/.test(pattern)) {
      setOracle({ pattern, results: [], empty: true });
      return;
    }
    if (!pay(COST.oracle)) return;
    setG((s) => ({ ...s, oracle: s.oracle + 1 }));
    setOracle({ pattern, results: oracleSearch(pattern, lexicon) });
  };

  const elapsed = g.finished ? g.elapsedMs : Math.max(0, now - g.startedAt);
  const pct = Math.round(progress(g) * 100);

  // Phrase découpée en mots pour un retour à la ligne propre.
  const groups: { i: number }[][] = [];
  let cur: { i: number }[] = [];
  puzzle.phrase.forEach((c, i) => {
    if (c.kind === 'sep' && c.ch === ' ') {
      if (cur.length) groups.push(cur);
      cur = [];
    } else cur.push({ i });
  });
  if (cur.length) groups.push(cur);

  const cellClass = (code: number, sel: Sel, isSel: boolean, solvedWord = false) => {
    const cls = ['cell'];
    if (isSel) cls.push('sel');
    else if (selCode === code) cls.push('same');
    if (g.locked[code] && puzzle.given.includes(code)) cls.push('given');
    if (isWrong(g, code)) cls.push('wrong');
    if (solvedWord) cls.push('ok');
    void sel;
    return cls.join(' ');
  };

  return (
    <div className="play">
      <header className="topbar">
        <button className="icon" onClick={onExit} aria-label={t.back}>‹</button>
        <div className="title">
          <div className="t1">{title}</div>
          <div className="t2">{t.d[puzzle.difficulty]} · {t[`cat_${puzzle.category}` as 'cat_fact'] ?? puzzle.category}</div>
        </div>
        <div className="chips">
          <span className="chip">⏱ {fmt(elapsed)}</span>
          <span className="chip">✕ {g.mistakes}</span>
          <span className="chip gold">{premium ? '∞' : tokens} ◆</span>
        </div>
      </header>
      <div className="bar"><div style={{ width: `${pct}%` }} /></div>

      <section className={`phrase ${shake ? 'shake' : ''}`}>
        {groups.map((grp, gi) => (
          <div className="pgroup" key={gi}>
            {grp.map(({ i }) => {
              const c = puzzle.phrase[i];
              if (c.kind === 'sep') return <span className="psep" key={i}>{c.ch}</span>;
              const sel: Sel = { kind: 'phrase', i };
              const isSel = g.sel?.kind === 'phrase' && g.sel.i === i;
              const good = isCorrect(g, c.code);
              return (
                <button key={i} className={cellClass(c.code, sel, isSel) + (good ? ' pgood' : '')} onClick={() => setG((s) => select(s, sel))}>
                  <span className="l">{good ? c.shown : g.guesses[c.code] ?? ''}</span>
                  <span className="n">{c.code}</span>
                </button>
              );
            })}
          </div>
        ))}
      </section>

      {g.mistakes === 0 && g.hints === 0 && pct < 15 && <p className="help">{t.tapCell}</p>}

      <section className="words">
        {puzzle.words.map((w, wi) => {
          const solved = wordSolved(g, wi);
          return (
            <div key={wi} className={`wrow ${selWord === wi ? 'active' : ''} ${solved ? 'done' : ''}`}>
              <div className="clue">{w.clue}</div>
              <div className="wcells">
                {w.codes.map((code, ci) => {
                  const sel: Sel = { kind: 'word', w: wi, i: ci };
                  const isSel = g.sel?.kind === 'word' && g.sel.w === wi && g.sel.i === ci;
                  return (
                    <button key={ci} className={cellClass(code, sel, isSel, solved)} onClick={() => setG((s) => select(s, sel))}>
                      <span className="l">{g.guesses[code] ?? ''}</span>
                      <span className="n">{code}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </section>

      {!g.finished && (
        <footer className="dock">
          <div className="tools">
            <button onClick={hintLetter}>💡 {t.hint} <small>{premium ? '' : `${COST.letter}◆`}</small></button>
            <button onClick={openOracle}>🔎 {t.oracle} <small>{premium ? '' : `${COST.oracle}◆`}</small></button>
            <button onClick={hintWord}>✨ {t.hintWord} <small>{premium ? '' : `${COST.word}◆`}</small></button>
          </div>
          <div className="kb">
            {KEYBOARDS[puzzle.lang].map((row, ri) => (
              <div className="kbrow" key={ri}>
                {[...row].map((k) => (
                  <button key={k} className={`key ${used.has(k) ? 'used' : ''}`} onClick={() => press(k)}>{k}</button>
                ))}
                {ri === 2 && <button className="key wide" onClick={() => setG((s) => erase(s))} aria-label="effacer">⌫</button>}
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

      {g.finished && result}
    </div>
  );
}

export { fmt };
