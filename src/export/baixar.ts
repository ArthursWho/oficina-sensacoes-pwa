export interface ResultadoOperacaoArquivo {
  ok: boolean;
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

const REVOGAR_PADRAO_MS = 10_000;

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
    const n =
      nav ??
      (typeof navigator !== 'undefined'
        ? (navigator as unknown as NavigatorCompartilharMinimo)
        : undefined);
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
 * Compartilha um arquivo via Web Share API (deve ser chamado dentro de gesto do usuário).
 * Nunca lança exceção.
 */
export async function compartilharArquivo(
  arquivo: File,
  nav?: NavigatorCompartilharMinimo
): Promise<ResultadoOperacaoArquivo> {
  try {
    const n =
      nav ??
      (typeof navigator !== 'undefined'
        ? (navigator as unknown as NavigatorCompartilharMinimo)
        : undefined);
    if (!n || typeof n.share !== 'function' || !podeCompartilhar(arquivo, n)) {
      return {
        ok: false,
        motivo: 'Compartilhamento de arquivos não suportado neste aparelho.',
      };
    }
    await n.share({
      files: [arquivo],
      title: arquivo.name,
    });
    return { ok: true };
  } catch (erro) {
    const motivo =
      erro instanceof Error ? erro.message : 'Compartilhamento cancelado ou falhou.';
    return { ok: false, motivo };
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
    const n =
      nav ??
      (typeof navigator !== 'undefined'
        ? (navigator as unknown as NavigatorCompartilharMinimo)
        : undefined);
    if (!n?.clipboard || typeof n.clipboard.writeText !== 'function') {
      return false;
    }
    await n.clipboard.writeText(texto);
    return true;
  } catch {
    return false;
  }
}
