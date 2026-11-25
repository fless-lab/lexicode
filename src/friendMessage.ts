// Messages chiffrés entre amis : un joueur écrit une phrase, le jeu en fait une grille avec des mots
// et des indices déjà validés, et la transmet par un lien. Rien ne passe par le serveur.
import type { Lang, LangPack, Puzzle } from './engine/types';
import { generatePuzzle, difficultyForLength } from './engine/generator';
import { letterCount, norm, isAZ } from './engine/text';

export interface FriendMessage {
  /** Texte du message, tel qu'écrit. */
  t: string;
  /** Prénom ou pseudo de l'expéditeur. */
  f: string;
  /** Langue des mots indices. */
  l: Lang;
}

export const MSG_MAX = 80;
export const MSG_MIN_LETTERS = 8;
const LANGS: Lang[] = ['fr', 'en', 'es'];

/** Nettoie le texte saisi : espaces simples, caractères permis seulement (lettres, chiffres exclus, ponctuation courante). */
export function cleanMessage(raw: string): string {
  return raw
    .replace(/[^\p{L}\s'’,.!;:-]/gu, '')
    .replace(/\s+/g, ' ')
    .trimStart()
    .slice(0, MSG_MAX);
}

/** Raison du refus, ou null si le message peut être chiffré. */
export function messageProblem(text: string): 'short' | 'long' | null {
  const t = text.trim();
  if (t.length > MSG_MAX) return 'long';
  const n = letterCount(t);
  const distinct = new Set([...norm(t)].filter(isAZ)).size;
  if (n < MSG_MIN_LETTERS || distinct < 4) return 'short';
  return null;
}

/** La même grille chez l'expéditeur et chez l'ami : la graine vient du texte. */
export function messagePuzzle(pack: LangPack, m: FriendMessage): Puzzle {
  const text = m.t.trim();
  const one: LangPack = { ...pack, phrases: [{ t: text, k: 'message' }] };
  return generatePuzzle(one, `msg-${text}`, difficultyForLength(letterCount(text)), { phraseIndex: 0 });
}

const toB64 = (s: string) => btoa(String.fromCharCode(...new TextEncoder().encode(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const fromB64 = (s: string) => new TextDecoder().decode(Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0)));

export function encodeMessage(m: FriendMessage): string {
  return toB64(JSON.stringify({ t: m.t.trim(), f: m.f.slice(0, 24), l: m.l }));
}

/** Lit un message reçu par lien ; null s'il est abîmé ou ne respecte pas les règles. */
export function decodeMessage(code: string | null): FriendMessage | null {
  if (!code) return null;
  try {
    const o = JSON.parse(fromB64(code)) as Partial<FriendMessage>;
    if (typeof o.t !== 'string' || typeof o.f !== 'string' || !LANGS.includes(o.l as Lang)) return null;
    const t = cleanMessage(o.t).trim();
    if (messageProblem(t)) return null;
    return { t, f: cleanMessage(o.f).trim().slice(0, 24), l: o.l as Lang };
  } catch {
    return null;
  }
}
