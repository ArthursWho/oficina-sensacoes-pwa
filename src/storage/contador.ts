// Contador provisório de participantes em memória
// TODO etapa 7: substituir por contador baseado nas sessões concluídas no IndexedDB

let contadorProvisorio = 1;

/**
 * Retorna o próximo número sequencial de participante (começa em 1).
 * TODO etapa 7: substituir por contador baseado nas sessões concluídas no IndexedDB.
 */
export async function proximoNumeroParticipante(): Promise<number> {
  const atual = contadorProvisorio;
  contadorProvisorio += 1;
  return atual;
}

/**
 * Reinicia o contador provisório em memória (auxiliar para testes automatizados).
 */
export function resetarContadorProvisorio(valorInicial = 1): void {
  contadorProvisorio = valorInicial;
}
