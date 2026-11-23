/**
 * Achats intégrés. Sur Android, tout passe par RevenueCat, qui s'appuie sur Google Play Billing
 * et vérifie chaque reçu côté serveur. Dans la version web, les achats sont simulés pour l'essai.
 *
 * À configurer avant la publication (voir README, section Achats) :
 *  - VITE_RC_ANDROID_KEY : clé publique Android du projet RevenueCat ;
 *  - les identifiants de produits ci-dessous, créés à l'identique dans la Play Console ;
 *  - un droit (entitlement) RevenueCat nommé « plus » relié aux deux abonnements.
 */
import { Capacitor } from '@capacitor/core';

export type SkuKind = 'sub' | 'consumable' | 'permanent';

export interface Sku {
  id: string;
  kind: SkuKind;
  /** Prix affiché tant que le magasin n'a pas répondu (et dans la version web). */
  fallback: string;
}

export const SKUS = {
  plusMonthly: { id: 'lexicode_plus_monthly', kind: 'sub', fallback: '3,99 €' },
  plusYearly: { id: 'lexicode_plus_yearly', kind: 'sub', fallback: '29,99 €' },
  starter: { id: 'starter_pack', kind: 'permanent', fallback: '1,99 €' },
  tok120: { id: 'tokens_120', kind: 'consumable', fallback: '0,99 €' },
  tok650: { id: 'tokens_650', kind: 'consumable', fallback: '4,99 €' },
  tok1400: { id: 'tokens_1400', kind: 'consumable', fallback: '9,99 €' },
  outfitDetective: { id: 'outfit_detective', kind: 'permanent', fallback: '1,99 €' },
  outfitTophat: { id: 'outfit_tophat', kind: 'permanent', fallback: '1,99 €' },
  bundleGentleman: { id: 'bundle_gentleman', kind: 'permanent', fallback: '2,99 €' },
  loupeCrystal: { id: 'loupe_crystal', kind: 'permanent', fallback: '0,99 €' },
  skinRuby: { id: 'skin_ruby', kind: 'permanent', fallback: '0,99 €' },
  kbWood: { id: 'keyboard_wood', kind: 'permanent', fallback: '1,49 €' },
  kbNeon: { id: 'keyboard_neon', kind: 'permanent', fallback: '1,49 €' },
  fxFireworks: { id: 'effect_fireworks', kind: 'permanent', fallback: '0,99 €' },
  frameFlame: { id: 'frame_flame', kind: 'permanent', fallback: '0,99 €' },
  decorTrain: { id: 'decor_train', kind: 'permanent', fallback: '1,99 €' },
  packProverbs: { id: 'pack_proverbs', kind: 'permanent', fallback: '2,99 €' },
} as const satisfies Record<string, Sku>;

export type PurchaseResult = 'ok' | 'cancelled' | 'error';

const native = () => Capacitor.isNativePlatform();
const KEY = (import.meta as unknown as { env: Record<string, string | undefined> }).env.VITE_RC_ANDROID_KEY;

type RC = typeof import('@revenuecat/purchases-capacitor');
let rc: RC | null = null;
let ready: Promise<boolean> | null = null;
const prices: Record<string, string> = {};

async function plugin(): Promise<RC | null> {
  if (!native() || !KEY) return null;
  if (!ready) {
    ready = (async () => {
      try {
        rc = await import('@revenuecat/purchases-capacitor');
        await rc.Purchases.configure({ apiKey: KEY });
        return true;
      } catch {
        rc = null;
        return false;
      }
    })();
  }
  return (await ready) ? rc : null;
}

/** Charge les prix localisés du magasin (en devise et format du joueur). */
export async function loadPrices(): Promise<Record<string, string>> {
  const p = await plugin();
  if (!p) return prices;
  const all = Object.values(SKUS);
  for (const [type, list] of [
    [p.PRODUCT_CATEGORY.SUBSCRIPTION, all.filter((s) => s.kind === 'sub')],
    [p.PRODUCT_CATEGORY.NON_SUBSCRIPTION, all.filter((s) => s.kind !== 'sub')],
  ] as const) {
    try {
      const { products } = await p.Purchases.getProducts({ productIdentifiers: list.map((s) => s.id), type });
      for (const pr of products) prices[pr.identifier.split(':')[0]] = pr.priceString;
    } catch {
      /* magasin injoignable : on garde les prix de secours */
    }
  }
  return prices;
}

export function priceOf(sku: Sku): string {
  return prices[sku.id] ?? sku.fallback;
}

/** Achète un produit. Ne crédite rien : l'appelant accorde le contenu si le résultat est « ok ». */
export async function buy(sku: Sku): Promise<PurchaseResult> {
  const p = await plugin();
  if (!p) {
    // Version web : achat simulé, pour essayer la boutique sans payer.
    await new Promise((r) => setTimeout(r, 700));
    return 'ok';
  }
  try {
    const type = sku.kind === 'sub' ? p.PRODUCT_CATEGORY.SUBSCRIPTION : p.PRODUCT_CATEGORY.NON_SUBSCRIPTION;
    const { products } = await p.Purchases.getProducts({ productIdentifiers: [sku.id], type });
    if (!products[0]) return 'error';
    await p.Purchases.purchaseStoreProduct({ product: products[0] });
    return 'ok';
  } catch (e) {
    return (e as { userCancelled?: boolean })?.userCancelled ? 'cancelled' : 'error';
  }
}

/** Ce que le magasin sait déjà : abonnement actif et achats définitifs (pour restaurer sur un nouveau téléphone). */
export async function entitlements(): Promise<{ plus: boolean; permanent: string[] } | null> {
  const p = await plugin();
  if (!p) return null;
  try {
    const { customerInfo } = await p.Purchases.getCustomerInfo();
    return {
      plus: !!customerInfo.entitlements.active['plus'],
      permanent: customerInfo.nonSubscriptionTransactions.map((t) => t.productIdentifier),
    };
  } catch {
    return null;
  }
}

export async function restore(): Promise<{ plus: boolean; permanent: string[] } | null> {
  const p = await plugin();
  if (!p) return null;
  try {
    await p.Purchases.restorePurchases();
  } catch {
    return null;
  }
  return entitlements();
}

export const isDemoStore = () => !native() || !KEY;
