import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { calcularChecksumsDiretorio } from './gerar-checksums.mjs';

export const MP3_ESPERADOS = [
  'audio/01_cheia_de_manias_editado.mp3',
  'audio/01_cheia_de_manias_original.mp3',
  'audio/02_three_little_birds_editado.mp3',
  'audio/02_three_little_birds_original.mp3',
  'audio/03_anunciacao_editado.mp3',
  'audio/03_anunciacao_original.mp3',
  'audio/04_evidencias_editado.mp3',
  'audio/04_evidencias_original.mp3',
  'audio/05_take_on_me_editado.mp3',
  'audio/05_take_on_me_original.mp3',
  'audio/06_thriller_editado.mp3',
  'audio/06_thriller_original.mp3',
  'audio/batimentos.mp3',
];

export const NOMES_LABORATORIO_PROIBIDOS = [
  'audio-lab',
  'sessao-lab',
  'armazenamento-lab',
  'compartilhar-lab',
  '#componentes',
  'GaleriaComponentes',
  'AudioLab',
  'SessaoLab',
  'ArmazenamentoLab',
  'CompartilharLab',
  'TelaDiagnostico',
];

// Exceções inofensivas de URLs externas presentes nos pacotes de terceiros (namespaces XML/OOXML/ODF da SheetJS e link de erro do Workbox)
export const PREFIXOS_URLS_PERMITIDAS = [
  'http://www.w3.org/',
  'https://www.w3.org/',
  'http://schemas.openxmlformats.org/',
  'http://sheetjs.openxmlformats.org/',
  'http://schemas.microsoft.com/',
  'http://purl.org/',
  'http://purl.oclc.org/',
  'http://ns.adobe.com/',
  'http://docs.oasis-open.org/',
  'http://openoffice.org/',
  'http://macVmlSchemaUri',
  'https://sheetjs.com',
  'http://sheetjs.com',
  'https://bit.ly/wb-precache',
];

/**
 * (a) Verifica se o conteúdo de `sw.js` inclui os 13 MP3s, index.html, manifest.webmanifest, os 3 ícones e o chunk lazy XLSX.
 */
export function verificarPrecacheSw(conteudoSw) {
  const erros = [];
  for (const mp3 of MP3_ESPERADOS) {
    if (!conteudoSw.includes(`"${mp3}"`)) {
      erros.push(`MP3 ausente do pré-cache do sw.js: ${mp3}`);
    }
  }
  const obrigatorios = [
    'index.html',
    'manifest.webmanifest',
    'icons/icon-192.png',
    'icons/icon-512.png',
    'icons/icon-512-maskable.png',
  ];
  for (const item of obrigatorios) {
    if (!conteudoSw.includes(`"${item}"`)) {
      erros.push(`Asset obrigatório ausente do pré-cache do sw.js: ${item}`);
    }
  }
  if (!/assets\/xlsx-[A-Za-z0-9_-]+\.js/.test(conteudoSw)) {
    erros.push('Chunk lazy da biblioteca XLSX ausente do pré-cache do sw.js.');
  }

  // Conta entradas únicas de url:"..." no precacheAndRoute
  const matches = conteudoSw.match(/url:"[^"]+"/g) || [];
  const urlsUnicas = new Set(matches);

  return {
    ok: erros.length === 0,
    erros,
    totalEntradasPrecache: urlsUnicas.size,
  };
}

/**
 * (b) Verifica se os bundles do `dist` não contêm nenhum nome ou rota de laboratório.
 */
export function verificarAusenciaLaboratorios(textosArquivosDist) {
  const erros = [];
  for (const { arquivo, conteudo } of textosArquivosDist) {
    for (const termo of NOMES_LABORATORIO_PROIBIDOS) {
      if (conteudo.includes(termo)) {
        erros.push(
          `Código/rota de laboratório ("${termo}") encontrado no bundle de produção: ${arquivo}`
        );
      }
    }
  }
  return {
    ok: erros.length === 0,
    erros,
  };
}

/**
 * (c) Verifica se o `index.html` de produção contém a CSP (sem unsafe-eval), meta robots e meta app-version.
 */
export function verificarIndexHtmlProducao(html) {
  const erros = [];
  if (!html.includes('http-equiv="Content-Security-Policy"')) {
    erros.push('Meta tag Content-Security-Policy ausente no dist/index.html.');
  }
  if (html.includes('unsafe-eval')) {
    erros.push("A CSP não pode conter 'unsafe-eval'.");
  }
  const diretivasObrigatorias = [
    "default-src 'self'",
    "script-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'none'",
  ];
  for (const dir of diretivasObrigatorias) {
    if (!html.includes(dir)) {
      erros.push(`Diretiva CSP obrigatória ausente no index.html: ${dir}`);
    }
  }
  if (!html.includes('name="robots" content="noindex,nofollow"')) {
    erros.push('Meta tag robots="noindex,nofollow" ausente no dist/index.html.');
  }
  const matchVersao = /name="app-version"\s+content="([^"]+)"/.exec(html);
  if (!matchVersao || !matchVersao[1]) {
    erros.push('Meta tag app-version ausente no dist/index.html.');
  }

  return {
    ok: erros.length === 0,
    erros,
    versao: matchVersao ? matchVersao[1] : null,
  };
}

/**
 * (e) Verifica se há URLs externas (`http://` ou `https://`) fora da lista de namespaces inofensivos.
 */
export function verificarUrlsExternas(textosArquivosDist) {
  const erros = [];
  const regexUrl = /https?:\/\/[A-Za-z0-9._~:/?#[\]@!$&'()*+,;=-]+/g;

  for (const { arquivo, conteudo } of textosArquivosDist) {
    const encontradas = conteudo.match(regexUrl) || [];
    for (const url of encontradas) {
      const permitida = PREFIXOS_URLS_PERMITIDAS.some((pref) =>
        url.startsWith(pref)
      );
      if (!permitida) {
        erros.push(`URL externa não permitida em ${arquivo}: ${url}`);
      }
    }
  }

  return {
    ok: erros.length === 0,
    erros,
  };
}

/**
 * (f) Verifica os campos obrigatórios do `manifest.webmanifest`.
 */
export function verificarManifest(manifestObj) {
  const erros = [];
  if (manifestObj?.name !== 'O Mundo a Partir do Útero') {
    erros.push('manifest.name inválido ou ausente.');
  }
  if (manifestObj?.short_name !== 'Útero') {
    erros.push('manifest.short_name inválido ou ausente.');
  }
  if (
    !Array.isArray(manifestObj?.display_override) ||
    !manifestObj.display_override.includes('fullscreen') ||
    !manifestObj.display_override.includes('standalone')
  ) {
    erros.push('manifest.display_override deve conter fullscreen e standalone.');
  }

  const icons = Array.isArray(manifestObj?.icons) ? manifestObj.icons : [];
  const tem192 = icons.some((i) => i.sizes === '192x192');
  const tem512 = icons.some(
    (i) => i.sizes === '512x512' && i.purpose === 'any'
  );
  const temMaskable = icons.some(
    (i) => i.sizes === '512x512' && i.purpose === 'maskable'
  );

  if (!tem192) erros.push('Ícone 192x192 ausente no manifest.');
  if (!tem512) erros.push('Ícone 512x512 (any) ausente no manifest.');
  if (!temMaskable) erros.push('Ícone 512x512 (maskable) ausente no manifest.');

  return {
    ok: erros.length === 0,
    erros,
  };
}

/**
 * (g) Compara a lista atual de `{ nome, hash }` com o conteúdo de `docs/audio-sha256.txt`.
 */
export function compararChecksumsAudio(checksumsAtuais, textoArquivoEsperado) {
  const erros = [];
  const linhas = textoArquivoEsperado
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const mapaEsperado = new Map();
  for (const linha of linhas) {
    const partes = linha.split(/\s+/);
    if (partes.length >= 2) {
      mapaEsperado.set(partes[1], partes[0]);
    }
  }

  const mapaAtual = new Map();
  for (const item of checksumsAtuais) {
    mapaAtual.set(item.nome, item.hash);
  }

  for (const [nome, hashEsperado] of mapaEsperado.entries()) {
    if (!mapaAtual.has(nome)) {
      erros.push(`Arquivo de áudio ausente: ${nome}`);
    } else if (mapaAtual.get(nome) !== hashEsperado) {
      erros.push(
        `Checksum SHA-256 alterado para ${nome} (esperado ${hashEsperado}, atual ${mapaAtual.get(nome)})`
      );
    }
  }

  for (const nome of mapaAtual.keys()) {
    if (!mapaEsperado.has(nome)) {
      erros.push(`Arquivo de áudio extra não registrado: ${nome}`);
    }
  }

  return {
    ok: erros.length === 0,
    erros,
  };
}

/**
 * (h) Verifica ausência de "(provisório)" nos arquivos de UI do fluxo real e ausência de "[PENDENTE]" fora de `src/content/tcle.ts`.
 * Os campos entre colchetes do TCLE em `src/content/tcle.ts` são explicitamente tolerados.
 */
export function verificarTextosProvisoriosEPendentes(arquivosFonte) {
  const erros = [];
  for (const { caminhoRelativo, conteudo } of arquivosFonte) {
    const norm = caminhoRelativo.replace(/\\/g, '/');
    const ehTeste = norm.endsWith('.test.ts');
    const ehLab =
      norm.endsWith('Lab.tsx') ||
      norm.endsWith('GaleriaComponentes.tsx') ||
      norm.endsWith('TelaDiagnostico.tsx');

    // Remove comentários antes de inspecionar
    const semComentarios = conteudo
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/.*/g, '');

    if (!ehTeste && !ehLab && norm.startsWith('src/ui/')) {
      if (/\(provis[oó]rio\)/i.test(semComentarios)) {
        erros.push(
          `Texto "(provisório)" encontrado na UI do fluxo real: ${norm}`
        );
      }
    }

    if (!ehTeste && norm !== 'src/content/tcle.ts') {
      if (/\[PENDENTE\]/i.test(semComentarios)) {
        erros.push(`Marcador "[PENDENTE]" encontrado fora de tcle.ts: ${norm}`);
      }
    }
  }

  return {
    ok: erros.length === 0,
    erros,
  };
}

function listarArquivosRecursivo(dir) {
  const lista = [];
  if (!fs.existsSync(dir)) return lista;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      lista.push(...listarArquivosRecursivo(p));
    } else {
      lista.push(p);
    }
  }
  return lista;
}

// Execução direta via CLI
const isMain =
  process.argv[1] &&
  path.resolve(process.argv[1]) ===
    path.resolve(fileURLToPath(import.meta.url));

if (isMain) {
  const raiz = process.cwd();
  const distDir = path.join(raiz, 'dist');
  const errosTotais = [];

  if (!fs.existsSync(distDir)) {
    console.error('[ERRO verificar:dist] Pasta dist/ não encontrada. Rode npm run build primeiro.');
    process.exit(1);
  }

  // (a) sw.js
  const swPath = path.join(distDir, 'sw.js');
  let totalPrecache = 0;
  if (!fs.existsSync(swPath)) {
    errosTotais.push('Arquivo dist/sw.js não encontrado.');
  } else {
    const resSw = verificarPrecacheSw(fs.readFileSync(swPath, 'utf-8'));
    totalPrecache = resSw.totalEntradasPrecache;
    errosTotais.push(...resSw.erros);
  }

  // Coleta arquivos JS/CSS/HTML do dist
  const todosArquivosDist = listarArquivosRecursivo(distDir);
  let tamanhoTotalBytes = 0;
  const textosDist = [];
  for (const arq of todosArquivosDist) {
    tamanhoTotalBytes += fs.statSync(arq).size;
    if (/\.(js|css|html|webmanifest)$/i.test(arq)) {
      textosDist.push({
        arquivo: path.relative(distDir, arq),
        conteudo: fs.readFileSync(arq, 'utf-8'),
      });
    }
  }

  // (b) Ausência de laboratórios no dist
  const resLabs = verificarAusenciaLaboratorios(textosDist);
  errosTotais.push(...resLabs.erros);

  // (c) index.html (CSP, meta robots, versão)
  const indexPath = path.join(distDir, 'index.html');
  let versaoDetectada = 'desconhecida';
  if (!fs.existsSync(indexPath)) {
    errosTotais.push('Arquivo dist/index.html não encontrado.');
  } else {
    const resIdx = verificarIndexHtmlProducao(
      fs.readFileSync(indexPath, 'utf-8')
    );
    if (resIdx.versao) versaoDetectada = resIdx.versao;
    errosTotais.push(...resIdx.erros);
  }

  // (d) robots.txt
  const robotsPath = path.join(distDir, 'robots.txt');
  if (!fs.existsSync(robotsPath)) {
    errosTotais.push('Arquivo dist/robots.txt não encontrado.');
  } else {
    const txtRobots = fs.readFileSync(robotsPath, 'utf-8');
    if (!txtRobots.includes('Disallow: /')) {
      errosTotais.push('dist/robots.txt não contém "Disallow: /".');
    }
  }

  // (e) URLs externas
  const resUrls = verificarUrlsExternas(textosDist);
  errosTotais.push(...resUrls.erros);

  // (f) manifest.webmanifest
  const manifestPath = path.join(distDir, 'manifest.webmanifest');
  if (!fs.existsSync(manifestPath)) {
    errosTotais.push('Arquivo dist/manifest.webmanifest não encontrado.');
  } else {
    const objManifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
    const resMan = verificarManifest(objManifest);
    errosTotais.push(...resMan.erros);
  }

  // (g) Checksums SHA-256 dos 13 MP3s
  const shaPath = path.join(raiz, 'docs', 'audio-sha256.txt');
  if (!fs.existsSync(shaPath)) {
    errosTotais.push('Arquivo docs/audio-sha256.txt não encontrado.');
  } else {
    const atuaisPublic = calcularChecksumsDiretorio(
      path.join(raiz, 'public', 'audio')
    );
    const atuaisDist = calcularChecksumsDiretorio(
      path.join(distDir, 'audio')
    );
    const esperadoTxt = fs.readFileSync(shaPath, 'utf-8');
    errosTotais.push(
      ...compararChecksumsAudio(atuaisPublic, esperadoTxt).erros
    );
    errosTotais.push(...compararChecksumsAudio(atuaisDist, esperadoTxt).erros);
  }

  // (h) Verificação de textos provisórios/pendentes em src/
  const arquivosSrc = listarArquivosRecursivo(path.join(raiz, 'src'))
    .filter((p) => /\.(ts|tsx)$/.test(p))
    .map((p) => ({
      caminhoRelativo: path.relative(raiz, p),
      conteudo: fs.readFileSync(p, 'utf-8'),
    }));
  const resFontes = verificarTextosProvisoriosEPendentes(arquivosSrc);
  errosTotais.push(...resFontes.erros);

  if (errosTotais.length > 0) {
    console.error(
      `\n[FALHA verificar:dist] Encontrados ${errosTotais.length} erro(s) no pacote de produção:`
    );
    for (const e of errosTotais) {
      console.error(`  - ${e}`);
    }
    process.exit(1);
  }

  const tamanhoMb = (tamanhoTotalBytes / (1024 * 1024)).toFixed(2);
  console.log('\n=== Resumo da Verificação do Pacote de Produção (verificar:dist) ===');
  console.log(`  Versão do build          : ${versaoDetectada}`);
  console.log(`  Arquivos no pré-cache SW : ${totalPrecache}`);
  console.log(`  Tamanho total de dist/   : ${tamanhoMb} MB (${todosArquivosDist.length} arquivos)`);
  console.log('  Laboratórios eliminados  : SIM (0 referências em dist/)');
  console.log('  CSP + robots.txt + SHA256: OK');
  console.log('====================================================================\n');
}
