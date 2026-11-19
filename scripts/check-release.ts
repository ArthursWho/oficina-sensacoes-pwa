import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import {
  listarPendencias,
  PENDENCIAS,
  type PendenciasTcle,
  temPendencias,
} from '../src/content/tcle.ts';

export interface ResultadoCheckRelease {
  exitCode: 0;
  possuiPendencias: boolean;
  pendencias: string[];
  mensagem: string;
}

/**
 * Avalia as pendências do TCLE para o release.
 * Conforme decisão do grupo na Etapa 10, as pendências NÃO bloqueiam a publicação (exitCode = 0):
 * apenas geram um AVISO claro listando os campos pendentes.
 */
export function executarCheckRelease(
  pendenciasObj: PendenciasTcle = PENDENCIAS
): ResultadoCheckRelease {
  if (temPendencias(pendenciasObj)) {
    const lista = listarPendencias(pendenciasObj);
    const linhas = [
      `ATENÇÃO: o TCLE ainda contém campos pendentes (${lista.length}):`,
      ...lista.map((item) => `  - ${item}`),
      'Estes campos aparecem entre colchetes no termo exibido ao participante (não bloqueiam o release v1.0.0).',
    ];
    return {
      exitCode: 0,
      possuiPendencias: true,
      pendencias: lista,
      mensagem: linhas.join('\n'),
    };
  }

  return {
    exitCode: 0,
    possuiPendencias: false,
    pendencias: [],
    mensagem: '[OK check:release] sem pendências no TCLE.',
  };
}

// Execução direta via CLI
const isMain =
  process.argv[1] &&
  path.resolve(process.argv[1]) ===
    path.resolve(fileURLToPath(import.meta.url));

if (isMain) {
  const res = executarCheckRelease();
  if (res.possuiPendencias) {
    console.warn('\n' + res.mensagem + '\n');
  } else {
    console.log('\n' + res.mensagem + '\n');
  }
  process.exit(res.exitCode);
}
