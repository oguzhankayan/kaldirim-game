import { defineConfig } from 'vitest/config';

const indexLanguage = (mode: string) => ({
  name: 'kaldirim-index-language',
  transformIndexHtml(html: string) {
    if (mode !== 'crazygames') return html;
    return html
      .replace('lang="tr"', 'lang="en"')
      .replace('Kaldırım: Taş Döşeme Simülatörü. Bir taşla başla, bütün sokağı döşe. Sakin bir birinci şahıs kaldırım döşeme oyunu.', 'Kaldırım: Paving Simulator. Start with one stone, pave the whole street. A calm first-person paving game.')
      .replace('<title>Kaldırım: Taş Döşeme Simülatörü</title>', '<title>Kaldırım: Paving Simulator</title>')
      .replace('Sokak hazırlanıyor…', 'Preparing the street…');
  },
});

export default defineConfig(({ mode }) => ({
  base: './',
  plugins: [indexLanguage(mode)],
  define: { __BUILD_DATE__: JSON.stringify(new Date().toISOString()) },
  // CrazyGames takes loose files only (no archives), so the portal build is one flat folder.
  build: { target: 'es2022', assetsDir: mode === 'crazygames' ? '' : 'assets', chunkSizeWarningLimit: 750, rollupOptions: { output: { manualChunks: { three: ['three'], physics: ['@dimforge/rapier3d-compat'] } } } },
  test: { include: ['tests/**/*.test.ts'], environment: 'node' },
}));
