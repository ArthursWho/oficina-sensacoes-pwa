import { STRINGS } from '../content/strings';
import { Track, TRACKS } from '../content/tracks';
import { TOTAL_PARES } from './config';
import { Estado } from './tipos';

export interface EstadoBotoesSessao {
  play: boolean;
  respostaP1: boolean;
  respostaP2: boolean;
  ouvirNovamente: boolean;
  retomar: boolean;
}

/**
 * Retorna true quando há uma sessão em andamento (boas_vindas ou ciclo).
 */
export function sessaoAtiva(e: Estado): boolean {
  return e.fase === 'boas_vindas' || e.fase === 'ciclo';
}

/**
 * Retorna true no encerramento enquanto a persistência não foi confirmada como "ok".
 */
export function sessaoNaoSalva(e: Estado): boolean {
  return e.fase === 'encerramento' && e.persistencia !== 'ok';
}

/**
 * Retorna o indicador "n / 6" durante o ciclo ou null fora dele.
 */
export function progresso(e: Estado): string | null {
  if (e.fase !== 'ciclo') return null;
  return `${e.par} / ${TOTAL_PARES}`;
}

/**
 * Retorna true quando o título e artista da música devem ser revelados (a partir de original_tocando até o fim do par).
 */
export function revelarMusica(e: Estado): boolean {
  if (e.fase !== 'ciclo') return false;
  return (
    e.etapa.tipo === 'original_tocando' ||
    e.etapa.tipo === 'p2_liberada' ||
    e.etapa.tipo === 'transicao'
  );
}

/**
 * Retorna o texto exato da Pergunta 2 conforme a resposta da Pergunta 1, ou null fora de original_tocando/p2_liberada.
 */
export function textoPergunta2(e: Estado): string | null {
  if (e.fase !== 'ciclo') return null;
  if (
    e.etapa.tipo !== 'original_tocando' &&
    e.etapa.tipo !== 'p2_liberada'
  ) {
    return null;
  }
  return e.etapa.reconheceu === 'Sim'
    ? STRINGS.pergunta2Sim
    : STRINGS.pergunta2Nao;
}

/**
 * Retorna quais botões de ação do participante estão habilitados no estado atual.
 */
export function botoes(e: Estado): EstadoBotoesSessao {
  const base: EstadoBotoesSessao = {
    play: false,
    respostaP1: false,
    respostaP2: false,
    ouvirNovamente: false,
    retomar: false,
  };

  if (e.fase === 'boas_vindas') {
    return { ...base, play: true };
  }

  if (e.fase === 'ciclo') {
    const { etapa } = e;
    if (etapa.tipo === 'editado_tocando' || etapa.tipo === 'original_tocando') {
      return { ...base, retomar: etapa.interrompido };
    }
    if (etapa.tipo === 'p1_liberada') {
      return { ...base, respostaP1: true, ouvirNovamente: true };
    }
    if (etapa.tipo === 'p2_liberada') {
      return { ...base, respostaP2: true, ouvirNovamente: true };
    }
  }

  return base;
}

/**
 * Retorna o objeto Track do par atual (1..6) ou null fora do ciclo.
 */
export function faixaAtual(e: Estado): Track | null {
  if (e.fase !== 'ciclo') return null;
  return TRACKS[e.par - 1] ?? null;
}
