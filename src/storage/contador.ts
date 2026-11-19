import { repositorioAtivo, RepositorioSessoes } from './repositorio';

/**
 * Retorna o próximo número sequencial de participante com base nas sessões concluídas no banco ativo (proxy).
 */
export function proximoNumeroParticipante(
  repo: RepositorioSessoes = repositorioAtivo
): Promise<number> {
  return repo.proximoNumeroParticipante();
}
