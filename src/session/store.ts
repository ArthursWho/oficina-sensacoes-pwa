import { ConfigSessao, CONFIG_SESSAO_PADRAO } from './config';
import { Efeito, Estado, Evento, Resultado } from './tipos';
import { transicao } from './transicao';

export interface ItemLogEfeito {
  ordem: number;
  eventoTipo: Evento['tipo'];
  epocaSessao: number | null;
  efeito: Efeito;
}

export type ManipuladorEfeitos = (
  efeitos: Efeito[],
  estadoAtual: Estado,
  evento: Evento
) => void;

export type AssinanteStore = (
  estado: Estado,
  ultimoResultado: Resultado,
  ultimoEvento: Evento
) => void;

export interface SessionStore {
  getEstado(): Estado;
  dispatch(evento: Evento): Resultado;
  assinar(cb: AssinanteStore): () => void;
  setManipuladorEfeitos(fn: ManipuladorEfeitos | null): void;
  getLogEfeitos(): readonly ItemLogEfeito[];
  limparLogEfeitos(): void;
}

function extrairEpoca(estado: Estado): number | null {
  if (
    estado.fase === 'boas_vindas' ||
    estado.fase === 'ciclo' ||
    estado.fase === 'encerramento'
  ) {
    return estado.sessao.epoca;
  }
  return null;
}

/**
 * Cria uma instância do store da sessão experimental (sem executar efeitos diretamente).
 */
export function criarSessionStore(
  cfg: ConfigSessao = CONFIG_SESSAO_PADRAO
): SessionStore {
  let estado: Estado = { fase: 'tcle' };
  let manipuladorEfeitos: ManipuladorEfeitos | null = null;
  let contadorEfeitos = 0;
  const logEfeitos: ItemLogEfeito[] = [];
  const assinantes = new Set<AssinanteStore>();

  return {
    getEstado(): Estado {
      return estado;
    },

    dispatch(evento: Evento): Resultado {
      const resultado = transicao(estado, evento, cfg);
      estado = resultado.estado;

      const epocaAtual = extrairEpoca(estado);
      for (const efeito of resultado.efeitos) {
        logEfeitos.push({
          ordem: ++contadorEfeitos,
          eventoTipo: evento.tipo,
          epocaSessao: epocaAtual,
          efeito,
        });
      }

      for (const cb of assinantes) {
        cb(estado, resultado, evento);
      }

      if (manipuladorEfeitos && resultado.efeitos.length > 0) {
        manipuladorEfeitos(resultado.efeitos, estado, evento);
      }

      return resultado;
    },

    assinar(cb: AssinanteStore): () => void {
      assinantes.add(cb);
      return () => {
        assinantes.delete(cb);
      };
    },

    setManipuladorEfeitos(fn: ManipuladorEfeitos | null): void {
      manipuladorEfeitos = fn;
    },

    getLogEfeitos(): readonly ItemLogEfeito[] {
      return [...logEfeitos];
    },

    limparLogEfeitos(): void {
      logEfeitos.length = 0;
      contadorEfeitos = 0;
    },
  };
}

// Instância singleton padrão do store de sessão
export const sessionStore = criarSessionStore();
