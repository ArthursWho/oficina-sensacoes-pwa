import 'fake-indexeddb/auto';
import fs from 'node:fs';
import path from 'node:path';
import { deleteDB } from 'idb';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as XLSX from 'xlsx';
import {
  AudioEngine,
  OpcoesTocarFaixa,
  ResultadoFaixa,
} from '../audio/AudioEngine';
import {
  PERCENTUAL_VOLUME_MAX,
  PERCENTUAL_VOLUME_MIN,
  PERCENTUAL_VOLUME_PADRAO,
} from '../audio/config';
import { nivelParaGanho } from '../audio/volume';
import { STRINGS } from '../content/strings';
import { TRACKS } from '../content/tracks';
import { gerarCsv, gerarCsvBlob } from '../export/csv';
import { achatarSessoes } from '../export/linhas';
import { gerarXlsx } from '../export/xlsx';
import { criarControlador, EngineControlador } from '../session/controlador';
import { criarSessionStore } from '../session/store';
import { LinhaSessao, SessaoConcluida } from '../session/tipos';
import { formatarIdParticipante } from '../session/utilidades';
import { VERSAO_DB } from '../storage/db';
import {
  definirModoEnsaio,
  obterModoEnsaio,
  resetarModoEnsaioParaTestes,
} from '../storage/ensaio';
import {
  NOME_BANCO_DESENVOLVIMENTO,
  NOME_BANCO_ENSAIO,
  NOME_BANCO_PRODUCAO,
} from '../storage/nomesBanco';
import {
  criarProxyRepositorioAtivo,
  criarRepositorio,
  criarRepositorioPreferencias,
} from '../storage/repositorio';
import {
  aplicarPassoVolume,
  criarControladorExemploVolume,
  criarPersistenciaVolumeDebounced,
  iniciarRepeticaoSegurar,
  layoutLinhaVolumePorLargura,
  podeAjustarVolume,
  podeRestaurarVolumePadrao,
} from '../ui/menu/logicaVolume';

// --- FakeAudioContext para inspecionar conexões e rampas de GainNode por versão ---

class FakeAudioParam {
  value = 1;
  readonly eventos: Array<{ tipo: string; valor?: number; tempo: number }> = [];

  cancelScheduledValues(tempo: number) {
    this.eventos.push({ tipo: 'cancel', tempo });
    return this;
  }

  setValueAtTime(valor: number, tempo: number) {
    this.value = valor;
    this.eventos.push({ tipo: 'set', valor, tempo });
    return this;
  }

  linearRampToValueAtTime(valor: number, tempo: number) {
    this.value = valor;
    this.eventos.push({ tipo: 'ramp', valor, tempo });
    return this;
  }
}

class FakeGainNode {
  readonly gain = new FakeAudioParam();
  readonly conectados: unknown[] = [];

  connect(dest: unknown) {
    this.conectados.push(dest);
    return dest;
  }

  disconnect() {}
}

class FakeBufferSource {
  buffer: AudioBuffer | null = null;
  loop = false;
  onended: (() => void) | null = null;
  destinoConectado: unknown = null;

  connect(dest: unknown) {
    this.destinoConectado = dest;
    return dest;
  }

  disconnect() {}
  start() {}
  stop() {
    this.onended?.();
  }
  terminarNaturalmente() {
    this.onended?.();
  }
}

class FakeAudioContextVol {
  state: AudioContextState = 'suspended';
  currentTime = 2.0;
  readonly destination = { nome: 'destination' };
  readonly gains: FakeGainNode[] = [];
  readonly sources: FakeBufferSource[] = [];

  createGain(): GainNode {
    const g = new FakeGainNode();
    this.gains.push(g);
    return g as unknown as GainNode;
  }

  createBufferSource(): AudioBufferSourceNode {
    const s = new FakeBufferSource();
    this.sources.push(s);
    return s as unknown as AudioBufferSourceNode;
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

function criarSessaoFixture(n: number): SessaoConcluida {
  const id = formatarIdParticipante(n);
  const linhas: LinhaSessao[] = TRACKS.map((t, idx) => ({
    id_participante: id,
    data_hora: '2026-11-19 09:00:00',
    ordem_musica: idx + 1,
    musica: t.rotulo,
    reconheceu: idx % 2 === 0 ? 'Sim' : 'Não',
    tipo_pergunta_2: idx % 2 === 0 ? 'Acertou' : 'Surpreendeu',
    resposta_pergunta_2: 'Sim',
    repeticoes_editado: idx % 2,
    repeticoes_original: 0,
  }));
  return { id_participante: id, linhas };
}

describe('Versão 1.1.0 — Controle de Volume Separado (Editadas e Originais)', () => {
  const bancosParaLimpar = [
    NOME_BANCO_PRODUCAO,
    NOME_BANCO_ENSAIO,
    NOME_BANCO_DESENVOLVIMENTO,
  ];

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(async () => {
    vi.useRealTimers();
    resetarModoEnsaioParaTestes();
    for (const nome of bancosParaLimpar) {
      try {
        await deleteDB(nome);
      } catch {
        // Ignora
      }
    }
  });

  it('a) nivelParaGanho: 100 -> 1; 10 -> 0.01; 50 -> 0.25; limites aplicados para fora de [10, 100]; arredondamento e monotonicidade', () => {
    expect(PERCENTUAL_VOLUME_MIN).toBe(10);
    expect(PERCENTUAL_VOLUME_MAX).toBe(100);
    expect(PERCENTUAL_VOLUME_PADRAO).toBe(100);

    expect(nivelParaGanho(100)).toBe(1);
    expect(nivelParaGanho(10)).toBe(0.01);
    expect(nivelParaGanho(50)).toBe(0.25);

    // Limites abaixo de 10 e acima de 100
    expect(nivelParaGanho(0)).toBe(0.01);
    expect(nivelParaGanho(-25)).toBe(0.01);
    expect(nivelParaGanho(150)).toBe(1);

    // Arredondamento para inteiro (ex.: 49.6 -> 50 -> 0.25)
    expect(nivelParaGanho(49.6)).toBe(0.25);
    expect(nivelParaGanho(50.4)).toBe(0.25);

    // Monotonicidade estrita de 10 a 100
    let anterior = 0;
    for (let p = 10; p <= 100; p++) {
      const g = nivelParaGanho(p);
      expect(g).toBeGreaterThan(anterior);
      anterior = g;
    }
  });

  it('b) AudioEngine: definirNiveisVersao limita a [0.01, 1]; tocarFaixa sem opcoes mantém comportamento antigo; com opcoes aplica multiplicador da versão e rampa de 30 ms em faixa tocando', async () => {
    const fakeCtx = new FakeAudioContextVol();
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

    // 1. Limites [0.01, 1.0] em definirNiveisVersao
    engine.definirNiveisVersao({ editado: 0.0001, original: 2.5 });
    expect(engine.obterNiveisVersao()).toEqual({
      editado: 0.01,
      original: 1.0,
    });

    await engine.unlock();
    await engine.preload(['./audio/ed.mp3', './audio/or.mp3']);

    // No unlock, foram criados 3 gains base: [0]=gainMestre, [1]=gainBatimentos, [2]=gainMusica
    const gainMusica = fakeCtx.gains[2];

    // 2. tocarFaixa SEM opcoes: conecta direto ao gainMusica (comportamento antigo intacto)
    const pSemOpcao = engine.tocarFaixa('./audio/ed.mp3');
    expect(fakeCtx.sources[0].destinoConectado).toBe(gainMusica);
    fakeCtx.sources[0].terminarNaturalmente();
    await expect(pSemOpcao).resolves.toBe('fim');

    // 3. Configura ganhos distintos (editado = 0.25, original = 0.64) e toca com { versao: "editado" }
    engine.definirNiveisVersao({ editado: 0.25, original: 0.64 });
    // Foram criados os 2 GainNodes de versão: [3]=gainVersaoEditado, [4]=gainVersaoOriginal
    const gainEditado = fakeCtx.gains[3];
    const gainOriginal = fakeCtx.gains[4];
    expect(gainEditado.gain.value).toBe(0.25);
    expect(gainOriginal.gain.value).toBe(0.64);

    const pEditado = engine.tocarFaixa('./audio/ed.mp3', {
      versao: 'editado',
    });
    expect(fakeCtx.sources[1].destinoConectado).toBe(gainEditado);

    // 4. Alterar nível ENQUANTO a faixa toca aplica rampa linear de ~30 ms (currentTime 2.0 + 0.03 = 2.03)
    engine.definirNiveisVersao({ editado: 0.49, original: 0.64 });
    const ultimoEventoEditado =
      gainEditado.gain.eventos[gainEditado.gain.eventos.length - 1];
    expect(ultimoEventoEditado).toEqual({
      tipo: 'ramp',
      valor: 0.49,
      tempo: 2.03,
    });

    fakeCtx.sources[1].terminarNaturalmente();
    await expect(pEditado).resolves.toBe('fim');

    // 5. Toca com { versao: "original" } -> conecta ao gainOriginal
    const pOriginal = engine.tocarFaixa('./audio/or.mp3', {
      versao: 'original',
    });
    expect(fakeCtx.sources[2].destinoConectado).toBe(gainOriginal);
    fakeCtx.sources[2].terminarNaturalmente();
    await expect(pOriginal).resolves.toBe('fim');
  });

  it('c) Controlador: o efeito tocarFaixa passa a versao ("editado" e "original") ao engine', async () => {
    const store = criarSessionStore();
    const chamadasTocarFaixa: Array<{
      src: string;
      opcoes?: OpcoesTocarFaixa;
    }> = [];
    const resolvers: Array<(r: ResultadoFaixa) => void> = [];

    const engineFalso: EngineControlador = {
      iniciarBatimentos() {},
      pararTudo() {},
      async fadeOutBatimentos() {},
      async fadeInBatimentos() {},
      tocarFaixa(src, opcoes) {
        chamadasTocarFaixa.push({ src, opcoes });
        return new Promise<ResultadoFaixa>((r) => resolvers.push(r));
      },
    };

    const ctrl = criarControlador(engineFalso, store);

    store.dispatch({
      tipo: 'ACEITAR',
      proximoNumero: 1,
      autorizaImagem: null,
    });
    store.dispatch({ tipo: 'INICIAR' });
    await ctrl.aguardarFila();

    expect(chamadasTocarFaixa[0]).toEqual({
      src: TRACKS[0].srcEditado,
      opcoes: { versao: 'editado' },
    });

    resolvers.shift()!('fim');
    await Promise.resolve();

    store.dispatch({ tipo: 'RESPONDER_P1', resposta: 'Sim' });
    await ctrl.aguardarFila();

    expect(chamadasTocarFaixa[1]).toEqual({
      src: TRACKS[0].srcOriginal,
      opcoes: { versao: 'original' },
    });

    ctrl.desconectar();
  });

  it('d) Preferências: percentuais padrão 100 quando ausentes; ida e volta no IndexedDB; ficam SEMPRE no banco de PRODUÇÃO mesmo com Modo de ensaio ligado; efeitosUi preservado e sessoes/versão intactos', async () => {
    vi.useRealTimers();
    expect(VERSAO_DB).toBe(2);

    const repoProducao = criarRepositorio(NOME_BANCO_PRODUCAO);
    const repoEnsaio = criarRepositorio(NOME_BANCO_ENSAIO);
    const proxy = criarProxyRepositorioAtivo(
      () => 'producao',
      () => obterModoEnsaio()
    );
    const repoPrefs = criarRepositorioPreferencias(() => 'producao');

    // Grava uma sessão no banco de produção para garantir que o store "sessoes" não é afetado
    const s1 = criarSessaoFixture(1);
    await repoProducao.salvarSessao(s1);

    // 1. Sem registro prévio -> padrão { efeitosUi: true, volumeEditadasPct: 100, volumeOriginaisPct: 100 }
    expect(await repoPrefs.obterPreferencias()).toEqual({
      efeitosUi: true,
      volumeEditadasPct: 100,
      volumeOriginaisPct: 100,
    });

    // 2. Salva efeitosUi = false no banco de produção
    await repoPrefs.salvarPreferencias({ efeitosUi: false });

    // 3. Liga o Modo de ensaio!
    definirModoEnsaio(true, { fase: 'tcle' });
    expect(obterModoEnsaio()).toBe(true);
    expect(proxy.nomeBancoVigente()).toBe(NOME_BANCO_ENSAIO);
    expect(proxy.nomeBancoPreferencias()).toBe(NOME_BANCO_PRODUCAO);

    // Salva volumes (82% e 65%) COM o Modo de ensaio ligado (tanto via repoPrefs quanto via proxy)
    await proxy.salvarPreferencias({
      volumeEditadasPct: 82,
      volumeOriginaisPct: 65,
    });

    // Verifica que foi salvo no banco de PRODUÇÃO e que efeitosUi = false foi preservado!
    expect(await repoProducao.obterPreferencias()).toEqual({
      efeitosUi: false,
      volumeEditadasPct: 82,
      volumeOriginaisPct: 65,
    });

    // Desliga o Modo de ensaio -> os valores continuam idênticos no banco de produção
    definirModoEnsaio(false, { fase: 'tcle' });
    expect(await repoPrefs.obterPreferencias()).toEqual({
      efeitosUi: false,
      volumeEditadasPct: 82,
      volumeOriginaisPct: 65,
    });

    // O banco de ensaio não recebeu preferências e o store "sessoes" de produção segue intacto
    expect(await repoEnsaio.contarSessoes()).toBe(0);
    expect(await repoProducao.listarSessoes()).toEqual([s1]);
  });

  it('e) Persistência automática: debounce (~400 ms agrupa várias mudanças rápidas em 1 gravação) e flush imediato ao fechar o menu', async () => {
    const gravacoes: Array<{
      volumeEditadasPct: number;
      volumeOriginaisPct: number;
    }> = [];
    const agendador = criarPersistenciaVolumeDebounced(async (v) => {
      gravacoes.push(v);
    }, 400);

    // 5 mudanças rápidas dentro de 200 ms -> ainda nenhuma gravação
    agendador.agendar({ editadasPct: 95, originaisPct: 100 });
    vi.advanceTimersByTime(100);
    agendador.agendar({ editadasPct: 90, originaisPct: 100 });
    vi.advanceTimersByTime(100);
    agendador.agendar({ editadasPct: 85, originaisPct: 75 });
    expect(gravacoes).toHaveLength(0);

    // Após 400 ms do último toque -> exatamente 1 gravação com o estado final (85, 75)
    vi.advanceTimersByTime(400);
    await Promise.resolve();
    expect(gravacoes).toEqual([
      { volumeEditadasPct: 85, volumeOriginaisPct: 75 },
    ]);

    // Mudança seguida de fechamento imediato do menu (flush) -> grava na hora sem esperar os 400 ms
    agendador.agendar({ editadasPct: 70, originaisPct: 60 });
    expect(gravacoes).toHaveLength(1);
    await agendador.flush();
    expect(gravacoes).toEqual([
      { volumeEditadasPct: 85, volumeOriginaisPct: 75 },
      { volumeEditadasPct: 70, volumeOriginaisPct: 60 },
    ]);
  });

  it('f) podeAjustarVolume: verdadeiro apenas na fase "tcle" e falso nas demais fases', () => {
    expect(podeAjustarVolume({ fase: 'tcle' })).toBe(true);
    expect(podeAjustarVolume({ fase: 'recusado' })).toBe(false);
    expect(podeAjustarVolume({ fase: 'cancelada' })).toBe(false);
    expect(
      podeAjustarVolume({
        fase: 'boas_vindas',
        sessao: {
          idParticipante: 'Participante_01',
          autorizaImagem: null,
          linhas: [],
          epoca: 0,
          batimentosAudiveis: true,
        },
      })
    ).toBe(false);
  });

  it('g) Lógica do exemplo: unlock síncrono no clique, tocar editada, trocar para original para a primeira, botão Parar, parar ao fechar/mudar fase, erro inline e zero eventos no store', async () => {
    const store = criarSessionStore();
    const eventosDespachados: string[] = [];
    store.assinar((_st, _res, ev) => eventosDespachados.push(ev.tipo));

    let unlockSincronoNoMesmoTick = false;
    let chamadasPararFaixa = 0;
    const faixasAtivas: Array<{
      src: string;
      versao?: string;
      resolver: (r: ResultadoFaixa) => void;
    }> = [];
    let unlockOk = true;

    const engineFake = {
      unlock() {
        unlockSincronoNoMesmoTick = true;
        return Promise.resolve(unlockOk);
      },
      tocarFaixa(src: string, opcoes?: OpcoesTocarFaixa) {
        return new Promise<ResultadoFaixa>((resolve) => {
          faixasAtivas.push({ src, versao: opcoes?.versao, resolver: resolve });
        });
      },
      pararFaixa() {
        chamadasPararFaixa++;
      },
      definirNiveisVersao() {},
    };

    const ctrlEx = criarControladorExemploVolume({
      engine: engineFake,
      garantirPreload: async () => ({
        ok: [TRACKS[0].srcEditado, TRACKS[0].srcOriginal],
        falhas: [],
        msPorArquivo: {},
        tempoTotalMs: 5,
      }),
    });

    // 1. Clicar em Tocar exemplo (Editadas): unlock() é chamado SINCRONAMENTE no mesmo tick
    unlockSincronoNoMesmoTick = false;
    ctrlEx.clicarExemplo('editado', { fase: 'tcle' });
    expect(unlockSincronoNoMesmoTick).toBe(true);
    expect(ctrlEx.obterEstado().tocando).toBe('editado');

    await Promise.resolve();
    await Promise.resolve();
    expect(faixasAtivas).toHaveLength(1);
    expect(faixasAtivas[0].src).toBe(TRACKS[0].srcEditado);
    expect(faixasAtivas[0].versao).toBe('editado');

    // 2. Apertar Tocar exemplo da outra caixa (Originais) PARA o primeiro e inicia o segundo
    ctrlEx.clicarExemplo('original', { fase: 'tcle' });
    expect(chamadasPararFaixa).toBe(1);
    expect(ctrlEx.obterEstado().tocando).toBe('original');

    await Promise.resolve();
    await Promise.resolve();
    expect(faixasAtivas).toHaveLength(2);
    expect(faixasAtivas[1].src).toBe(TRACKS[0].srcOriginal);
    expect(faixasAtivas[1].versao).toBe('original');

    // 3. Apertar o botão da própria caixa que está tocando ("Parar") encerra a reprodução
    ctrlEx.clicarExemplo('original', { fase: 'tcle' });
    expect(chamadasPararFaixa).toBe(2);
    expect(ctrlEx.obterEstado().tocando).toBeNull();

    // 4. Parar ao fechar o menu ou mudar de fase
    ctrlEx.clicarExemplo('editado', { fase: 'tcle' });
    expect(ctrlEx.obterEstado().tocando).toBe('editado');
    ctrlEx.pararSeTocando();
    expect(ctrlEx.obterEstado().tocando).toBeNull();

    // 5. Erro de áudio mostra volumeErroExemplo em linha sem lançar exceção
    unlockOk = false;
    ctrlEx.clicarExemplo('editado', { fase: 'tcle' });
    await Promise.resolve();
    await Promise.resolve();
    expect(ctrlEx.obterEstado().tocando).toBeNull();
    expect(ctrlEx.obterEstado().erroEditadas).toBe(STRINGS.volumeErroExemplo);

    // 6. Nenhum evento foi despachado no store de sessão
    expect(eventosDespachados).toEqual([]);
  });

  it('h) Botões − e +: passo de 1%, limites 10 e 100, repetição ao segurar (relógio falso) e restaurar padrão só habilitado quando ≠ 100', () => {
    expect(aplicarPassoVolume(100, -1)).toBe(99);
    expect(aplicarPassoVolume(100, 1)).toBe(100);
    expect(aplicarPassoVolume(10, -1)).toBe(10);
    expect(aplicarPassoVolume(10, 1)).toBe(11);

    // Restaurar padrão só habilitado quando algum valor != 100
    expect(podeRestaurarVolumePadrao(100, 100)).toBe(false);
    expect(podeRestaurarVolumePadrao(99, 100)).toBe(true);
    expect(podeRestaurarVolumePadrao(100, 80)).toBe(true);

    // Repetição ao segurar botão [ − ] a partir de 100%
    let valor = 100;
    const parar = iniciarRepeticaoSegurar(() => {
      valor = aplicarPassoVolume(valor, -1);
    }, 120);

    // Passo imediato no pointerdown -> 99
    expect(valor).toBe(99);

    // Após 600 ms segurando -> diminuiu vários pontos percentuais continuamente
    vi.advanceTimersByTime(600);
    expect(valor).toBeLessThan(95);

    const valorAoSoltar = valor;
    parar();
    vi.advanceTimersByTime(1000);
    expect(valor).toBe(valorAoSoltar);
  });

  it('i & j) Layout responsivo (>= 640 px em linha vs empilhado), strings exatas e verificações estáticas dos ajustes visuais do menu', () => {
    expect(layoutLinhaVolumePorLargura(640)).toBe('em-linha');
    expect(layoutLinhaVolumePorLargura(1280)).toBe('em-linha');
    expect(layoutLinhaVolumePorLargura(639)).toBe('empilhado');
    expect(layoutLinhaVolumePorLargura(412)).toBe('empilhado');

    // Strings exatas exigidas
    expect(STRINGS.volumeTitulo).toBe('Volume das faixas');
    expect(STRINGS.volumeApoio1).toBe(
      'Só é possível abaixar. Para aumentar, use o volume do tablet.'
    );
    expect(STRINGS.volumeApoio2).toBe(
      'Mantenha os mesmos valores durante toda a coleta.'
    );
    expect(STRINGS.volumeEditadas).toBe('Editadas');
    expect(STRINGS.volumeOriginais).toBe('Originais');
    expect(STRINGS.volumeTocarExemplo).toBe('Tocar exemplo');
    expect(STRINGS.volumeParar).toBe('Parar');
    expect(STRINGS.volumeRestaurar).toBe('Restaurar padrão (100%)');
    expect(STRINGS.volumeIndisponivel).toBe(
      'Disponível apenas na tela inicial.'
    );
    expect(STRINGS.volumeErroExemplo).toBe(
      'Não foi possível tocar o exemplo. Verifique o áudio do aparelho.'
    );

    // Verificação dos ajustes visuais do item 4 no código do MenuOperador e CSS
    const menuTsx = fs.readFileSync(
      path.resolve(process.cwd(), 'src/ui/menu/MenuOperador.tsx'),
      'utf-8'
    );
    const styleCss = fs.readFileSync(
      path.resolve(process.cwd(), 'src/style.css'),
      'utf-8'
    );
    const tokensCss = fs.readFileSync(
      path.resolve(process.cwd(), 'src/ui/tokens.css'),
      'utf-8'
    );

    // 1. Caixas de contagem sem texto repetido "{STRINGS.contadorSessoes}: {totalSessoes}"
    expect(menuTsx).not.toContain('{STRINGS.contadorSessoes}: {totalSessoes}');
    expect(menuTsx).not.toContain('{STRINGS.naoExportadas}: {naoExportadas}');
    expect(menuTsx).toContain('ui-operator-counter-number');

    // 2. Cabeçalho do menu com classe sticky e position: sticky
    expect(menuTsx).toContain('ui-operator-header--sticky');
    expect(styleCss).toContain('position: sticky');

    // 3. Botões desabilitados com visual unificado em tokens.css
    expect(tokensCss).toContain('.ui-btn:disabled');
    expect(tokensCss).toContain('background-color: var(--surface-alt) !important');
  });

  it('k) Regressão: CSV e XLSX permanecem byte a byte / estruturalmente idênticos aos da v1.0.0 com as 9 colunas exatas', async () => {
    vi.useRealTimers();
    const s1 = criarSessaoFixture(1);
    const linhas = achatarSessoes([s1]);

    const csvEsperado =
      'id_participante;data_hora;ordem_musica;musica;reconheceu;tipo_pergunta_2;resposta_pergunta_2;repeticoes_editado;repeticoes_original\r\n' +
      'Participante_01;2026-11-19 09:00:00;1;Cheia de Manias — Raça Negra;Sim;Acertou;Sim;0;0\r\n' +
      'Participante_01;2026-11-19 09:00:00;2;Three Little Birds — Bob Marley & The Wailers;Não;Surpreendeu;Sim;1;0\r\n' +
      'Participante_01;2026-11-19 09:00:00;3;Anunciação — Alceu Valença;Sim;Acertou;Sim;0;0\r\n' +
      'Participante_01;2026-11-19 09:00:00;4;Evidências — Chitãozinho & Xororó;Não;Surpreendeu;Sim;1;0\r\n' +
      'Participante_01;2026-11-19 09:00:00;5;Take On Me — a-ha;Sim;Acertou;Sim;0;0\r\n' +
      'Participante_01;2026-11-19 09:00:00;6;Thriller — Michael Jackson;Não;Surpreendeu;Sim;1;0\r\n';

    expect(gerarCsv(linhas)).toBe(csvEsperado);

    const blobCsv = gerarCsvBlob(linhas);
    const bytesCsv = new Uint8Array(await blobCsv.arrayBuffer());
    const bytesEsperados = new Uint8Array([
      0xef,
      0xbb,
      0xbf,
      ...new TextEncoder().encode(csvEsperado),
    ]);
    expect(bytesCsv).toEqual(bytesEsperados);

    const blobXlsx = await gerarXlsx(linhas);
    const wb = XLSX.read(await blobXlsx.arrayBuffer(), { type: 'array' });
    expect(wb.SheetNames).toEqual(['sessoes']);
    const aoa = XLSX.utils.sheet_to_json<Array<string | number>>(
      wb.Sheets['sessoes'],
      { header: 1 }
    );
    expect(aoa).toHaveLength(7);
    expect(aoa[0]).toHaveLength(9);
  });
});
