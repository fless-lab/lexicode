// Croise la résolution à l'aveugle et le jugement, puis écrit src/content/review/<langue>.json.
// Usage : npx tsx scripts/review-merge.ts <dossier des résultats> [fichier des corrections re-testées]
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'fs';
import { norm } from '../src/engine/text';
import type { Tier } from '../src/engine/types';

type Item = { id: string; lang: string; word: string; tier: Tier; clue: string };
type Solve = { id: string; guess: string; alts?: string[]; conf: number };
type Judge = { id: string; verdict: 'ok' | 'weak' | 'wrong'; tier: Tier; issue?: string; fix?: string };
type Retest = { id: string; guess: string; alts?: string[]; conf: number };

const dir = process.argv[2] ?? '/home/claude/review/out';
const retestFile = process.argv[3];
const items: Item[] = JSON.parse(readFileSync('/home/claude/review/keys/all.json', 'utf8'));

const readJsonl = <T>(prefix: string): Map<string, T> => {
  const m = new Map<string, T>();
  for (const f of readdirSync(dir).filter((x) => x.startsWith(prefix) && x.endsWith('.jsonl'))) {
    for (const line of readFileSync(`${dir}/${f}`, 'utf8').split('\n')) {
      if (!line.trim()) continue;
      try {
        const o = JSON.parse(line) as { id: string };
        m.set(o.id, o as T);
      } catch {
        /* ligne illisible : l'indice sera traité comme non testé */
      }
    }
  }
  return m;
};

const solves = readJsonl<Solve>('solve_');
const judges = readJsonl<Judge>('judge_');
const retests = new Map<string, Retest>();
if (retestFile && existsSync(retestFile))
  for (const line of readFileSync(retestFile, 'utf8').split('\n')) if (line.trim()) { const o = JSON.parse(line); retests.set(o.id, o); }

const W = (s: string | undefined) => norm(s ?? '').replace(/[^A-Z]/g, '');
// L'answer ne doit jamais apparaître dans l'indice, ni seule ni cachée dans un mot plus long (BRAINSTORM pour STORM).
const containsAnswer = (clue: string, word: string) =>
  norm(clue).replace(/[^A-Z]/g, ' ').split(' ').some((tok) => tok === word || (word.length >= 4 && tok.includes(word)));

const out: Record<string, Record<string, { s: string; t?: Tier; f?: string }>> = { fr: {}, en: {}, es: {} };
const stats: Record<string, Record<string, number>> = {};
const examples: Record<string, string[]> = { rejected: [], fixed: [], ambiguous: [], retiered: [] };
const pendingFixes: object[] = [];

// Second juge, indépendant, sur le texte corrigé : une correction peut elle-même introduire une erreur.
const rejudge = new Map<string, { ok: boolean; issue?: string }>();
for (const lang of ['fr', 'en', 'es']) {
  const f = `${dir}/rejudge_${lang}.jsonl`;
  if (existsSync(f)) for (const line of readFileSync(f, 'utf8').split('\n')) if (line.trim()) { const o = JSON.parse(line); rejudge.set(o.id, o); }
}
// Arbitrages humains : l'indice d'origine était juste, le premier juge s'est trompé.
const OVERRIDE_OK = new Set(['CHAT|Il a neuf vies, dit-on']);
let missing = 0;

for (const it of items) {
  const st = (stats[it.lang] ??= { total: 0, ok: 0, fixed: 0, rejected: 0, solved: 0, retiered: 0, untested: 0 });
  st.total++;
  const sv = solves.get(it.id);
  const jd = judges.get(it.id);
  const key = `${it.word}|${it.clue}`;
  if (!sv || !jd) {
    missing++;
    st.untested++;
    continue; // non testé : pas publié
  }
  const solved = W(sv.guess) === it.word;
  const inAlts = (sv.alts ?? []).some((a) => W(a) === it.word);
  if (solved) st.solved++;
  const fixOk = !!jd.fix && jd.fix.length > 3 && !containsAnswer(jd.fix, it.word) && !/—/.test(jd.fix);

  let status: 'ok' | 'fixed' | 'rejected' = 'ok';
  let text: string | undefined;
  const leaks = containsAnswer(it.clue, it.word);
  if (jd.verdict === 'wrong' || leaks) {
    if (fixOk) { status = 'fixed'; text = jd.fix; } else status = 'rejected';
  } else if (jd.verdict === 'weak') {
    // Une correction proposée passe toujours le re-test ; sans correction, on ne garde que si l'aveugle a trouvé.
    if (fixOk) { status = 'fixed'; text = jd.fix; }
    else if (solved || inAlts) status = 'ok';
    else status = 'rejected';
  } else {
    // Le juge l'accepte, mais le solveur aveugle a trouvé avec assurance un autre mot : indice ambigu.
    const confidentOther = !solved && !inAlts && sv.conf >= (it.tier === 1 ? 0.6 : 0.85) && W(sv.guess).length === it.word.length;
    if (confidentOther) {
      status = 'rejected';
      examples.ambiguous.push(`[${it.lang}] ${it.word} ← « ${it.clue} » (lu ${sv.guess})`);
    }
  }

  if (OVERRIDE_OK.has(`${it.word}|${it.clue}`)) { status = 'ok'; text = undefined; }

  // Une correction doit passer le test à l'aveugle puis le second juge.
  if (status === 'fixed') {
    const rj = rejudge.get(`${it.word}|${it.clue}`);
    if (rj && !rj.ok) { status = 'rejected'; }
  }
  if (status === 'fixed') {
    const rt = retests.get(it.id);
    if (rt) {
      const ok = W(rt.guess) === it.word || (rt.alts ?? []).some((a) => W(a) === it.word);
      if (!ok) status = 'rejected';
    } else {
      pendingFixes.push({ id: it.id, lang: it.lang, letters: it.word.length, tier: jd.tier ?? it.tier, clue: text });
    }
  }

  // Niveau recalibré : la difficulté réelle mesurée l'emporte sur le niveau prévu.
  let tier: Tier = it.tier;
  if (it.tier === 3 && jd.tier <= 2 && solved && sv.conf >= 0.9) tier = 2;
  else if (it.tier === 3 && jd.tier === 1) tier = 2;
  else if (it.tier === 1 && !solved && jd.tier >= 2) tier = 2;
  else if (it.tier === 2 && jd.tier === 3 && !solved) tier = 3;
  if (tier !== it.tier) {
    st.retiered++;
    if (examples.retiered.length < 400) examples.retiered.push(`[${it.lang}] ${it.word} : ${it.tier} → ${tier} « ${it.clue} »`);
  }

  st[status]++;
  if (status === 'rejected') examples.rejected.push(`[${it.lang}] ${it.word} ← « ${it.clue} » : ${jd.issue || 'ambigu'}`);
  if (status === 'fixed') examples.fixed.push(`[${it.lang}] ${it.word} : « ${it.clue} » → « ${text} »`);
  out[it.lang][key] = { s: status, ...(tier !== it.tier ? { t: tier } : {}), ...(text ? { f: text } : {}) };
}

for (const lang of ['fr', 'en', 'es']) writeFileSync(`src/content/review/${lang}.json`, JSON.stringify(out[lang], null, 0));
writeFileSync('/home/claude/review/pending_fixes.jsonl', pendingFixes.map((x) => JSON.stringify(x)).join('\n') + (pendingFixes.length ? '\n' : ''));
writeFileSync('/home/claude/review/report.json', JSON.stringify({ stats, examples, missing, pendingFixes: pendingFixes.length }, null, 2));
console.log(JSON.stringify(stats, null, 1));
console.log(`non testés : ${missing}, corrections à re-tester : ${pendingFixes.length}`);
