import { Estado } from '../session/tipos';

// Estado do Modo de Ensaio: vive SOMENTE em memória e sempre começa DESLIGADO ao abrir o app
let ensaioAtivo = false;
const assinantesEnsaio = new Set<(ativo: boolean) => void>();

/**
 * Função pura: o Modo de Ensaio só pode ser ligado/desligado na fase "tcle" (tela inicial).
 */
export function podeAlternarEnsaio(estado: Estado): boolean {
  return estado.fase === 'tcle';
}

/**
 * Função pura de modelo de visão para a faixa fixa de alerta do Modo de Ensaio.
 * Retorna o texto do banner em todas as fases quando `modoEnsaio === true`, ou `null` quando desligado.
 */
export function bannerModoEnsaio(
  _estado: Estado,
  modoEnsaio: boolean
): string | null {
  if (!modoEnsaio) {
    return null;
  }
  return 'MODO DE ENSAIO — os dados não entram na coleta';
}

/**
 * Retorna se o Modo de Ensaio está ativo em memória no momento.
 */
export function obterModoEnsaio(): boolean {
  return ensaioAtivo;
}

/**
 * Define o estado do Modo de Ensaio em memória (somente permitido na fase "tcle").
 */
export function definirModoEnsaio(
  novoValor: boolean,
  estadoAtual?: Estado
): boolean {
  if (estadoAtual && !podeAlternarEnsaio(estadoAtual)) {
    return false;
  }
  ensaioAtivo = Boolean(novoValor);
  for (const cb of assinantesEnsaio) {
    cb(ensaioAtivo);
  }
  return true;
}

/**
 * Assina mudanças no estado em memória do Modo de Ensaio.
 */
export function assinarModoEnsaio(
  cb: (ativo: boolean) => void
): () => void {
  assinantesEnsaio.add(cb);
  return () => {
    assinantesEnsaio.delete(cb);
  };
}

/**
 * Reseta o Modo de Ensaio para desligado (auxiliar para testes automatizados).
 */
export function resetarModoEnsaioParaTestes(): void {
  ensaioAtivo = false;
  assinantesEnsaio.clear();
}
