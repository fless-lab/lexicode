// Validation d'une partie classée : le serveur régénère la grille à partir du mode et de la graine,
// rejoue le journal des coups avec le moteur du jeu, et recalcule lui-même le score.
// Le téléphone n'envoie jamais son score : il envoie seulement ce qu'il a joué.
import { PACKS } from '../../src/content/index';
import { puzzleFor, rulesFor, recordKey, RANKED, marathonDifficulty, MARATHON_START_MS, MARATHON_BONUS_MS, type Mode, type ModeKind } from '../../src/modes';
import { replay, computeScore } from '../../src/engine/game';
import type { Lang } from '../../src/engine/types';

export type Log = [number, number, string][];

export const LANGS: Lang[] = ['fr', 'en', 'es'];
const ARENA: ModeKind[] = ['timeattack', 'sudden', 'survival', 'marathon', 'hardcore', 'cryptogram'];
/** En dessous, aucune main humaine ne tape : coup refusé. */
const MIN_GAP_MS = 60;
/** Le serveur lance son chrono avant le téléphone (aller-retour réseau compris) : la durée annoncée ne peut pas dépasser la sienne, à cette marge près. */
const CLOCK_SLACK_MS = 1_500;

export function boardKey(mode: Mode): string | null {
  if (mode.kind === 'daily') return mode.date ? `daily:${mode.date}` : null;
  return recordKey(mode);
}

/** Vérifie que le mode demandé est classé et bien formé. */
export function checkMode(raw: unknown, today: string): Mode | null {
  if (!raw || typeof raw !== 'object') return null;
  const m = raw as Partial<Mode>;
  if (!m.kind || !RANKED.includes(m.kind)) return null;
  const d = Number(m.d);
  if (!(d >= 1 && d <= 5)) return null;
  if (m.kind === 'daily') {
    // Le défi du jour se joue le jour même (à un jour près pour les fuseaux horaires).
    if (typeof m.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(m.date)) return null;
    const diff = Math.abs(Date.parse(m.date) - Date.parse(today)) / 86_400_000;
    if (diff > 1) return null;
    return { kind: 'daily', d: d as Mode['d'], nonce: m.date, date: m.date };
  }
  if (!ARENA.includes(m.kind)) return null;
  return { kind: m.kind, d: d as Mode['d'], nonce: '' };
}

function gapsOk(log: Log): boolean {
  let last = -Infinity;
  for (const [t, code, letter] of log) {
    if (!Number.isFinite(t) || !Number.isInteger(code) || typeof letter !== 'string' || letter.length !== 1) return false;
    if (letter === '?') return false; // une aide : partie hors classement
    if (t - last < MIN_GAP_MS && last !== -Infinity) return false;
    last = t;
  }
  return true;
}

export interface Verdict {
  ok: boolean;
  reason?: string;
  score: number;
  ms: number;
  /** Pour le marathon : nombre de grilles résolues. */
  grids?: number;
}

/**
 * Rejoue une partie. `logs` contient un journal par grille (une seule, sauf au marathon).
 * `wallMs` est la durée réelle mesurée par le serveur entre le départ et l'arrivée.
 */
export function judge(lang: Lang, mode: Mode, logs: Log[], wallMs: number): Verdict {
  const pack = PACKS[lang];
  const rules = rulesFor(mode);
  const fail = (reason: string): Verdict => ({ ok: false, reason, score: 0, ms: 0 });
  if (!logs.length || !logs.every(gapsOk)) return fail('journal invalide');

  if (mode.kind === 'marathon') {
    let budget = MARATHON_START_MS;
    let total = 0;
    let grids = 0;
    for (let run = 0; run < logs.length; run++) {
      const puzzle = puzzleFor(pack, { ...mode, run });
      const s = replay(puzzle, logs[run], null);
      total += s.elapsedMs || (logs[run].at(-1)?.[0] ?? 0);
      budget -= s.mistakes * (rules.mistakePenaltyMs ?? 0);
      if (!s.finished) break;
      if (total > budget) break;
      grids++;
      budget += MARATHON_BONUS_MS(marathonDifficulty(run));
    }
    if (total > wallMs + CLOCK_SLACK_MS) return fail('temps impossible');
    return { ok: grids > 0, reason: grids > 0 ? undefined : 'aucune grille', score: grids, ms: total, grids };
  }

  const puzzle = puzzleFor(pack, mode);
  const s = replay(puzzle, logs[0], rules.lives);
  if (!s.finished) return fail('grille non résolue');
  if (s.elapsedMs > wallMs + CLOCK_SLACK_MS) return fail('temps impossible');
  if (rules.timeMs !== null && s.elapsedMs > rules.timeMs) return fail('temps dépassé');
  const remaining = rules.timeMs !== null ? rules.timeMs - s.elapsedMs : null;
  const timeBonus = remaining !== null ? Math.round((remaining / 1000) * 4) : 0;
  const score = Math.round(computeScore(s) * rules.mult) + timeBonus;
  return { ok: true, score, ms: s.elapsedMs };
}

/** Graine des modes d'arène : tirée par le serveur pour qu'on ne puisse pas choisir une grille facile. */
export function arenaNonce(): string {
  return Math.random().toString(36).slice(2, 10);
}

export { marathonDifficulty };
