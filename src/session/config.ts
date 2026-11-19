// Configurações da máquina de estados da sessão experimental

// Se true, os batimentos voltam com fade-in ao fim da faixa original e saem com fade-out antes de cada nova reprodução
export const BATIMENTOS_VOLTAM_NOS_INTERVALOS = true;

// Tempo de transição entre pares de músicas em milissegundos
export const TRANSICAO_PAR_MS = 800;

// Quantidade total de pares (editada + original) por sessão
export const TOTAL_PARES = 6;

export interface ConfigSessao {
  BATIMENTOS_VOLTAM_NOS_INTERVALOS: boolean;
  TRANSICAO_PAR_MS: number;
  TOTAL_PARES: number;
}

export const CONFIG_SESSAO_PADRAO: ConfigSessao = {
  BATIMENTOS_VOLTAM_NOS_INTERVALOS,
  TRANSICAO_PAR_MS,
  TOTAL_PARES,
};
