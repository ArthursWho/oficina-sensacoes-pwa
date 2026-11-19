import { repositorio, RepositorioSessoes } from './repositorio';

/**
 * Retorna o próximo número sequencial de participante com base nas sessões concluídas no IndexedDB.
 */
export function proximoNumeroParticipante(
  repo: RepositorioSessoes = repositorio
): Promise<number> {
  return repo.proximoNumeroParticipante();
}
