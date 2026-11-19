import { execSync } from 'node:child_process';
import fs from 'node:fs';
import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import { VitePWA } from 'vite-plugin-pwa';
import {
  formatarVersaoBuild,
  gerarCspProducao,
} from './src/plataforma/segurancaBuild';

function lerVersaoPackageJson(): string {
  try {
    const pkg = JSON.parse(fs.readFileSync('./package.json', 'utf-8')) as {
      version?: string;
    };
    return pkg.version || '1.0.0';
  } catch {
    return '1.0.0';
  }
}

function obterShaGitCurto(): string | null {
  try {
    return execSync('git rev-parse --short=7 HEAD', {
      stdio: ['ignore', 'pipe', 'ignore'],
    })
      .toString()
      .trim();
  } catch {
    return null;
  }
}

export default defineConfig(({ command, mode }) => {
  const viteModo =
    process.env.VITE_MODO ||
    (mode === 'desenvolvimento' || command === 'serve'
      ? 'desenvolvimento'
      : 'producao');

  const buildVersion = formatarVersaoBuild(
    lerVersaoPackageJson(),
    obterShaGitCurto()
  );
  const buildTimestamp = new Date().toISOString();
  const cspProducao = gerarCspProducao();

  return {
    base: './',
    define: {
      __BUILD_VERSION__: JSON.stringify(buildVersion),
      __BUILD_TIMESTAMP__: JSON.stringify(buildTimestamp),
      'import.meta.env.VITE_MODO': JSON.stringify(viteModo),
    },
    plugins: [
      preact(),
      {
        name: 'injetar-csp-e-versao-html',
        transformIndexHtml(html) {
          let resultado = html.replace(
            '</head>',
            `  <meta name="app-version" content="${buildVersion}" />\n  </head>`
          );
          if (viteModo === 'producao' && command === 'build') {
            resultado = resultado.replace(
              '<meta charset="UTF-8" />',
              `<meta charset="UTF-8" />\n    <meta http-equiv="Content-Security-Policy" content="${cspProducao}" />`
            );
          }
          return resultado;
        },
      },
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
          maximumFileSizeToCacheInBytes: 15 * 1024 * 1024,
          navigateFallback: 'index.html',
        },
      }),
    ],
  };
});
