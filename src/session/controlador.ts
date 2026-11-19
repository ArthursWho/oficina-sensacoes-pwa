import {
  audioEngine,
  EventoEstadoAudio,
  ResultadoFaixa,
} from '../audio/AudioEngine';
import { FADE_IN_INICIAL_MS } from '../audio/config';
import { TRACKS } from '../content/tracks';
import { repositorioAtivo } from '../storage/repositorio';
import { SessionStore } from './store';
import { Efeito, SessaoConcluida } from './tipos';

// Interface mínima do AudioEngine consumida pelo controlador (facilita injeção em testes)
export interface EngineControlador {
  iniciarBatimentos(opcoes?: { fadeInMs?: number }): void;
  pararTudo(): void;
  fadeOutBatimentos(ms?: number): Promise<void>;
  fadeInBatimentos(ms?: number): Promise<void>;
  tocarFaixa?(src: string): Promise<ResultadoFaixa>;
  tentarRetomar?(): Promise<boolean>;
  aoMudarEstado?(cb: (evento: EventoEstadoAudio) => void): () => void;
}

// Interface mínima do repositório consumida pelo controlador
export interface RepositorioControlador {
  salvarSessao(s: SessaoConcluida): Promise<void>;
}

export interface ControladorSessao {
  desconectar(): void;
  aguardarFila(): Promise<void>;
}

let engineAtivoParaGesto: EngineControlador = audioEngine;

/**
 * Tenta retomar o AudioContext sincronamente dentro do gesto de toque do botão "Retomar".
 */
export function retomarAudioNoGesto(
  engine: EngineControlador = engineAtivoParaGesto
): Promise<boolean> {
  if (typeof engine.tentarRetomar === 'function') {
    return engine.tentarRetomar();
  }
  return Promise.resolve(true);
}

/**
 * Conecta o store de sessão ao AudioEngine e ao Repositório IndexedDB,
 * executando os efeitos emitidos EM ORDEM, com preempção por "pararTudo".
 */
export function criarControlador(
  engine: EngineControlador,
  store: SessionStore,
  repo: RepositorioControlador = repositorioAtivo
): ControladorSessao {
  engineAtivoParaGesto = engine;

  let filaExecucao: Promise<void> = Promise.resolve();
  let proximoLote = 0;
  let loteMinimo = 0;
  let timerTransicao: ReturnType<typeof setTimeout> | null = null;

  const cancelarTimerTransicao = () => {
    if (timerTransicao !== null) {
      clearTimeout(timerTransicao);
      timerTransicao = null;
    }
  };

  // Recuperação automática dos batimentos ao voltar para a página em fases sem faixa tocando
  let desregistrarEstado: (() => void) | null = null;
  if (typeof engine.aoMudarEstado === 'function') {
    desregistrarEstado = engine.aoMudarEstado((evento) => {
      if (evento !== 'pagina-visivel') return;
      const st = store.getEstado();
      const deveRetomarBatimentos =
        st.fase === 'boas_vindas' ||
        (st.fase === 'ciclo' &&
          (st.etapa.tipo === 'p1_liberada' ||
            st.etapa.tipo === 'p2_liberada' ||
            st.etapa.tipo === 'transicao'));

      if (
        deveRetomarBatimentos &&
        typeof engine.tentarRetomar === 'function'
      ) {
        void engine.tentarRetomar().catch(() => {});
      }
    });
  }

  const dispararTocarFaixaSemBloquear = (
    par: number,
    versao: 'editado' | 'original',
    epoca: number
  ): void => {
    const track = TRACKS[par - 1];
    if (!track || typeof engine.tocarFaixa !== 'function') {
      console.error(`Faixa inválida ou tocarFaixa indisponível (par=${par})`);
      store.dispatch({ tipo: 'AUDIO_INTERROMPIDO', epoca });
      return;
    }

    const src = versao === 'editado' ? track.srcEditado : track.srcOriginal;

    try {
      const promessa = engine.tocarFaixa(src);
      promessa.then(
        (resultado) => {
          if (resultado === 'fim') {
            store.dispatch({
              tipo:
                versao === 'editado'
                  ? 'AUDIO_EDITADO_FIM'
                  : 'AUDIO_ORIGINAL_FIM',
              epoca,
            });
          } else if (resultado === 'interrompida') {
            store.dispatch({ tipo: 'AUDIO_INTERROMPIDO', epoca });
          }
          // "cancelada": não despacha nada
        },
        (erro) => {
          console.error(`Rejeição em tocarFaixa("${src}"):`, erro);
          store.dispatch({ tipo: 'AUDIO_INTERROMPIDO', epoca });
        }
      );
    } catch (erro) {
      console.error(`Exceção síncrona em tocarFaixa("${src}"):`, erro);
      store.dispatch({ tipo: 'AUDIO_INTERROMPIDO', epoca });
    }
  };

  const dispararPersistenciaSemBloquear = (sessao: SessaoConcluida): void => {
    repo
      .salvarSessao(sessao)
      .then(() => {
        store.dispatch({ tipo: 'PERSISTENCIA_OK' });
      })
      .catch((e) => {
        console.error(e);
        store.dispatch({ tipo: 'PERSISTENCIA_FALHA' });
      });
  };

  const executarUmEfeito = async (
    efeito: Efeito,
    lote: number
  ): Promise<void> => {
    // Preempção: descarta qualquer efeito de lote anterior a um pararTudo
    if (lote < loteMinimo) {
      return;
    }

    try {
      switch (efeito.tipo) {
        case 'iniciarBatimentos':
          engine.iniciarBatimentos({ fadeInMs: FADE_IN_INICIAL_MS });
          break;

        case 'pararTudo':
          cancelarTimerTransicao();
          engine.pararTudo();
          break;

        case 'fadeOutBatimentos':
          await engine.fadeOutBatimentos();
          break;

        case 'fadeInBatimentos':
          await engine.fadeInBatimentos();
          break;

        case 'tocarFaixa':
          // Retorna imediatamente sem aguardar o fim da faixa para não bloquear a fila
          dispararTocarFaixaSemBloquear(
            efeito.par,
            efeito.versao,
            efeito.epoca
          );
          break;

        case 'agendarTransicao':
          cancelarTimerTransicao();
          timerTransicao = setTimeout(() => {
            timerTransicao = null;
            store.dispatch({ tipo: 'TRANSICAO_FIM' });
          }, efeito.ms);
          break;

        case 'persistirSessao':
          // Grava a sessão concluída no IndexedDB sem bloquear a fila de efeitos
          dispararPersistenciaSemBloquear(efeito.sessao);
          break;
      }
    } catch (erro) {
      // Erros de um efeito nunca derrubam o aplicativo nem travam os efeitos seguintes
      console.error(`Erro ao executar efeito "${efeito.tipo}":`, erro);
    }
  };

  store.setManipuladorEfeitos((efeitos) => {
    const loteAtual = ++proximoLote;

    // Preempção imediata: se o lote contém "pararTudo", invalida lotes anteriores e limpa timers/áudio já na entrada
    if (efeitos.some((e) => e.tipo === 'pararTudo')) {
      loteMinimo = loteAtual;
      cancelarTimerTransicao();
      try {
        engine.pararTudo();
      } catch (erro) {
        console.error('Erro na preempção imediata de pararTudo:', erro);
      }
    }

    for (const efeito of efeitos) {
      if (efeito.tipo === 'pararTudo') {
        continue;
      }
      filaExecucao = filaExecucao.then(() =>
        executarUmEfeito(efeito, loteAtual)
      );
    }
  });

  return {
    desconectar(): void {
      cancelarTimerTransicao();
      desregistrarEstado?.();
      store.setManipuladorEfeitos(null);
    },
    aguardarFila(): Promise<void> {
      return filaExecucao;
    },
  };
}
