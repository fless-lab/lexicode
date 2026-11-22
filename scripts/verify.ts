// Génère et vérifie des milliers de grilles pour chaque langue.
// Usage : npm run verify
import { PACKS } from '../src/content/index';
import { dailyPuzzle, levelPuzzle, practicePuzzle } from '../src/engine/generator';
import { verifyPuzzle, verifyPack } from '../src/engine/verify';
import type { Difficulty, Puzzle } from '../src/engine/types';

let failures = 0;
let total = 0;

for (const pack of Object.values(PACKS)) {
  const packErrs = verifyPack(pack);
  if (packErrs.length) {
    failures += packErrs.length;
    console.log(`[${pack.lang}] contenu:`, packErrs);
  }

  const puzzles: { label: string; make: () => Puzzle }[] = [];
  for (let d = 0; d < 400; d++) {
    const date = new Date(Date.UTC(2026, 10, 1) + d * 86400000).toISOString().slice(0, 10);
    puzzles.push({ label: `daily ${date}`, make: () => dailyPuzzle(pack, date) });
  }
  for (let l = 1; l <= 150; l++) puzzles.push({ label: `level ${l}`, make: () => levelPuzzle(pack, l) });
  for (let d = 1; d <= 5; d++)
    for (let k = 0; k < 60; k++)
      puzzles.push({ label: `practice d${d} #${k}`, make: () => practicePuzzle(pack, d as Difficulty, String(k)) });

  const byDiff: Record<number, { n: number; words: number; given: number }> = {};
  const usedPhrases = new Set<number>();
  for (const { label, make } of puzzles) {
    total++;
    try {
      const p = make();
      const errs = verifyPuzzle(p, pack);
      if (errs.length) {
        failures++;
        console.log(`[${pack.lang}] ${label}:`, errs.slice(0, 4));
      }
      const b = (byDiff[p.difficulty] ??= { n: 0, words: 0, given: 0 });
      b.n++;
      b.words += p.words.length;
      b.given += p.given.length;
      usedPhrases.add(p.phraseIndex);
    } catch (e) {
      failures++;
      console.log(`[${pack.lang}] ${label}: exception`, (e as Error).message);
    }
  }

  // Les défis du jour ne répètent pas une phrase avant d'avoir épuisé le pack.
  const n = pack.phrases.length;
  const seen = new Set<number>();
  for (let d = 0; d < n; d++) {
    const date = new Date(Date.UTC(2026, 0, 1) + d * 86400000).toISOString().slice(0, 10);
    seen.add(dailyPuzzle(pack, date).phraseIndex);
  }
  if (seen.size !== n) {
    failures++;
    console.log(`[${pack.lang}] défis du jour : ${seen.size}/${n} phrases distinctes sur un cycle`);
  }

  // Déterminisme : la même graine donne la même grille.
  const a = JSON.stringify(dailyPuzzle(pack, '2026-12-25'));
  const b = JSON.stringify(dailyPuzzle(pack, '2026-12-25'));
  if (a !== b) {
    failures++;
    console.log(`[${pack.lang}] génération non déterministe`);
  }

  const stats = Object.entries(byDiff)
    .map(([d, s]) => `d${d}: ${s.n} grilles, ${(s.words / s.n).toFixed(1)} mots, ${(s.given / s.n).toFixed(1)} lettres données`)
    .join(' | ');
  console.log(`[${pack.lang}] ${pack.entries.length} mots, ${n} phrases (${usedPhrases.size} utilisées). ${stats}`);
}

console.log(`\n${total} grilles générées, ${failures} problème(s).`);
process.exit(failures ? 1 : 0);
