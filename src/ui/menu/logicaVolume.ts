import {
  OpcoesTocarFaixa,
  ResultadoFaixa,
  VersaoFaixaAudio,
} from '../../audio/AudioEngine';
import {
  PERCENTUAL_VOLUME_MAX,
  PERCENTUAL_VOLUME_MIN,
  PERCENTUAL_VOLUME_PADRAO,
} from '../../audio/config';
import { RelatorioPreload } from '../../audio/AudioEngine';
import {
  nivelParaGanho,
  normalizarPercentualVolume,
} from '../../audio/volume';
import { STRINGS } from '../../content/strings';
import { TRACKS } from '../../content/tracks';
import { Estado } from '../../session/tipos';
import { podeAjustarVolume } from './logicaMenu';

export { podeAjustarVolume };

export interface VolumesPct {
  editadasPct: number;
  originaisPct: number;
}

/**
 * Aplica um delta inteiro (ex.: -1 ou +1) a um percentual de volume,
 * limitando o resultado a [PERCENTUAL_VOLUME_MIN (10), PERCENTUAL_VOLUME_MAX (100)].
 */
export function aplicarPassoVolume(atualPct: number, delta: number): number {
  return normalizarPercentualVolume(atualPct + delta);
}

/**
 * Retorna true somente quando algum dos dois volumes é diferente de 100%.
 */
export function podeRestaurarVolumePadrao(
  editadasPct: number,
  originaisPct: number
): boolean {
  return (
    normalizarPercentualVolume(editadasPct) !== PERCENTUAL_VOLUME_PADRAO ||
    normalizarPercentualVolume(originaisPct) !== PERCENTUAL_VOLUME_PADRAO
  );
}

/**
 * Determina o modo de layout da linha de controles do cartão de volume:
 * "em-linha" quando a largura do painel é >= 640 px, ou "empilhado" abaixo disso.
 */
export function layoutLinhaVolumePorLargura(
  larguraPx: number
): 'em-linha' | 'empilhado' {
  return larguraPx >= 640 ? 'em-linha' : 'empilhado';
}

/**
 * Controlador de repetição ao segurar os botões [ − ] ou [ + ] (~120 ms inicial, acelerando gradualmente).
 */
export function iniciarRepeticaoSegurar(
  passoFn: () => void,
  intervaloInicialMs = 120
): () => void {
  // Executa o primeiro passo imediatamente no toque
  passoFn();

  let cancelado = false;
  let passosDados = 0;
  let timerId: ReturnType<typeof setTimeout> | null = null;

  const agendarProximo = () => {
    if (cancelado) return;
    // Acelera levemente após alguns passos contínuos (120 ms -> 90 ms -> 65 ms)
    const atraso =
      passosDados < 5
        ? intervaloInicialMs
        : passosDados < 15
        ? Math.max(60, Math.round(intervaloInicialMs * 0.75))
        : Math.max(45, Math.round(intervaloInicialMs * 0.55));

    timerId = setTimeout(() => {
      if (cancelado) return;
      passosDados++;
      passoFn();
      agendarProximo();
    }, atraso);
  };

  agendarProximo();

  return () => {
    cancelado = true;
    if (timerId !== null) {
      clearTimeout(timerId);
      timerId = null;
    }
  };
}

/**
 * Agendador de persistência automática dos volumes com debounce (~400 ms) e flush imediato ao fechar o menu.
 */
export interface AgendadorPersistenciaVolume {
  agendar(volumes: VolumesPct): void;
  flush(): Promise<void>;
  cancelar(): void;
}

export function criarPersistenciaVolumeDebounced(
  salvarFn: (v: {
    volumeEditadasPct: number;
    volumeOriginaisPct: number;
  }) => Promise<void>,
  debounceMs = 400
): AgendadorPersistenciaVolume {
  let pendente: VolumesPct | null = null;
  let timerId: ReturnType<typeof setTimeout> | null = null;
  let ultimaPromessa: Promise<void> = Promise.resolve();

  const gravarAgora = (v: VolumesPct): Promise<void> => {
    const payload = {
      volumeEditadasPct: normalizarPercentualVolume(v.editadasPct),
      volumeOriginaisPct: normalizarPercentualVolume(v.originaisPct),
    };
    ultimaPromessa = salvarFn(payload).catch(() => {});
    return ultimaPromessa;
  };

  return {
    agendar(volumes: VolumesPct): void {
      pendente = {
        editadasPct: normalizarPercentualVolume(volumes.editadasPct),
        originaisPct: normalizarPercentualVolume(volumes.originaisPct),
      };
      if (timerId !== null) {
        clearTimeout(timerId);
      }
      timerId = setTimeout(() => {
        timerId = null;
        if (pendente) {
          const paraGravar = pendente;
          pendente = null;
          void gravarAgora(paraGravar);
        }
      }, debounceMs);
    },

    async flush(): Promise<void> {
      if (timerId !== null) {
        clearTimeout(timerId);
        timerId = null;
      }
      if (pendente) {
        const paraGravar = pendente;
        pendente = null;
        await gravarAgora(paraGravar);
      } else {
        await ultimaPromessa;
      }
    },

    cancelar(): void {
      if (timerId !== null) {
        clearTimeout(timerId);
        timerId = null;
      }
      pendente = null;
    },
  };
}

// --- Controlador de reprodução de exemplo ("Tocar exemplo" / "Parar") ---

export interface EngineExemploMinimo {
  unlock(): Promise<boolean>;
  tocarFaixa(
    src: string,
    opcoes?: OpcoesTocarFaixa
  ): Promise<ResultadoFaixa>;
  pararFaixa(): void;
  definirNiveisVersao(niveis: { editado: number; original: number }): void;
}

export interface EstadoExemploVolume {
  tocando: VersaoFaixaAudio | null;
  erroEditadas: string | null;
  erroOriginais: string | null;
}

export interface ControladorExemploVolume {
  obterEstado(): EstadoExemploVolume;
  assinar(cb: (e: EstadoExemploVolume) => void): () => void;
  clicarExemplo(versao: VersaoFaixaAudio, estadoSessao: Estado): void;
  pararSeTocando(): void;
  atualizarVolumesTempoReal(editadasPct: number, originaisPct: number): void;
}

/**
 * Cria o controlador isolado para o botão "Tocar exemplo" / "Parar" do cartão de volume.
 * Usa diretamente o `AudioEngine` com a faixa do Par 1 (Cheia de Manias), sem tocar no store de sessão.
 * Chama `engine.unlock()` de forma SÍNCRONA no início do clique.
 */
export function criarControladorExemploVolume(deps: {
  engine: EngineExemploMinimo;
  garantirPreload: () => Promise<RelatorioPreload>;
}): ControladorExemploVolume {
  let estado: EstadoExemploVolume = {
    tocando: null,
    erroEditadas: null,
    erroOriginais: null,
  };
  let tokenExecucao = 0;
  const assinantes = new Set<(e: EstadoExemploVolume) => void>();

  const notificar = (parcial: Partial<EstadoExemploVolume>) => {
    estado = { ...estado, ...parcial };
    for (const cb of assinantes) {
      cb(estado);
    }
  };

  const pararSeTocando = () => {
    tokenExecucao++;
    if (estado.tocando !== null) {
      try {
        deps.engine.pararFaixa();
      } catch {
        // No-op
      }
      notificar({ tocando: null });
    }
  };

  const definirErroVersao = (
    versao: VersaoFaixaAudio,
    mensagem: string | null
  ) => {
    if (versao === 'editado') {
      notificar({ tocando: null, erroEditadas: mensagem });
    } else {
      notificar({ tocando: null, erroOriginais: mensagem });
    }
  };

  return {
    obterEstado(): EstadoExemploVolume {
      return estado;
    },

    assinar(cb: (e: EstadoExemploVolume) => void): () => void {
      assinantes.add(cb);
      return () => {
        assinantes.delete(cb);
      };
    },

    pararSeTocando,

    atualizarVolumesTempoReal(editadasPct: number, originaisPct: number): void {
      deps.engine.definirNiveisVersao({
        editado: nivelParaGanho(editadasPct),
        original: nivelParaGanho(originaisPct),
      });
    },

    clicarExemplo(versao: VersaoFaixaAudio, estadoSessao: Estado): void {
      if (!podeAjustarVolume(estadoSessao)) {
        return;
      }

      // Se a própria caixa já está tocando, o botão funciona como "Parar"
      if (estado.tocando === versao) {
        pararSeTocando();
        return;
      }

      // Se a outra caixa estava tocando, para o exemplo anterior imediatamente
      if (estado.tocando !== null) {
        try {
          deps.engine.pararFaixa();
        } catch {
          // No-op
        }
      }

      const meuToken = ++tokenExecucao;
      notificar({
        tocando: versao,
        ...(versao === 'editado'
          ? { erroEditadas: null }
          : { erroOriginais: null }),
      });

      // CRÍTICO: unlock() chamado SINCRONAMENTE no mesmo tick do handler de clique
      const promessaUnlock = deps.engine.unlock();

      promessaUnlock
        .then(async (ok) => {
          if (meuToken !== tokenExecucao) return;
          if (!ok) {
            definirErroVersao(versao, STRINGS.volumeErroExemplo);
            return;
          }

          const rel = await deps.garantirPreload();
          if (meuToken !== tokenExecucao) return;

          const par1 = TRACKS[0];
          const src =
            versao === 'editado' ? par1.srcEditado : par1.srcOriginal;

          if (rel.falhas.some((f) => f.src === src)) {
            definirErroVersao(versao, STRINGS.volumeErroExemplo);
            return;
          }

          const resultado = await deps.engine.tocarFaixa(src, { versao });
          if (meuToken !== tokenExecucao) return;

          if (resultado === 'interrompida') {
            definirErroVersao(versao, STRINGS.volumeErroExemplo);
          } else {
            notificar({ tocando: null });
          }
        })
        .catch(() => {
          if (meuToken !== tokenExecucao) return;
          definirErroVersao(versao, STRINGS.volumeErroExemplo);
        });
    },
  };
}

export {
  PERCENTUAL_VOLUME_MAX,
  PERCENTUAL_VOLUME_MIN,
  PERCENTUAL_VOLUME_PADRAO,
};
