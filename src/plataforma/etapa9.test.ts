import 'fake-indexeddb/auto';
import { deleteDB } from 'idb';
import { afterEach, describe, expect, it } from 'vitest';
import { AudioEngine } from '../audio/AudioEngine';
import { SOM_CONFIRMAR, SOM_LIBERADO } from '../audio/config';
import {
  definirPreferenciaEfeitosUi,
  houveLiberacao,
  tocarEfeito,
} from '../audio/efeitosUi';
import { TRACKS } from '../content/tracks';
import { criarSessionStore } from '../session/store';
import { Estado, LinhaSessao, SessaoConcluida } from '../session/tipos';
import { formatarIdParticipante } from '../session/utilidades';
import { visaoCiclo } from '../session/visao';
import { VERSAO_DB } from '../storage/db';
import { criarRepositorio } from '../storage/repositorio';
import {
  escolherModoVisual,
  obterParticulasDeterministicas,
  tintaPorPar,
} from '../ui/components/VisualOrganico';
import {
  criarGerenciadorWakeLock,
  deveManterTelaLigada,
  WakeLockSentinelMinimo,
} from './wakeLock';

let contadorDb = 0;
function novoNomeDb(): string {
  contadorDb++;
  return `mundo-utero-etapa9-${Date.now()}-${contadorDb}`;
}

function criarSessaoValida(numeroParticipante: number): SessaoConcluida {
  const id = formatarIdParticipante(numeroParticipante);
  const linhas: LinhaSessao[] = TRACKS.map((t, idx) => ({
    id_participante: id,
    data_hora: '2026-11-19 03:20:00',
    ordem_musica: idx + 1,
    musica: t.rotulo,
    reconheceu: 'Sim',
    tipo_pergunta_2: 'Acertou',
    resposta_pergunta_2: 'Sim',
    repeticoes_editado: 0,
    repeticoes_original: 0,
  }));

  return {
    id_participante: id,
    linhas,
  };
}

// FakeAudioContext com suporte a createOscillator para testar AudioEngine.tocarTom
class FakeOscillatorNode {
  type: OscillatorType = 'sine';
  readonly frequency = {
    valor: 440,
    setValueAtTime(v: number) {
      this.valor = v;
    },
  };
  iniciadoEm: number | null = null;
  paradoEm: number | null = null;

  connect() {
    return this;
  }
  start(t = 0) {
    this.iniciadoEm = t;
  }
  stop(t = 0) {
    this.paradoEm = t;
  }
}

class FakeAudioContextComOsc {
  state: AudioContextState = 'suspended';
  currentTime = 1.0;
  readonly destination = {};
  readonly osciladores: FakeOscillatorNode[] = [];

  createGain(): GainNode {
    return {
      gain: {
        value: 1,
        cancelScheduledValues() {},
        setValueAtTime() {},
        linearRampToValueAtTime() {},
      },
      connect() {},
      disconnect() {},
    } as unknown as GainNode;
  }

  createBufferSource(): AudioBufferSourceNode {
    return {
      buffer: null,
      loop: false,
      onended: null,
      connect() {},
      disconnect() {},
      start() {},
      stop() {},
    } as unknown as AudioBufferSourceNode;
  }

  createOscillator(): OscillatorNode {
    const osc = new FakeOscillatorNode();
    this.osciladores.push(osc);
    return osc as unknown as OscillatorNode;
  }

  async decodeAudioData(): Promise<AudioBuffer> {
    return {
      duration: 2,
      length: 2000,
      numberOfChannels: 1,
      sampleRate: 1000,
      getChannelData: () => new Float32Array(2000),
    } as unknown as AudioBuffer;
  }

  async resume(): Promise<void> {
    this.state = 'running';
  }
}

describe('Etapa 9 — Wake Lock, VisualOrganico v2, Efeitos Sonoros de UI e Preferências', () => {
  const bancosCriados: string[] = [];

  function registrarDb(nome: string): string {
    bancosCriados.push(nome);
    return nome;
  }

  afterEach(async () => {
    while (bancosCriados.length > 0) {
      const nome = bancosCriados.pop()!;
      try {
        await deleteDB(nome);
      } catch {
        // Ignora
      }
    }
  });

  it('a) deveManterTelaLigada: tabela fase × visível (verdadeiro em todas as fases quando visível e falso quando oculto)', () => {
    const todasFases: Array<Estado['fase']> = [
      'tcle',
      'boas_vindas',
      'ciclo',
      'encerramento',
      'recusado',
      'cancelada',
    ];

    for (const fase of todasFases) {
      expect(deveManterTelaLigada(fase, true, true)).toBe(true);
      expect(deveManterTelaLigada(fase, false, true)).toBe(false);
      expect(deveManterTelaLigada(fase, true, false)).toBe(false);
    }
  });

  it('b) Wake Lock: solicita ao iniciar, não duplica sentinel, reobtém ao voltar visibilidade e ao evento "release", libera quando oculto, trata API ausente e NotAllowedError sem exceção', async () => {
    let requisicoes = 0;
    const sentinels: Array<
      WakeLockSentinelMinimo & { dispararRelease: () => void }
    > = [];

    const navOk = {
      wakeLock: {
        async request() {
          requisicoes++;
          const listeners = new Set<() => void>();
          const s = {
            released: false,
            async release() {
              this.released = true;
              for (const cb of listeners) cb();
            },
            addEventListener(tipo: 'release', cb: () => void) {
              if (tipo === 'release') listeners.add(cb);
            },
            dispararRelease() {
              this.released = true;
              for (const cb of listeners) cb();
            },
          };
          sentinels.push(s);
          return s;
        },
      },
    };

    const listenersVis = new Set<() => void>();
    const docFake: {
      visibilityState: DocumentVisibilityState;
      addEventListener(t: 'visibilitychange', cb: () => void): void;
      removeEventListener(t: 'visibilitychange', cb: () => void): void;
    } = {
      visibilityState: 'visible',
      addEventListener(_t, cb) {
        listenersVis.add(cb);
      },
      removeEventListener(_t, cb) {
        listenersVis.delete(cb);
      },
    };

    const store = criarSessionStore();
    const wl = criarGerenciadorWakeLock({
      navigator: navOk,
      document: docFake,
      store,
    });

    await wl.atualizar();
    expect(wl.obterEstado().status).toBe('ativo');
    expect(requisicoes).toBe(1);

    // Mudança de fase enquanto sentinel já está ativo NÃO duplica a requisição
    store.dispatch({
      tipo: 'ACEITAR',
      proximoNumero: 1,
      autorizaImagem: null,
    });
    await wl.atualizar();
    expect(requisicoes).toBe(1);

    // Evento "release" externo enquanto ainda visível -> reobtém automaticamente
    sentinels[0].dispararRelease();
    await new Promise((r) => setTimeout(r, 5));
    expect(requisicoes).toBe(2);
    expect(wl.obterEstado().status).toBe('ativo');

    // Página fica oculta -> libera o sentinel e passa para "inativo"
    docFake.visibilityState = 'hidden';
    for (const cb of listenersVis) cb();
    await new Promise((r) => setTimeout(r, 5));
    expect(wl.obterEstado().status).toBe('inativo');
    expect(sentinels[1].released).toBe(true);

    // Página volta a ficar visível -> reobtém
    docFake.visibilityState = 'visible';
    for (const cb of listenersVis) cb();
    await new Promise((r) => setTimeout(r, 5));
    expect(requisicoes).toBe(3);
    expect(wl.obterEstado().status).toBe('ativo');

    await wl.encerrar();
    expect(wl.obterEstado().status).toBe('inativo');

    // Caso 2: API ausente -> "indisponivel" sem exceção
    const wlSemApi = criarGerenciadorWakeLock({ navigator: {} });
    await wlSemApi.atualizar();
    expect(wlSemApi.obterEstado()).toEqual({ status: 'indisponivel' });

    // Caso 3: request rejeitado com NotAllowedError -> "negado" com motivo
    const wlNegado = criarGerenciadorWakeLock({
      navigator: {
        wakeLock: {
          async request() {
            throw new DOMException(
              'Wake Lock permission denied (battery saver)',
              'NotAllowedError'
            );
          },
        },
      },
      document: docFake,
    });
    await wlNegado.atualizar();
    expect(wlNegado.obterEstado().status).toBe('negado');
    expect(wlNegado.obterEstado().motivo).toContain('NotAllowedError');
  });

  it('c) AudioEngine.tocarTom: retorna false se contexto não "running"; retorna false com faixa musical soando; retorna true caso contrário sem alterar fontesMusicaAtivas', async () => {
    const fakeCtx = new FakeAudioContextComOsc();
    const fetchFake = (async () => ({
      ok: true,
      status: 200,
      headers: new Map([['content-type', 'audio/mpeg']]),
      arrayBuffer: async () => new ArrayBuffer(64),
    })) as unknown as typeof fetch;

    const engine = new AudioEngine(
      () => fakeCtx as unknown as AudioContext,
      fetchFake
    );

    // 1. Antes do unlock (contexto não-criado / suspended) -> false
    expect(engine.tocarTom(SOM_CONFIRMAR)).toBe(false);
    expect(fakeCtx.osciladores).toHaveLength(0);

    // 2. Após unlock (running) e sem faixa musical ativa -> true
    await engine.unlock();
    expect(engine.tocarTom(SOM_CONFIRMAR)).toBe(true);
    expect(fakeCtx.osciladores).toHaveLength(
      SOM_CONFIRMAR.frequenciasHz.length
    );
    expect(engine.depuracao().fontesMusicaAtivas).toBe(0);

    // 3. Enquanto uma faixa musical está soando -> false
    await engine.preload(['./audio/faixa.mp3']);
    void engine.tocarFaixa('./audio/faixa.mp3');
    expect(engine.depuracao().fontesMusicaAtivas).toBe(1);

    const osciladoresAntes = fakeCtx.osciladores.length;
    expect(engine.tocarTom(SOM_LIBERADO)).toBe(false);
    expect(fakeCtx.osciladores).toHaveLength(osciladoresAntes);
    expect(engine.depuracao().fontesMusicaAtivas).toBe(1);

    // 4. Após cancelar a faixa -> volta a retornar true
    engine.pararFaixa();
    expect(engine.tocarTom(SOM_LIBERADO)).toBe(true);
    expect(fakeCtx.osciladores).toHaveLength(
      osciladoresAntes + SOM_LIBERADO.frequenciasHz.length
    );
  });

  it('d) tocarEfeito respeita a preferência: desligada -> tocarTom nunca é chamado; ligada -> chamado com o descritor correto', () => {
    const descritoresChamados: unknown[] = [];
    const engineMock = {
      tocarTom(d: unknown) {
        descritoresChamados.push(d);
        return true;
      },
    };

    definirPreferenciaEfeitosUi(false);
    expect(tocarEfeito('confirmar', { engine: engineMock })).toBe(false);
    expect(tocarEfeito('liberado', { engine: engineMock })).toBe(false);
    expect(descritoresChamados).toHaveLength(0);

    definirPreferenciaEfeitosUi(true);
    expect(tocarEfeito('confirmar', { engine: engineMock })).toBe(true);
    expect(tocarEfeito('liberado', { engine: engineMock })).toBe(true);
    expect(descritoresChamados).toEqual([SOM_CONFIRMAR, SOM_LIBERADO]);
  });

  it('e) houveLiberacao: verdadeira apenas na transição sem pergunta -> com pergunta (sem interrupção); falsa em re-render, durante reprodução ou após interrupção/Retomar', () => {
    const baseSessao = {
      idParticipante: 'Participante_01',
      autorizaImagem: null,
      linhas: [],
      epoca: 1,
      batimentosAudiveis: false,
    };

    const vEditadoTocando = visaoCiclo({
      fase: 'ciclo',
      sessao: baseSessao,
      par: 1,
      etapa: {
        tipo: 'editado_tocando',
        interrompido: false,
        repeticoesEditado: 0,
        repeticoesOriginal: 0,
      },
    });

    const vEditadoInterrompido = visaoCiclo({
      fase: 'ciclo',
      sessao: baseSessao,
      par: 1,
      etapa: {
        tipo: 'editado_tocando',
        interrompido: true,
        repeticoesEditado: 0,
        repeticoesOriginal: 0,
      },
    });

    const vP1Liberada = visaoCiclo({
      fase: 'ciclo',
      sessao: baseSessao,
      par: 1,
      etapa: {
        tipo: 'p1_liberada',
        repeticoesEditado: 0,
        repeticoesOriginal: 0,
      },
    });

    const vOriginalTocando = visaoCiclo({
      fase: 'ciclo',
      sessao: baseSessao,
      par: 1,
      etapa: {
        tipo: 'original_tocando',
        reconheceu: 'Sim',
        interrompido: false,
        repeticoesEditado: 0,
        repeticoesOriginal: 0,
      },
    });

    const vP2Liberada = visaoCiclo({
      fase: 'ciclo',
      sessao: baseSessao,
      par: 1,
      etapa: {
        tipo: 'p2_liberada',
        reconheceu: 'Sim',
        repeticoesEditado: 0,
        repeticoesOriginal: 0,
      },
    });

    // 1. Transição real editado_tocando -> p1_liberada: TRUE
    expect(houveLiberacao(vEditadoTocando, vP1Liberada)).toBe(true);

    // 2. Re-render na mesma pergunta (p1_liberada -> p1_liberada): FALSE
    expect(houveLiberacao(vP1Liberada, vP1Liberada)).toBe(false);

    // 3. Ao responder P1 (p1_liberada -> original_tocando): FALSE (nenhum som ao clicar Sim/Não)
    expect(houveLiberacao(vP1Liberada, vOriginalTocando)).toBe(false);

    // 4. Ao clicar Ouvir novamente (p1_liberada -> editado_tocando): FALSE
    expect(houveLiberacao(vP1Liberada, vEditadoTocando)).toBe(false);

    // 5. Transição real original_tocando -> p2_liberada: TRUE
    expect(houveLiberacao(vOriginalTocando, vP2Liberada)).toBe(true);

    // 6. Interrupção e Retomar (editado_tocando <-> editado_interrompido): FALSE
    expect(houveLiberacao(vEditadoTocando, vEditadoInterrompido)).toBe(false);
    expect(houveLiberacao(vEditadoInterrompido, vEditadoTocando)).toBe(false);
    expect(houveLiberacao(vEditadoInterrompido, vP1Liberada)).toBe(false);

    // 7. Montagem inicial (null -> qualquer visão): FALSE
    expect(houveLiberacao(null, vEditadoTocando)).toBe(false);
    expect(houveLiberacao(null, vP1Liberada)).toBe(false);
  });

  it('f) Preferências no IndexedDB (store "meta", versão 2): padrão efeitosUi = true; salvar/obter funciona e não altera o store "sessoes"', async () => {
    expect(VERSAO_DB).toBe(2);
    const nomeDb = registrarDb(novoNomeDb());
    const repo = criarRepositorio(nomeDb);

    // Grava uma sessão no store "sessoes"
    const s1 = criarSessaoValida(1);
    await repo.salvarSessao(s1);

    // Sem registro prévio -> padrão { efeitosUi: true, volumeEditadasPct: 100, volumeOriginaisPct: 100 }
    expect(await repo.obterPreferencias()).toMatchObject({ efeitosUi: true });

    // Salva efeitosUi = false e lê de volta
    await repo.salvarPreferencias({ efeitosUi: false });
    expect(await repo.obterPreferencias()).toMatchObject({ efeitosUi: false });

    // Salva efeitosUi = true e lê de volta
    await repo.salvarPreferencias({ efeitosUi: true });
    expect(await repo.obterPreferencias()).toMatchObject({ efeitosUi: true });

    // Garante que o store "sessoes" permaneceu intacto
    const sessoes = await repo.listarSessoes();
    expect(sessoes).toEqual([s1]);
  });

  it('g & h) VisualOrganico v2: escolherModoVisual, tintaPorPar monotônica/limitada e partículas determinísticas', () => {
    // escolherModoVisual
    expect(escolherModoVisual('auto', 24)).toBe('leve');
    expect(escolherModoVisual('auto', 29.9)).toBe('leve');
    expect(escolherModoVisual('auto', 30)).toBe('completo');
    expect(escolherModoVisual('auto', 58)).toBe('completo');
    expect(escolherModoVisual('completo', 12)).toBe('completo');
    expect(escolherModoVisual('leve', 60)).toBe('leve');

    // tintaPorPar: pares 1..6 monotônicos e pares fora do intervalo (0 e 9) limitados a 1..6
    const t0 = tintaPorPar(0);
    const t1 = tintaPorPar(1);
    const t6 = tintaPorPar(6);
    const t9 = tintaPorPar(9);

    expect(t0).toEqual(t1);
    expect(t9).toEqual(t6);

    const calores = [1, 2, 3, 4, 5, 6].map((p) => tintaPorPar(p).calor);
    for (let i = 1; i < calores.length; i++) {
      expect(calores[i]).toBeGreaterThan(calores[i - 1]);
    }

    // Partículas determinísticas: 12 partículas fixas idênticas entre chamadas
    const pA = obterParticulasDeterministicas();
    const pB = obterParticulasDeterministicas();
    expect(pA.length).toBeGreaterThanOrEqual(10);
    expect(pA.length).toBeLessThanOrEqual(14);
    expect(pA).toEqual(pB);
  });
});
