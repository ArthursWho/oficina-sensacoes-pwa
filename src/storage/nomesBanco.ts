// Nomes dos bancos IndexedDB por modo de operação
// NÃO ALTERE o nome de produção depois do início da coleta: mudar o nome esconde as sessões já gravadas

export type ModoBuild = 'producao' | 'desenvolvimento';

// NÃO ALTERE o nome de produção depois do início da coleta: mudar o nome esconde as sessões já gravadas
export const NOME_BANCO_PRODUCAO = 'mundo-utero-coleta' as const;

export const NOME_BANCO_ENSAIO = 'mundo-utero-ensaio' as const;

export const NOME_BANCO_DESENVOLVIMENTO = 'mundo-utero-dev' as const;

/**
 * Determina o modo de build atual a partir de `import.meta.env.VITE_MODO`.
 */
export function obterModoBuildAtual(): ModoBuild {
  const modoEnv =
    typeof import.meta !== 'undefined' &&
    import.meta.env &&
    typeof import.meta.env.VITE_MODO === 'string'
      ? import.meta.env.VITE_MODO
      : undefined;
  return modoEnv === 'producao' ? 'producao' : 'desenvolvimento';
}

/**
 * Função pura que retorna o nome do banco IndexedDB ativo conforme o modo de build e o modo de ensaio.
 * Quando `modoEnsaio` é true, sempre usa "mundo-utero-ensaio" (isolando os dados de teste da coleta real).
 */
export function nomeBancoAtivo(
  modoBuild: ModoBuild,
  modoEnsaio: boolean
): string {
  if (modoEnsaio) {
    return NOME_BANCO_ENSAIO;
  }
  return modoBuild === 'producao'
    ? NOME_BANCO_PRODUCAO
    : NOME_BANCO_DESENVOLVIMENTO;
}
