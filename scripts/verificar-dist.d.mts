export const MP3_ESPERADOS: string[];
export const NOMES_LABORATORIO_PROIBIDOS: string[];
export const PREFIXOS_URLS_PERMITIDAS: string[];

export function verificarPrecacheSw(conteudoSw: string): {
  ok: boolean;
  erros: string[];
  totalEntradasPrecache: number;
};

export function verificarAusenciaLaboratorios(
  textosArquivosDist: Array<{ arquivo: string; conteudo: string }>
): { ok: boolean; erros: string[] };

export function verificarIndexHtmlProducao(html: string): {
  ok: boolean;
  erros: string[];
  versao: string | null;
};

export function verificarUrlsExternas(
  textosArquivosDist: Array<{ arquivo: string; conteudo: string }>
): { ok: boolean; erros: string[] };

export function verificarManifest(manifestObj: unknown): {
  ok: boolean;
  erros: string[];
};

export function compararChecksumsAudio(
  checksumsAtuais: Array<{ nome: string; hash: string }>,
  textoArquivoEsperado: string
): { ok: boolean; erros: string[] };

export function verificarTextosProvisoriosEPendentes(
  arquivosFonte: Array<{ caminhoRelativo: string; conteudo: string }>
): { ok: boolean; erros: string[] };
