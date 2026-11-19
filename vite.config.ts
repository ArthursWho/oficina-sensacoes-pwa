import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import { VitePWA } from 'vite-plugin-pwa';

// Data e hora do build em formato legível (fuso horário local/ISO)
const buildVersion = new Date().toISOString().replace('T', ' ').slice(0, 19) + ' UTC';

export default defineConfig({
  base: './',
  define: {
    __BUILD_VERSION__: JSON.stringify(buildVersion),
  },
  plugins: [
    preact(),
    VitePWA({
      registerType: 'prompt',
      includeManifestIcons: false,
      manifest: {
        name: 'O Mundo a Partir do Útero',
        short_name: 'Útero',
        description: 'Oficina de Sensação e Percepção - Psicologia UNIVILLE',
        lang: 'pt-BR',
        start_url: './',
        scope: './',
        display: 'fullscreen',
        display_override: ['fullscreen', 'standalone'],
        orientation: 'any',
        background_color: '#1a0508',
        theme_color: '#1a0508',
        icons: [
          {
            src: 'icons/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: 'icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: 'icons/icon-512-maskable.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{mp3,html,js,css,svg,png,ico,webmanifest}'],
        maximumFileSizeToCacheInBytes: 15 * 1024 * 1024, // 15 MB por arquivo para garantir pré-cache de todos os áudios
        navigateFallback: 'index.html',
      },
    }),
  ],
});
