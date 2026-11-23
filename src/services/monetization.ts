import { Capacitor } from '@capacitor/core';
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

// Identifiants de test publiés par Google : ils affichent de vraies pubs de démonstration, sans revenu.
// Remplacés par les tiens via .env (VITE_ADMOB_REWARDED_ID) et AndroidManifest.xml (identifiant d'application).
const TEST_REWARDED = 'ca-app-pub-3940256099942544/5224354917';
const ENV = (import.meta as unknown as { env: Record<string, string | undefined> }).env;
const REWARDED_ID = ENV.VITE_ADMOB_REWARDED_ID || TEST_REWARDED;

type AM = typeof import('@capacitor-community/admob');
let admob: Promise<AM | null> | null = null;

/** Démarre AdMob une seule fois, avec le formulaire de consentement (RGPD) quand la loi l'exige. */
function getAdMob(): Promise<AM | null> {
  if (!Capacitor.isNativePlatform()) return Promise.resolve(null);
  if (!admob) {
    admob = (async () => {
      try {
        const m = await import('@capacitor-community/admob');
        await m.AdMob.initialize();
        const info = await m.AdMob.requestConsentInfo();
        if (info.isConsentFormAvailable && info.status === m.AdmobConsentStatus.REQUIRED) await m.AdMob.showConsentForm();
        return m;
      } catch {
        return null;
      }
    })();
  }
  return admob;
}

export const ads: AdsService = {
  async showRewarded() {
    const m = await getAdMob();
    if (!m) return new Promise((resolve) => setTimeout(() => resolve(true), 2500));
    try {
      await m.AdMob.prepareRewardVideoAd({ adId: REWARDED_ID, isTesting: REWARDED_ID === TEST_REWARDED });
      const reward = await m.AdMob.showRewardVideoAd();
      return !!reward && reward.amount > 0;
    } catch {
      return false;
    }
  },
};

export const billing: BillingService = {
  purchase: async () => true,
  restore: async () => false,
};

/** Coûts en jetons. */
export const COST = { letter: 1, oracle: 1, word: 3 } as const;
export const REWARD = { daily: 3, level: 1, levelPerfect: 2, ad: 2, chest: [1, 2, 2, 3, 5] } as const;
