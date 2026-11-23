import { rngFromSeed } from '../engine/rng';
import type { Lang } from '../engine/types';
import { apiEnabled, fetchBoard } from './api';

export type Scope = 'city' | 'country' | 'world' | 'friends';

export interface RankRow {
  name: string;
  place: string;
  score: number;
  ms: number;
  isYou?: boolean;
}

export interface MyResult {
  name: string;
  city: string;
  country: string;
  score: number;
  ms: number;
}

/**
 * Contrat du service de classement. L'implémentation réelle lit le serveur Lexicode (dossier server/) ;
 * les scores n'y entrent que par la fin de partie, après rejeu du journal des coups.
 */
export interface RankingService {
  readonly demo: boolean;
  submit(lang: Lang, day: string, r: MyResult): Promise<void>;
  /** `key` : "daily:AAAA-MM-JJ" ou une clé de mode ("timeattack:3", "marathon"…). `count` : scores en nombre de grilles. */
  board(lang: Lang, key: string, scope: Scope, me: MyResult | null, profile: { city: string; country: string }, count?: boolean): Promise<RankRow[]>;
}

const FIRST = ['Alex', 'Sam', 'Nina', 'Léo', 'Maya', 'Omar', 'Yuki', 'Ana', 'Kofi', 'Lina', 'Hugo', 'Zoé', 'Ravi', 'Ines', 'Tom', 'Aya', 'Max', 'Eva', 'Noah', 'Sara'];
const CITIES = ['Paris', 'Lyon', 'Montréal', 'Bruxelles', 'Lomé', 'Dakar', 'Madrid', 'London', 'New York', 'Mexico', 'Abidjan', 'Genève', 'Toronto', 'Rabat'];

/** Classement de démonstration : joueurs simulés, clairement signalés dans l'interface. */
export class DemoRanking implements RankingService {
  readonly demo = true;
  async submit(): Promise<void> {}
  async board(lang: Lang, key: string, scope: Scope, me: MyResult | null, profile: { city: string; country: string }, count = false): Promise<RankRow[]> {
    const rng = rngFromSeed(`board|${lang}|${key}|${scope}`);
    const n = scope === 'friends' ? 6 : scope === 'city' ? 14 : 25;
    const rows: RankRow[] = [];
    for (let i = 0; i < n; i++) {
      const score = count ? Math.max(1, Math.round(22 - Math.pow(rng(), 0.5) * 20)) : Math.round(1200 - Math.pow(rng(), 0.7) * 800);
      const place =
        scope === 'city' ? profile.city || CITIES[0] : scope === 'country' ? profile.country || 'France' : CITIES[Math.floor(rng() * CITIES.length)];
      rows.push({
        name: `${FIRST[Math.floor(rng() * FIRST.length)]}${Math.floor(rng() * 90 + 10)}`,
        place,
        score,
        ms: Math.round(60000 + rng() * 240000),
      });
    }
    if (me) rows.push({ name: me.name || 'Toi', place: scope === 'world' ? me.country || me.city : scope === 'country' ? me.country : me.city, score: me.score, ms: me.ms, isYou: true });
    return rows.sort((a, b) => b.score - a.score || a.ms - b.ms);
  }
}

/** Classement réel : le serveur renvoie les 100 premiers ; on ajoute sa propre ligne si elle n'y est pas. */
export class RemoteRanking implements RankingService {
  readonly demo = false;
  async submit(): Promise<void> {
    // Rien à faire : le score part avec le journal de la partie (services/api.ts, finishGame).
  }
  async board(lang: Lang, key: string, scope: Scope, me: MyResult | null, profile: { city: string; country: string }): Promise<RankRow[]> {
    if (scope === 'friends') return me ? [{ name: me.name || 'Toi', place: me.city, score: me.score, ms: me.ms, isYou: true }] : [];
    const place = scope === 'city' ? profile.city : scope === 'country' ? profile.country : '';
    if (scope !== 'world' && !place) return [];
    try {
      const { rows } = await fetchBoard(lang, key, scope, place);
      if (me && !rows.some((r) => r.isYou) && me.score > 0) {
        rows.push({ name: me.name || 'Toi', place: scope === 'world' ? me.country || me.city : scope === 'country' ? me.country : me.city, score: me.score, ms: me.ms, isYou: true });
      }
      return rows;
    } catch {
      // Hors ligne : on n'invente pas d'adversaires, on montre seulement son propre score.
      return me && me.score > 0 ? [{ name: me.name || 'Toi', place: me.city, score: me.score, ms: me.ms, isYou: true }] : [];
    }
  }
}

export const ranking: RankingService = apiEnabled ? new RemoteRanking() : new DemoRanking();
