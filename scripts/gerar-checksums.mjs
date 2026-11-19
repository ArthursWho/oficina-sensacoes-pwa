import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Calcula o mapa de checksums SHA-256 dos arquivos `.mp3` presentes em `audioDir`.
 */
export function calcularChecksumsDiretorio(audioDir) {
  if (!fs.existsSync(audioDir)) {
    throw new Error(`Diretório de áudio não encontrado: ${audioDir}`);
  }
  const arquivos = fs
    .readdirSync(audioDir)
    .filter((f) => f.toLowerCase().endsWith('.mp3'))
    .sort();

  const resultado = [];
  for (const nome of arquivos) {
    const caminho = path.join(audioDir, nome);
    const buffer = fs.readFileSync(caminho);
    const hash = crypto.createHash('sha256').update(buffer).digest('hex');
    resultado.push({ nome, hash });
  }
  return resultado;
}

/**
 * Formata a lista de `{ nome, hash }` no padrão `<hash>  <nome>` (um por linha).
 */
export function formatarArquivoChecksums(lista) {
  return lista.map((item) => `${item.hash}  ${item.nome}`).join('\n') + '\n';
}

// Execução direta via CLI
const isMain =
  process.argv[1] &&
  path.resolve(process.argv[1]) ===
    path.resolve(fileURLToPath(import.meta.url));

if (isMain) {
  const raiz = process.cwd();
  const audioDir = path.join(raiz, 'public', 'audio');
  const docsDir = path.join(raiz, 'docs');
  const destino = path.join(docsDir, 'audio-sha256.txt');

  fs.mkdirSync(docsDir, { recursive: true });
  const lista = calcularChecksumsDiretorio(audioDir);
  if (lista.length !== 13) {
    console.error(
      `[ERRO] Esperados 13 arquivos MP3 em public/audio/, encontrados ${lista.length}.`
    );
    process.exit(1);
  }

  fs.writeFileSync(destino, formatarArquivoChecksums(lista), 'utf-8');
  console.log(
    `[OK] Checksums SHA-256 gerados para ${lista.length} arquivos em docs/audio-sha256.txt.`
  );
}
