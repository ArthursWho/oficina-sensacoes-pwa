import { repositorio, RepositorioSessoes } from './repositorio';

export type EstadoPreparoArmazenamento = 'verificando' | 'pronto' | 'falha';

let promessaSaudeUnica: Promise<{ saudavel: boolean; motivo?: string }> | null =
  null;
let estadoAtual: EstadoPreparoArmazenamento = 'verificando';
const assinantes = new Set<(estado: EstadoPreparoArmazenamento) => void>();

function notificar(novoEstado: EstadoPreparoArmazenamento): void {
  estadoAtual = novoEstado;
  for (const cb of assinantes) {
    cb(estadoAtual);
  }
}

/**
 * Retorna o estado observável atual da verificação de saúde do armazenamento.
 */
export function obterEstadoPreparoArmazenamento(): EstadoPreparoArmazenamento {
  return estadoAtual;
}

/**
 * Registra um ouvinte para mudanças no estado do armazenamento ("verificando" | "pronto" | "falha").
 */
export function assinarPreparoArmazenamento(
  cb: (estado: EstadoPreparoArmazenamento) => void
): () => void {
  assinantes.add(cb);
  return () => {
    assinantes.delete(cb);
  };
}

/**
 * Verifica a saúde do IndexedDB. Se o estado anterior era "falha" (ou ainda não verificou),
 * executa novamente `repo.verificarSaude()`.
 */
export function garantirSaudeArmazenamento(
  repo: RepositorioSessoes = repositorio
): Promise<{ saudavel: boolean; motivo?: string }> {
  if (!promessaSaudeUnica || estadoAtual === 'falha') {
    notificar('verificando');
    promessaSaudeUnica = repo
      .verificarSaude()
      .then((res) => {
        if (res.saudavel) {
          notificar('pronto');
        } else {
          notificar('falha');
          promessaSaudeUnica = null;
        }
        return res;
      })
      .catch((erro) => {
        notificar('falha');
        promessaSaudeUnica = null;
        const motivo =
          erro instanceof Error
            ? erro.message
            : 'Falha ao verificar armazenamento.';
        return { saudavel: false, motivo };
      });
  }
  return promessaSaudeUnica;
}

/**
 * Limpa o estado do preparo de armazenamento (usado apenas em testes automatizados).
 */
export function resetarPreparoArmazenamentoParaTestes(): void {
  promessaSaudeUnica = null;
  estadoAtual = 'verificando';
  assinantes.clear();
}
