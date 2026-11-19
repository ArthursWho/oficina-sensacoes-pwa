import { FADE_IN_INICIAL_MS } from '../audio/config';
import { SessionStore } from './store';
import { Efeito } from './tipos';

// Interface mínima do AudioEngine consumida pelo controlador (facilita injeção em testes)
export interface EngineControlador {
  iniciarBatimentos(opcoes?: { fadeInMs?: number }): void;
  pararTudo(): void;
  fadeOutBatimentos(ms?: number): Promise<void>;
  fadeInBatimentos(ms?: number): Promise<void>;
}

export interface ControladorSessao {
  desconectar(): void;
  aguardarFila(): Promise<void>;
}

/**
 * Conecta o store de sessão ao AudioEngine, executando os efeitos emitidos EM ORDEM
 * (aguardando cada efeito assíncrono antes de iniciar o próximo).
 */
export function criarControlador(
  engine: EngineControlador,
  store: SessionStore
): ControladorSessao {
  let filaExecucao: Promise<void> = Promise.resolve();

  const executarUmEfeito = async (efeito: Efeito): Promise<void> => {
    try {
      switch (efeito.tipo) {
        case 'iniciarBatimentos':
          engine.iniciarBatimentos({ fadeInMs: FADE_IN_INICIAL_MS });
          break;

        case 'pararTudo':
          engine.pararTudo();
          break;

        case 'fadeOutBatimentos':
          await engine.fadeOutBatimentos();
          break;

        case 'fadeInBatimentos':
          await engine.fadeInBatimentos();
          break;

        case 'tocarFaixa':
          // TODO etapa 6: implementar reprodução real de faixa e despacho de AUDIO_*_FIM / AUDIO_INTERROMPIDO
          console.warn(
            `efeito ainda não implementado (etapa 6/7): tocarFaixa (par=${efeito.par}, versao=${efeito.versao}, epoca=${efeito.epoca})`
          );
          break;

        case 'agendarTransicao':
          // TODO etapa 6: implementar agendamento do timer de transição entre pares (TRANSICAO_FIM)
          console.warn(
            `efeito ainda não implementado (etapa 6/7): agendarTransicao (${efeito.ms} ms)`
          );
          break;

        case 'persistirSessao':
          // TODO etapa 7: implementar gravação da sessão concluída no IndexedDB
          console.warn(
            `efeito ainda não implementado (etapa 6/7): persistirSessao (${efeito.sessao.id_participante})`
          );
          break;
      }
    } catch (erro) {
      // Erros de um efeito nunca derrubam o aplicativo nem travam os efeitos seguintes
      console.error(`Erro ao executar efeito "${efeito.tipo}":`, erro);
    }
  };

  store.setManipuladorEfeitos((efeitos) => {
    for (const efeito of efeitos) {
      filaExecucao = filaExecucao.then(() => executarUmEfeito(efeito));
    }
  });

  return {
    desconectar(): void {
      store.setManipuladorEfeitos(null);
    },
    aguardarFila(): Promise<void> {
      return filaExecucao;
    },
  };
}
