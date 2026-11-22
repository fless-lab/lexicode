/**
 * Monétisation. Dans l'application Android, ces fonctions appellent :
 *  - AdMob (pub récompensée, bannière) via le plugin Capacitor @capacitor-community/admob ;
 *  - Google Play Billing (abonnement) via un plugin d'achats intégrés (par ex. RevenueCat).
 * Dans la version web de test, la pub est simulée et Premium s'active localement.
 */

export interface AdsService {
  /** Affiche une pub récompensée. Résout `true` si le joueur l'a regardée jusqu'au bout. */
  showRewarded(): Promise<boolean>;
}

export interface BillingService {
  purchase(plan: 'monthly' | 'yearly'): Promise<boolean>;
  restore(): Promise<boolean>;
}

export const ads: AdsService = {
  showRewarded: () => new Promise((resolve) => setTimeout(() => resolve(true), 2500)),
};

export const billing: BillingService = {
  purchase: async () => true,
  restore: async () => false,
};

/** Coûts en jetons. */
export const COST = { letter: 1, oracle: 1, word: 3 } as const;
export const REWARD = { daily: 3, level: 1, levelPerfect: 2, ad: 2, chest: [1, 2, 2, 3, 5] } as const;
