export interface ResultadoOperacaoArquivo {
  ok: boolean;
  motivo?: string;
}

export interface ResultadoCompartilhamento {
  ok: boolean;
  cancelado?: boolean;
  nome?: string;
  mensagem?: string;
  motivo?: string;
}

export interface AncoraDownloadMinima {
  href: string;
  download: string;
  style?: { display?: string };
  click(): void;
  remove?(): void;
}

export interface DocumentDownloadMinimo {
  createElement(tag: 'a'): AncoraDownloadMinima;
  body?: {
    appendChild(el: AncoraDownloadMinima): void;
    removeChild?(el: AncoraDownloadMinima): void;
  };
}

export interface UrlDownloadMinima {
  createObjectURL(blob: Blob): string;
  revokeObjectURL(url: string): void;
}

export interface NavigatorCompartilharMinimo {
  canShare?: (data?: ShareData) => boolean;
  share?: (data?: ShareData) => Promise<void>;
  clipboard?: {
    writeText?: (texto: string) => Promise<void>;
  };
}

export interface DependenciasBaixar {
  document?: DocumentDownloadMinimo;
  URL?: UrlDownloadMinima;
  navigator?: NavigatorCompartilharMinimo;
  revogarAposMs?: number;
}

export const MIME_SHARE_CSV = 'text/csv';
export const MIME_SHARE_TXT = 'text/plain';
export const MIME_SHARE_XLSX =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

export type VarianteCompartilhamento = 1 | 2 | 3 | null;

export interface PreparoCompartilhamento {
  variante: VarianteCompartilhamento;
  modo: 'arquivo' | 'texto' | 'indisponivel';
  arquivo: File | null;
  nomeOriginal: string;
  textoCsvSemBom: string;
}

export interface ParametrosPrepararCompartilhamento {
  formato: 'csv' | 'xlsx';
  blobDownload: Blob;
  nomeOriginal: string;
  textoCsvSemBom: string;
  nav?: NavigatorCompartilharMinimo;
}

const REVOGAR_PADRAO_MS = 10_000;

function obterNavigator(
  nav?: NavigatorCompartilharMinimo
): NavigatorCompartilharMinimo | undefined {
  return (
    nav ??
    (typeof navigator !== 'undefined'
      ? (navigator as unknown as NavigatorCompartilharMinimo)
      : undefined)
  );
}

/**
 * Dispara o download local de um Blob criando um elemento `<a download>` e revogando a ObjectURL após ~10 s.
 * Nunca lança exceção; falhas retornam `{ ok: false, motivo }`.
 */
export function baixarArquivo(
  blob: Blob,
  nome: string,
  deps: DependenciasBaixar = {}
): ResultadoOperacaoArquivo {
  try {
    const doc =
      deps.document ??
      (typeof document !== 'undefined'
        ? (document as unknown as DocumentDownloadMinimo)
        : undefined);
    const urlApi =
      deps.URL ??
      (typeof URL !== 'undefined'
        ? (URL as unknown as UrlDownloadMinima)
        : undefined);

    if (
      !doc ||
      typeof doc.createElement !== 'function' ||
      !urlApi ||
      typeof urlApi.createObjectURL !== 'function'
    ) {
      return {
        ok: false,
        motivo: 'APIs de download do navegador indisponíveis.',
      };
    }

    const objectUrl = urlApi.createObjectURL(blob);
    const a = doc.createElement('a');
    a.href = objectUrl;
    a.download = nome;
    if (a.style) {
      a.style.display = 'none';
    }

    doc.body?.appendChild(a);
    a.click();

    if (typeof a.remove === 'function') {
      a.remove();
    } else if (doc.body?.removeChild) {
      doc.body.removeChild(a);
    }

    const atraso = deps.revogarAposMs ?? REVOGAR_PADRAO_MS;
    if (atraso <= 0) {
      urlApi.revokeObjectURL(objectUrl);
    } else {
      setTimeout(() => {
        try {
          urlApi.revokeObjectURL(objectUrl);
        } catch {
          // Ignora falha ao revogar
        }
      }, atraso);
    }

    return { ok: true };
  } catch (erro) {
    const motivo =
      erro instanceof Error ? erro.message : 'Falha ao iniciar download.';
    return { ok: false, motivo };
  }
}

/**
 * Verifica se o navegador suporta Web Share API para compartilhamento do arquivo gerado.
 * Nunca lança exceção.
 */
export function podeCompartilhar(
  arquivo: File,
  nav?: NavigatorCompartilharMinimo
): boolean {
  try {
    const n = obterNavigator(nav);
    if (
      !n ||
      typeof n.canShare !== 'function' ||
      typeof n.share !== 'function'
    ) {
      return false;
    }
    return Boolean(n.canShare({ files: [arquivo] }));
  } catch {
    return false;
  }
}

/**
 * Cria o File de compartilhamento UMA ÚNICA VEZ no momento da geração do arquivo
 * e escolhe a variante via `navigator.canShare` na ordem de preferência:
 *   1) File com MIME estrito ("text/csv" sem charset ou MIME oficial XLSX) e nome original;
 *   2) Para CSV: File com MIME "text/plain" e nome terminando em ".txt";
 *   3) Nenhuma variante de arquivo aceita -> modo "texto" (se `navigator.share` existir) ou "indisponivel".
 */
export function prepararCompartilhamento({
  formato,
  blobDownload,
  nomeOriginal,
  textoCsvSemBom,
  nav,
}: ParametrosPrepararCompartilhamento): PreparoCompartilhamento {
  const n = obterNavigator(nav);
  const temShare = Boolean(n && typeof n.share === 'function');

  if (typeof File !== 'undefined') {
    try {
      // Variante 1: MIME oficial estrito ("text/csv" sem ";charset=utf-8" ou MIME XLSX)
      const mimeV1 = formato === 'csv' ? MIME_SHARE_CSV : MIME_SHARE_XLSX;
      const fileV1 = new File([blobDownload], nomeOriginal, { type: mimeV1 });

      if (podeCompartilhar(fileV1, n)) {
        return {
          variante: 1,
          modo: 'arquivo',
          arquivo: fileV1,
          nomeOriginal,
          textoCsvSemBom,
        };
      }

      // Variante 2 (apenas para CSV): MIME "text/plain" com extensão ".txt"
      if (formato === 'csv') {
        const nomeTxt = nomeOriginal.replace(/\.csv$/i, '') + '.txt';
        const fileV2 = new File([blobDownload], nomeTxt, {
          type: MIME_SHARE_TXT,
        });
        if (podeCompartilhar(fileV2, n)) {
          return {
            variante: 2,
            modo: 'arquivo',
            arquivo: fileV2,
            nomeOriginal,
            textoCsvSemBom,
          };
        }
      }
    } catch {
      // Continua para avaliação da variante 3
    }
  }

  // Variante 3: nenhuma variante de arquivo possível, mas navigator.share existe para texto
  if (temShare) {
    return {
      variante: 3,
      modo: 'texto',
      arquivo: null,
      nomeOriginal,
      textoCsvSemBom,
    };
  }

  return {
    variante: null,
    modo: 'indisponivel',
    arquivo: null,
    nomeOriginal,
    textoCsvSemBom,
  };
}

function normalizarErroShare(erro: unknown): ResultadoCompartilhamento {
  const nome =
    erro &&
    typeof erro === 'object' &&
    'name' in erro &&
    typeof (erro as { name?: unknown }).name === 'string'
      ? (erro as { name: string }).name
      : 'Error';
  const mensagem =
    erro instanceof Error
      ? erro.message
      : erro &&
        typeof erro === 'object' &&
        'message' in erro &&
        typeof (erro as { message?: unknown }).message === 'string'
      ? (erro as { message: string }).message
      : String(erro);

  if (nome === 'AbortError') {
    return {
      ok: false,
      cancelado: true,
      nome,
      mensagem,
    };
  }

  return {
    ok: false,
    cancelado: false,
    nome,
    mensagem,
    motivo: `${nome} — ${mensagem}`,
  };
}

/**
 * Compartilha um File já criado chamando `navigator.share({ files: [arquivo] })` SINCRONAMENTE
 * no mesmo tick do gesto do usuário (sem await antes de `n.share(...)` e sem title/text).
 * Nunca lança exceção.
 */
export function compartilharArquivo(
  arquivo: File,
  nav?: NavigatorCompartilharMinimo
): Promise<ResultadoCompartilhamento> {
  const n = obterNavigator(nav);
  if (!n || typeof n.share !== 'function') {
    return Promise.resolve({
      ok: false,
      nome: 'NotSupportedError',
      mensagem: 'navigator.share não está disponível neste navegador.',
      motivo: 'Compartilhamento não suportado neste aparelho.',
    });
  }

  try {
    // Chamada SÍNCRONA a navigator.share no mesmo tick do handler de clique
    const promessaShare = n.share({ files: [arquivo] });
    return Promise.resolve(promessaShare).then(
      () => ({ ok: true }),
      (erro) => normalizarErroShare(erro)
    );
  } catch (erro) {
    return Promise.resolve(normalizarErroShare(erro));
  }
}

/**
 * Compartilha o conteúdo CSV (sem BOM) como texto puro (`{ title, text }`) chamando
 * `navigator.share` SINCRONAMENTE no mesmo tick do gesto do usuário (Variante 3).
 * Nunca lança exceção.
 */
export function compartilharTexto(
  titulo: string,
  textoSemBom: string,
  nav?: NavigatorCompartilharMinimo
): Promise<ResultadoCompartilhamento> {
  const n = obterNavigator(nav);
  if (!n || typeof n.share !== 'function') {
    return Promise.resolve({
      ok: false,
      nome: 'NotSupportedError',
      mensagem: 'navigator.share não está disponível neste navegador.',
      motivo: 'Compartilhamento não suportado neste aparelho.',
    });
  }

  try {
    // Chamada SÍNCRONA a navigator.share no mesmo tick do handler de clique
    const promessaShare = n.share({ title: titulo, text: textoSemBom });
    return Promise.resolve(promessaShare).then(
      () => ({ ok: true }),
      (erro) => normalizarErroShare(erro)
    );
  } catch (erro) {
    return Promise.resolve(normalizarErroShare(erro));
  }
}

/**
 * Tenta copiar o conteúdo CSV (sem BOM) para a área de transferência.
 * Retorna `true` se copiou via Clipboard API, ou `false` para que a UI exiba o `<textarea>` de fallback.
 * Nunca lança exceção.
 */
export async function copiarComoTexto(
  texto: string,
  nav?: NavigatorCompartilharMinimo
): Promise<boolean> {
  try {
    const n = obterNavigator(nav);
    if (!n?.clipboard || typeof n.clipboard.writeText !== 'function') {
      return false;
    }
    await n.clipboard.writeText(texto);
    return true;
  } catch {
    return false;
  }
}
