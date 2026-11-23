// Écrit les paquets de langue précalculés que le jeu charge (src/content/packs/<langue>.json).
// Usage : npm run packs (lancé aussi avant npm run dev et npm run build).
import { writeFileSync, mkdirSync } from 'fs';
import { buildPacks } from '../src/content/build';

const dir = new URL('../src/content/packs/', import.meta.url);
mkdirSync(dir, { recursive: true });
for (const [lang, pack] of Object.entries(buildPacks())) {
  writeFileSync(new URL(`${lang}.json`, dir), JSON.stringify(pack) + '\n');
  console.log(`${lang} : ${pack.entries.length} mots, ${pack.phrases.length} phrases`);
}
