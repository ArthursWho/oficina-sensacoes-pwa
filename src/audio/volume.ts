import {
  PERCENTUAL_VOLUME_MAX,
  PERCENTUAL_VOLUME_MIN,
  PERCENTUAL_VOLUME_PADRAO,
} from './config';

/**
 * Limita e arredonda um percentual de volume para um inteiro no intervalo [10, 100].
 */
export function normalizarPercentualVolume(percentual: number): number {
  if (!Number.isFinite(percentual)) {
    return PERCENTUAL_VOLUME_PADRAO;
  }
  const arredondado = Math.round(percentual);
  return Math.max(
    PERCENTUAL_VOLUME_MIN,
    Math.min(PERCENTUAL_VOLUME_MAX, arredondado)
  );
}

/**
 * Converte um percentual de volume (10% a 100%) para multiplicador de ganho linear
 * seguindo a curva quadrática: ganho = (porcentagem / 100)².
 * 100 -> 1.0, 50 -> 0.25, 10 -> 0.01 (monotônica).
 */
export function nivelParaGanho(percentual: number): number {
  const pct = normalizarPercentualVolume(percentual);
  const ratio = pct / 100;
  return Number((ratio * ratio).toFixed(6));
}
