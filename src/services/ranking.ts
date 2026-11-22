import { rngFromSeed } from '../engine/rng';
import type { Lang } from '../engine/types';

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
 * Contrat du service de classement. L'implémentation réelle (Supabase, voir backend/schema.sql)
 * enverra le score signé côté serveur et lira les classements filtrés par ville, pays ou amis.
 */
export interface RankingService {
  readonly demo: boolean;
  submit(lang: Lang, day: string, r: MyResult): Promise<void>;
  board(lang: Lang, day: string, scope: Scope, me: MyResult | null, profile: { city: string; country: string }): Promise<RankRow[]>;
}

const FIRST = ['Alex', 'Sam', 'Nina', 'Léo', 'Maya', 'Omar', 'Yuki', 'Ana', 'Kofi', 'Lina', 'Hugo', 'Zoé', 'Ravi', 'Ines', 'Tom', 'Aya', 'Max', 'Eva', 'Noah', 'Sara'];
const CITIES = ['Paris', 'Lyon', 'Montréal', 'Bruxelles', 'Lomé', 'Dakar', 'Madrid', 'London', 'New York', 'Mexico', 'Abidjan', 'Genève', 'Toronto', 'Rabat'];

/** Classement de démonstration : joueurs simulés, clairement signalés dans l'interface. */
export class DemoRanking implements RankingService {
  readonly demo = true;
  async submit(): Promise<void> {}
  async board(lang: Lang, day: string, scope: Scope, me: MyResult | null, profile: { city: string; country: string }): Promise<RankRow[]> {
    const rng = rngFromSeed(`board|${lang}|${day}|${scope}`);
    const n = scope === 'friends' ? 6 : scope === 'city' ? 14 : 25;
    const rows: RankRow[] = [];
    for (let i = 0; i < n; i++) {
      const score = Math.round(1000 - Math.pow(rng(), 0.7) * 650);
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

export const ranking: RankingService = new DemoRanking();
