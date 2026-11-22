/** Retire les accents et passe en majuscules : "é" devient "E". */
export function norm(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase();
}

export function isAZ(c: string): boolean {
  return c.length === 1 && c >= 'A' && c <= 'Z';
}

/** Lettres distinctes A-Z d'un texte. */
export function letterSet(s: string): Set<string> {
  const out = new Set<string>();
  for (const ch of norm(s)) if (isAZ(ch)) out.add(ch);
  return out;
}

export function letterCount(s: string): number {
  let n = 0;
  for (const ch of norm(s)) if (isAZ(ch)) n++;
  return n;
}
