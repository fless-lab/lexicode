import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

// SINGLE=1 produit un seul fichier HTML autonome (aperçu partageable).
// Le build normal sert à Capacitor pour l'application Android.
const single = process.env.SINGLE === '1';

export default defineConfig({
  base: './',
  plugins: single ? [react(), viteSingleFile()] : [react()],
  build: { outDir: single ? 'dist-single' : 'dist' },
});
