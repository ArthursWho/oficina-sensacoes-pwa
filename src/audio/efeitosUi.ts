import { audioEngine } from './AudioEngine';
import { DescritorTomUi, SOM_CONFIRMAR, SOM_LIBERADO } from './config';
import { VisaoCiclo } from '../session/visao';

export type NomeEfeitoUi = 'confirmar' | 'liberado';

export interface EngineTocarTomMinimo {
  tocarTom(desc: DescritorTomUi): boolean;
}

let efeitosUiAtivos = true;
const assinantesPreferencia = new Set<(ativo: boolean) => void>();

/**
 * Define em memória o estado da preferência de sons da interface e notifica a UI.
 */
export function definirPreferenciaEfeitosUi(ativo: boolean): void {
  efeitosUiAtivos = Boolean(ativo);
  for (const cb of assinantesPreferencia) {
    cb(efeitosUiAtivos);
  }
}

/**
 * Retorna se os sons sutis da interface estão habilitados.
 */
export function obterPreferenciaEfeitosUi(): boolean {
  return efeitosUiAtivos;
}

/**
 * Assina mudanças na preferência de sons da interface.
 */
export function assinarPreferenciaEfeitosUi(
  cb: (ativo: boolean) => void
): () => void {
  assinantesPreferencia.add(cb);
  return () => {
    assinantesPreferencia.delete(cb);
  };
}

/**
 * Função pura que detecta se os controles de uma pergunta acabaram de ser liberados na Tela 3.
 * Retorna true APENAS na transição de `pergunta` ausente (em uma visão de ciclo ativa sem interrupção)
 * para `pergunta` presente (sem interrupção).
 * Retorna false em re-renderizações da mesma pergunta, após Retomar/interrupção ou fora do ciclo.
 */
export function houveLiberacao(
  visaoAnterior: VisaoCiclo | null,
  visaoNova: VisaoCiclo | null
): boolean {
  if (!visaoAnterior || !visaoNova) {
    return false;
  }
  if (visaoAnterior.overlayInterrompido || visaoNova.overlayInterrompido) {
    return false;
  }
  const tinhaPergunta = Boolean(visaoAnterior.pergunta);
  const temPerguntaAgora = Boolean(visaoNova.pergunta);
  return !tinhaPergunta && temPerguntaAgora;
}

/**
 * Toca um efeito sonoro curto de interface ("confirmar" ou "liberado")
 * somente se a preferência estiver ligada. Nunca lança exceção.
 */
export function tocarEfeito(
  nome: NomeEfeitoUi,
  opcoes?: {
    engine?: EngineTocarTomMinimo;
    habilitado?: boolean;
  }
): boolean {
  const habilitado = opcoes?.habilitado ?? efeitosUiAtivos;
  if (!habilitado) {
    return false;
  }
  const engine = opcoes?.engine ?? audioEngine;
  const desc = nome === 'confirmar' ? SOM_CONFIRMAR : SOM_LIBERADO;
  try {
    return engine.tocarTom(desc);
  } catch {
    return false;
  }
}
