import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

// SINGLE=1 produit un seul fichier HTML autonome (aperçu partageable).
// Le build normal sert à Capacitor pour l'application Android.
const single = process.env.SINGLE === '1';

/**
 * Écrit dans sw.js la liste des fichiers du build (pré-cachés à l'installation) et une version
 * tirée de leur contenu. Les .woff sont laissés de côté : les navigateurs visés prennent les .woff2.
 */
function precacheList(): Plugin {
  let outDir = 'dist';
  let publicDir = 'public';
  return {
    name: 'lexicode-precache',
    apply: 'build',
    configResolved(c) {
      outDir = path.resolve(c.root, c.build.outDir);
      publicDir = c.publicDir;
    },
    writeBundle(_, bundle) {
      const files = Object.keys(bundle);
      const sw = path.join(outDir, 'sw.js');
      if (!fs.existsSync(sw)) return;
      const pub = publicDir && fs.existsSync(publicDir) ? fs.readdirSync(publicDir, { recursive: true, withFileTypes: true }).filter((d) => d.isFile()).map((d) => path.relative(publicDir, path.join(d.parentPath, d.name))) : [];
      const list = [...new Set([...files, ...pub])].map((f) => f.split(path.sep).join('/')).filter((f) => f !== 'sw.js' && !f.endsWith('.map') && !f.endsWith('.woff') && fs.existsSync(path.join(outDir, f)))
        .sort();
      const hash = createHash('sha256');
      for (const f of list) hash.update(f).update(fs.readFileSync(path.join(outDir, f)));
      const build = { version: hash.digest('hex').slice(0, 12), files: ['./', ...list.map((f) => `./${f}`)] };
      const src = fs.readFileSync(sw, 'utf8');
      const next = src.replace(/\/\*__BUILD__\*\/ \{[^\n]*\};/, `/*__BUILD__*/ ${JSON.stringify(build)};`);
      if (next === src) throw new Error('sw.js : marqueur /*__BUILD__*/ introuvable');
      fs.writeFileSync(sw, next);
    },
  };
}

export default defineConfig({
  base: './',
  plugins: single ? [react(), viteSingleFile(), precacheList()] : [react(), precacheList()],
  build: { outDir: single ? 'dist-single' : 'dist' },
});
