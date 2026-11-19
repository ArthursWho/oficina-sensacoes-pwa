// Utilitários puros para CSP (Content-Security-Policy) e formatação da versão de build

export const DIRETIVAS_CSP_PRODUCAO: readonly string[] = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "media-src 'self' blob:",
  "connect-src 'self'",
  "worker-src 'self'",
  "manifest-src 'self'",
  "font-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'none'",
] as const;

/**
 * Gera a string completa da política Content-Security-Policy para o build de produção.
 * Nunca inclui `'unsafe-eval'`.
 */
export function gerarCspProducao(): string {
  return DIRETIVAS_CSP_PRODUCAO.join('; ') + ';';
}

/**
 * Formata a constante de versão do build no padrão "<versao>+<sha>" (ou "<versao>+sem-git").
 */
export function formatarVersaoBuild(
  versaoPkg: string,
  shaGit?: string | null
): string {
  const versaoLimpa = (versaoPkg || '1.0.0').trim();
  const shaLimpo = (shaGit || '').trim();
  const sufixo = /^[0-9a-f]{7,40}$/i.test(shaLimpo)
    ? shaLimpo.slice(0, 7).toLowerCase()
    : 'sem-git';
  return `${versaoLimpa}+${sufixo}`;
}
