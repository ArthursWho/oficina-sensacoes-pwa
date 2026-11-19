import { ALL_AUDIO_SRCS } from '../content/tracks';
import { audioEngine, RelatorioPreload } from './AudioEngine';

export type EstadoPreparoAudio = 'carregando' | 'pronto' | 'falha';

export interface EnginePreloadMinimo {
  preload(srcs: readonly string[]): Promise<RelatorioPreload>;
}

let promessaPreloadUnica: Promise<RelatorioPreload> | null = null;
let estadoAtual: EstadoPreparoAudio = 'carregando';
const assinantes = new Set<(estado: EstadoPreparoAudio) => void>();

function notificar(novoEstado: EstadoPreparoAudio): void {
  estadoAtual = novoEstado;
  for (const cb of assinantes) {
    cb(estadoAtual);
  }
}

/**
 * Retorna o estado observável atual da pré-carga dos 13 áudios.
 */
export function obterEstadoPreparoAudio(): EstadoPreparoAudio {
  return estadoAtual;
}

/**
 * Registra um ouvinte para mudanças no estado da pré-carga ("carregando" | "pronto" | "falha").
 */
export function assinarPreparoAudio(
  cb: (estado: EstadoPreparoAudio) => void
): () => void {
  assinantes.add(cb);
  return () => {
    assinantes.delete(cb);
  };
}

/**
 * Dispara `engine.preload(ALL_AUDIO_SRCS)` uma única vez e reutiliza a mesma promessa
 * nas chamadas seguintes (a menos que uma chamada anterior tenha rejeitado ou falhado e precise de retry).
 */
export function garantirPreload(
  engine: EnginePreloadMinimo = audioEngine
): Promise<RelatorioPreload> {
  if (!promessaPreloadUnica) {
    notificar('carregando');
    promessaPreloadUnica = engine
      .preload(ALL_AUDIO_SRCS)
      .then((rel) => {
        if (rel.falhas.length === 0 && rel.ok.length === ALL_AUDIO_SRCS.length) {
          notificar('pronto');
        } else {
          notificar('falha');
          // Permite nova tentativa futura se algum arquivo falhou
          promessaPreloadUnica = null;
        }
        return rel;
      })
      .catch((err) => {
        notificar('falha');
        promessaPreloadUnica = null;
        throw err;
      });
  }
  return promessaPreloadUnica;
}

/**
 * Limpa o cache da promessa de pré-carga (usado apenas em testes automatizados).
 */
export function resetarPreparoAudioParaTestes(): void {
  promessaPreloadUnica = null;
  estadoAtual = 'carregando';
  assinantes.clear();
}
