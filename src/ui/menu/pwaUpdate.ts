// Estado observável da atualização do Service Worker (virtual:pwa-register em modo prompt)

type FuncaoUpdateSw = (reloadPage?: boolean) => Promise<void>;

let atualizacaoDisponivel = false;
let funcaoUpdateSw: FuncaoUpdateSw | null = null;
const assinantes = new Set<(disponivel: boolean) => void>();

function notificar(): void {
  for (const cb of assinantes) {
    cb(atualizacaoDisponivel);
  }
}

/**
 * Registra a função `updateSW` devolvida por `registerSW` e sinaliza quando `onNeedRefresh` dispara.
 */
export function configurarAtualizadorPwa(
  updateFn: FuncaoUpdateSw,
  precisaAtualizar = false
): void {
  funcaoUpdateSw = updateFn;
  atualizacaoDisponivel = precisaAtualizar;
  notificar();
}

/**
 * Sinaliza que uma nova versão do Service Worker está aguardando ativação (`onNeedRefresh`).
 */
export function marcarAtualizacaoDisponivel(): void {
  atualizacaoDisponivel = true;
  notificar();
}

/**
 * Retorna true se houver uma atualização do PWA aguardando confirmação do operador.
 */
export function temAtualizacaoDisponivel(): boolean {
  return atualizacaoDisponivel;
}

/**
 * Assina mudanças no estado de atualização disponível.
 */
export function assinarAtualizacaoPwa(
  cb: (disponivel: boolean) => void
): () => void {
  assinantes.add(cb);
  return () => {
    assinantes.delete(cb);
  };
}

/**
 * Aciona a atualização e recarregamento do aplicativo (somente após confirmação explícita do operador).
 */
export async function aplicarAtualizacaoPwa(): Promise<void> {
  if (funcaoUpdateSw) {
    await funcaoUpdateSw(true);
  }
}
