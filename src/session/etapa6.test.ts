import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EventoEstadoAudio, ResultadoFaixa } from '../audio/AudioEngine';
import { STRINGS } from '../content/strings';
import { TRACKS } from '../content/tracks';
import { TOTAL_PARES, TRANSICAO_PAR_MS } from './config';
import {
  criarControlador,
  EngineControlador,
  retomarAudioNoGesto,
} from './controlador';
import { criarSessionStore } from './store';
import { Estado, Resposta } from './tipos';
import { validarSessao } from './utilidades';
import { visaoCiclo } from './visao';

interface FaixaPendenteFake {
  src: string;
  resolver: (res: ResultadoFaixa) => void;
  rejeitar: (err: Error) => void;
}

function criarEngineFalsoControlavel() {
  const chamadas: string[] = [];
  const faixasPendentes: FaixaPendenteFake[] = [];
  const ouvintesEstado = new Set<(ev: EventoEstadoAudio) => void>();

  let resolverFadeOutPendente: (() => void) | null = null;
  let bloquearProximoFadeOut = false;
  let rejeitarProximoTocarFaixa = false;
  let chamadasTentarRetomar = 0;

  const engine: EngineControlador = {
    iniciarBatimentos(opcoes) {
      chamadas.push(`iniciarBatimentos:${opcoes?.fadeInMs ?? 0}`);
    },
    pararTudo() {
      chamadas.push('pararTudo');
    },
    async fadeOutBatimentos() {
      chamadas.push('fadeOutBatimentos:inicio');
      if (bloquearProximoFadeOut) {
        await new Promise<void>((r) => {
          resolverFadeOutPendente = r;
        });
      }
      chamadas.push('fadeOutBatimentos:fim');
    },
    async fadeInBatimentos() {
      chamadas.push('fadeInBatimentos');
    },
    tocarFaixa(src: string): Promise<ResultadoFaixa> {
      chamadas.push(`tocarFaixa:${src}`);
      if (rejeitarProximoTocarFaixa) {
        rejeitarProximoTocarFaixa = false;
        return Promise.reject(new Error(`Falha simulada ao tocar ${src}`));
      }
      return new Promise<ResultadoFaixa>((resolve, reject) => {
        faixasPendentes.push({
          src,
          resolver: resolve,
          rejeitar: reject,
        });
      });
    },
    async tentarRetomar() {
      chamadasTentarRetomar++;
      chamadas.push('tentarRetomar');
      return true;
    },
    aoMudarEstado(cb) {
      ouvintesEstado.add(cb);
      return () => {
        ouvintesEstado.delete(cb);
      };
    },
  };

  return {
    engine,
    chamadas,
    faixasPendentes,
    get chamadasTentarRetomar() {
      return chamadasTentarRetomar;
    },
    setBloquearProximoFadeOut(v: boolean) {
      bloquearProximoFadeOut = v;
    },
    liberarFadeOutPendente() {
      resolverFadeOutPendente?.();
      resolverFadeOutPendente = null;
    },
    setRejeitarProximoTocarFaixa(v: boolean) {
      rejeitarProximoTocarFaixa = v;
    },
    emitirEventoEstado(ev: EventoEstadoAudio) {
      for (const cb of ouvintesEstado) {
        cb(ev);
      }
    },
  };
}

describe('Etapa 6 — Ciclo Experimental, Controlador Completo e Visão do Ciclo', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('a) tocarFaixa (efeito): chama src correto; "fim" despacha AUDIO_*_FIM; "cancelada" não despacha; "interrompida" e rejeição despacham AUDIO_INTERROMPIDO', async () => {
    const fake = criarEngineFalsoControlavel();
    const store = criarSessionStore();
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const ctrl = criarControlador(fake.engine, store);

    store.dispatch({
      tipo: 'ACEITAR',
      proximoNumero: 1,
      autorizaImagem: null,
    });
    store.dispatch({ tipo: 'INICIAR' });
    await ctrl.aguardarFila();

    // 1. Verifica que chamou o srcEditado do Par 1
    expect(fake.faixasPendentes).toHaveLength(1);
    expect(fake.faixasPendentes[0].src).toBe(TRACKS[0].srcEditado);

    // 2. Resolver com "fim" despacha AUDIO_EDITADO_FIM e leva para p1_liberada
    fake.faixasPendentes.shift()!.resolver('fim');
    await Promise.resolve();
    const stAposFim = store.getEstado();
    expect(stAposFim.fase === 'ciclo' && stAposFim.etapa.tipo).toBe(
      'p1_liberada'
    );

    // 3. Ouvir novamente e resolver com "cancelada" NÃO altera o estado
    store.dispatch({ tipo: 'OUVIR_NOVAMENTE' });
    await ctrl.aguardarFila();
    const stDuranteEditado = store.getEstado();
    fake.faixasPendentes.shift()!.resolver('cancelada');
    await Promise.resolve();
    expect(store.getEstado()).toBe(stDuranteEditado);

    // 4. Resolver uma faixa ativa com "interrompida" despacha AUDIO_INTERROMPIDO
    // Vamos simular que a mesma geração sofreu interrupção (ou forçar via nova tentativa após fim)
    // Como a promessa anterior já resolveu "cancelada", vamos simular interrupção via RETOMAR após rejeição:
    // Primeiro destrava a etapa atual e responde P1 para testar no original_tocando:
    store.dispatch({
      tipo: 'AUDIO_EDITADO_FIM',
      epoca:
        stDuranteEditado.fase === 'ciclo' ? stDuranteEditado.sessao.epoca : 2,
    });
    store.dispatch({ tipo: 'RESPONDER_P1', resposta: 'Sim' });
    await ctrl.aguardarFila();

    expect(fake.faixasPendentes[0].src).toBe(TRACKS[0].srcOriginal);
    fake.faixasPendentes.shift()!.resolver('interrompida');
    await Promise.resolve();

    const stInterrompido = store.getEstado();
    expect(
      stInterrompido.fase === 'ciclo' &&
        stInterrompido.etapa.tipo === 'original_tocando' &&
        stInterrompido.etapa.interrompido
    ).toBe(true);

    // 5. Rejeição de tocarFaixa também despacha AUDIO_INTERROMPIDO
    fake.setRejeitarProximoTocarFaixa(true);
    store.dispatch({ tipo: 'RETOMAR' });
    await ctrl.aguardarFila();
    await Promise.resolve();

    const stAposRejeicao = store.getEstado();
    expect(
      stAposRejeicao.fase === 'ciclo' &&
        stAposRejeicao.etapa.tipo === 'original_tocando' &&
        stAposRejeicao.etapa.interrompido
    ).toBe(true);
    expect(errorSpy).toHaveBeenCalled();

    errorSpy.mockRestore();
  });

  it('b) tocarFaixa NÃO bloqueia a fila: efeitos seguintes e eventos novos fluem enquanto a faixa toca', async () => {
    const fake = criarEngineFalsoControlavel();
    const store = criarSessionStore();
    const ctrl = criarControlador(fake.engine, store);

    store.dispatch({
      tipo: 'ACEITAR',
      proximoNumero: 1,
      autorizaImagem: null,
    });
    store.dispatch({ tipo: 'INICIAR' });

    // aguardarFila() resolve imediatamente mesmo com a promessa de tocarFaixa ainda pendente
    await ctrl.aguardarFila();
    expect(fake.faixasPendentes).toHaveLength(1);

    // Enquanto a faixa ainda está pendente, um novo evento (ex.: CANCELAR) flui imediatamente
    store.dispatch({ tipo: 'CANCELAR' });
    await ctrl.aguardarFila();
    expect(fake.chamadas[fake.chamadas.length - 1]).toBe('pararTudo');
  });

  it('c) Ordem: fadeOutBatimentos é aguardado ANTES de tocarFaixa', async () => {
    const fake = criarEngineFalsoControlavel();
    const store = criarSessionStore();
    const ctrl = criarControlador(fake.engine, store);

    store.dispatch({
      tipo: 'ACEITAR',
      proximoNumero: 1,
      autorizaImagem: null,
    });
    await ctrl.aguardarFila();

    fake.setBloquearProximoFadeOut(true);
    store.dispatch({ tipo: 'INICIAR' });

    // Enquanto o fadeOutBatimentos não resolveu, tocarFaixa ainda não foi chamado
    await Promise.resolve();
    expect(fake.chamadas).toEqual([
      'iniciarBatimentos:1000',
      'fadeOutBatimentos:inicio',
    ]);

    // Libera o fadeOut -> tocarFaixa é chamado logo após fadeOutBatimentos:fim
    fake.liberarFadeOutPendente();
    await ctrl.aguardarFila();

    expect(fake.chamadas).toEqual([
      'iniciarBatimentos:1000',
      'fadeOutBatimentos:inicio',
      'fadeOutBatimentos:fim',
      `tocarFaixa:${TRACKS[0].srcEditado}`,
    ]);
  });

  it('d) Preempção: CANCELAR durante um fadeOutBatimentos pendente -> tocarFaixa NUNCA é chamado depois; pararTudo executado', async () => {
    const fake = criarEngineFalsoControlavel();
    const store = criarSessionStore();
    const ctrl = criarControlador(fake.engine, store);

    store.dispatch({
      tipo: 'ACEITAR',
      proximoNumero: 1,
      autorizaImagem: null,
    });
    await ctrl.aguardarFila();

    fake.setBloquearProximoFadeOut(true);
    store.dispatch({ tipo: 'INICIAR' });
    await Promise.resolve();

    // Cancela enquanto o fadeOut ainda está em andamento
    store.dispatch({ tipo: 'CANCELAR' });

    // Mesmo quando o fadeOut antigo termina depois, o tocarFaixa do lote antigo foi preemptado e descartado
    fake.liberarFadeOutPendente();
    await ctrl.aguardarFila();

    expect(fake.chamadas).toContain('pararTudo');
    expect(
      fake.chamadas.some((c) => c.startsWith('tocarFaixa:'))
    ).toBe(false);
    expect(fake.faixasPendentes).toHaveLength(0);
  });

  it('e) agendarTransicao: com timers falsos, despacha TRANSICAO_FIM após ms; é cancelado por pararTudo', async () => {
    const fake = criarEngineFalsoControlavel();
    const store = criarSessionStore();
    const ctrl = criarControlador(fake.engine, store);

    store.dispatch({
      tipo: 'ACEITAR',
      proximoNumero: 1,
      autorizaImagem: null,
    });
    store.dispatch({ tipo: 'INICIAR' });
    await ctrl.aguardarFila();

    fake.faixasPendentes.shift()!.resolver('fim');
    await Promise.resolve();

    store.dispatch({ tipo: 'RESPONDER_P1', resposta: 'Sim' });
    await ctrl.aguardarFila();

    fake.faixasPendentes.shift()!.resolver('fim');
    await Promise.resolve();

    // Responde P2 no Par 1 -> agenda transição de TRANSICAO_PAR_MS (800 ms)
    store.dispatch({
      tipo: 'RESPONDER_P2',
      resposta: 'Sim',
      agora: '2026-11-19 01:20:00',
    });
    await ctrl.aguardarFila();

    const stTrans1 = store.getEstado();
    expect(stTrans1.fase === 'ciclo' && stTrans1.etapa.tipo).toBe('transicao');

    // Avança 799 ms -> ainda em transição
    vi.advanceTimersByTime(TRANSICAO_PAR_MS - 1);
    const stTrans2 = store.getEstado();
    expect(stTrans2.fase === 'ciclo' && stTrans2.etapa.tipo).toBe('transicao');

    // Avança +1 ms (total 800 ms) -> TRANSICAO_FIM disparado, avança para Par 2 (editado_tocando)
    vi.advanceTimersByTime(1);
    await ctrl.aguardarFila();
    const stPar2 = store.getEstado();
    expect(stPar2.fase === 'ciclo' && stPar2.par).toBe(2);
    expect(stPar2.fase === 'ciclo' && stPar2.etapa.tipo).toBe(
      'editado_tocando'
    );

    // Verifica que pararTudo (CANCELAR) durante uma transição cancela o timer
    fake.faixasPendentes.shift()!.resolver('fim');
    await Promise.resolve();
    store.dispatch({ tipo: 'RESPONDER_P1', resposta: 'Não' });
    await ctrl.aguardarFila();
    fake.faixasPendentes.shift()!.resolver('fim');
    await Promise.resolve();
    store.dispatch({
      tipo: 'RESPONDER_P2',
      resposta: 'Sim',
      agora: '2026-11-19 01:20:05',
    });
    await ctrl.aguardarFila();

    // Cancela antes do timer disparar
    store.dispatch({ tipo: 'CANCELAR' });
    vi.advanceTimersByTime(TRANSICAO_PAR_MS * 2);
    await ctrl.aguardarFila();
    expect(store.getEstado().fase).toBe('cancelada');
  });

  it('f) Sessão completa simulada (store + controlador + engine falso): ordem exata das chamadas em cada par, 6 pares, encerramento, validarSessao OK e 1 aviso de persistirSessao', async () => {
    const fake = criarEngineFalsoControlavel();
    const store = criarSessionStore();
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const ctrl = criarControlador(fake.engine, store);

    const respostas: Array<{ p1: Resposta; p2: Resposta }> = [
      { p1: 'Sim', p2: 'Sim' },
      { p1: 'Não', p2: 'Sim' },
      { p1: 'Sim', p2: 'Não' },
      { p1: 'Não', p2: 'Não' },
      { p1: 'Sim', p2: 'Sim' },
      { p1: 'Não', p2: 'Sim' },
    ];

    store.dispatch({
      tipo: 'ACEITAR',
      proximoNumero: 4,
      autorizaImagem: 'autoriza',
    });
    store.dispatch({ tipo: 'INICIAR' });
    await ctrl.aguardarFila();

    for (let par = 1; par <= TOTAL_PARES; par++) {
      // Termina editada
      expect(fake.faixasPendentes).toHaveLength(1);
      expect(fake.faixasPendentes[0].src).toBe(TRACKS[par - 1].srcEditado);
      fake.faixasPendentes.shift()!.resolver('fim');
      await Promise.resolve();

      // Responde P1 -> toca original (sem fadeOut adicional pois batimentos já estavam fora)
      store.dispatch({
        tipo: 'RESPONDER_P1',
        resposta: respostas[par - 1].p1,
      });
      await ctrl.aguardarFila();

      expect(fake.faixasPendentes).toHaveLength(1);
      expect(fake.faixasPendentes[0].src).toBe(TRACKS[par - 1].srcOriginal);
      fake.faixasPendentes.shift()!.resolver('fim');
      await Promise.resolve();
      await ctrl.aguardarFila();

      // Responde P2
      store.dispatch({
        tipo: 'RESPONDER_P2',
        resposta: respostas[par - 1].p2,
        agora: '2026-11-19 01:22:00',
      });
      await ctrl.aguardarFila();

      if (par < TOTAL_PARES) {
        vi.advanceTimersByTime(TRANSICAO_PAR_MS);
        await ctrl.aguardarFila();
      }
    }

    const stFinal = store.getEstado();
    expect(stFinal.fase).toBe('encerramento');
    if (stFinal.fase !== 'encerramento') return;

    expect(validarSessao(stFinal.concluida).ok).toBe(true);
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(String(warnSpy.mock.calls[0][0])).toContain('persistirSessao');

    // Verifica padrão exato de chamadas ao engine: 1 iniciarBatimentos + 6 pares de (fadeOut -> editado -> original -> fadeIn)
    const chamadasEsperadas: string[] = ['iniciarBatimentos:1000'];
    for (let par = 1; par <= TOTAL_PARES; par++) {
      chamadasEsperadas.push(
        'fadeOutBatimentos:inicio',
        'fadeOutBatimentos:fim',
        `tocarFaixa:${TRACKS[par - 1].srcEditado}`,
        `tocarFaixa:${TRACKS[par - 1].srcOriginal}`,
        'fadeInBatimentos'
      );
    }
    expect(fake.chamadas).toEqual(chamadasEsperadas);

    warnSpy.mockRestore();
  });

  it('g & h) Ouvir novamente (editada e original) e entrega tardia de "fim" de época anterior: não destrava o par e repetições batem', async () => {
    const fake = criarEngineFalsoControlavel();
    const store = criarSessionStore();
    const ctrl = criarControlador(fake.engine, store);

    store.dispatch({
      tipo: 'ACEITAR',
      proximoNumero: 1,
      autorizaImagem: null,
    });
    store.dispatch({ tipo: 'INICIAR' });
    await ctrl.aguardarFila();

    // 1ª execução da editada termina
    const editada1 = fake.faixasPendentes.shift()!;
    editada1.resolver('fim');
    await Promise.resolve();

    // Pede Ouvir novamente na editada
    store.dispatch({ tipo: 'OUVIR_NOVAMENTE' });
    await ctrl.aguardarFila();
    expect(fake.faixasPendentes).toHaveLength(1);
    expect(fake.faixasPendentes[0].src).toBe(TRACKS[0].srcEditado);

    // Simula um evento AUDIO_EDITADO_FIM atrasado da época 1 enquanto a época 2 está tocando
    const stEditandoEpoca2 = store.getEstado();
    store.dispatch({ tipo: 'AUDIO_EDITADO_FIM', epoca: 1 });
    expect(store.getEstado()).toBe(stEditandoEpoca2);

    // Agora a época 2 termina de verdade
    fake.faixasPendentes.shift()!.resolver('fim');
    await Promise.resolve();

    // Responde P1 -> toca original (época 3)
    store.dispatch({ tipo: 'RESPONDER_P1', resposta: 'Sim' });
    await ctrl.aguardarFila();
    fake.faixasPendentes.shift()!.resolver('fim');
    await Promise.resolve();
    await ctrl.aguardarFila();

    // Em p2_liberada, os batimentos voltaram; ao pedir Ouvir novamente no original, faz fadeOut e toca original (época 4)
    store.dispatch({ tipo: 'OUVIR_NOVAMENTE' });
    await ctrl.aguardarFila();
    expect(fake.faixasPendentes).toHaveLength(1);
    expect(fake.faixasPendentes[0].src).toBe(TRACKS[0].srcOriginal);

    // Termina o replay do original e responde P2
    fake.faixasPendentes.shift()!.resolver('fim');
    await Promise.resolve();
    await ctrl.aguardarFila();

    store.dispatch({
      tipo: 'RESPONDER_P2',
      resposta: 'Sim',
      agora: '2026-11-19 01:25:00',
    });

    const st = store.getEstado();
    expect(st.fase).toBe('ciclo');
    if (st.fase !== 'ciclo') return;
    expect(st.sessao.linhas[0].repeticoes_editado).toBe(1);
    expect(st.sessao.linhas[0].repeticoes_original).toBe(1);
  });

  it('i) Interrupção via controlador: "interrompida" -> etapa com interrompido; retomarAudioNoGesto + RETOMAR -> novo tocarFaixa sem somar repetição', async () => {
    const fake = criarEngineFalsoControlavel();
    const store = criarSessionStore();
    const ctrl = criarControlador(fake.engine, store);

    store.dispatch({
      tipo: 'ACEITAR',
      proximoNumero: 1,
      autorizaImagem: null,
    });
    store.dispatch({ tipo: 'INICIAR' });
    await ctrl.aguardarFila();

    // Faixa editada sofre interrupção
    fake.faixasPendentes.shift()!.resolver('interrompida');
    await Promise.resolve();

    const stInt = store.getEstado();
    expect(visaoCiclo(stInt)?.overlayInterrompido).toBe(true);

    // Simula clique no botão Retomar: chama retomarAudioNoGesto() e despacha RETOMAR
    await retomarAudioNoGesto(fake.engine);
    store.dispatch({ tipo: 'RETOMAR' });
    await ctrl.aguardarFila();

    expect(fake.chamadasTentarRetomar).toBe(1);
    expect(fake.faixasPendentes).toHaveLength(1);
    expect(fake.faixasPendentes[0].src).toBe(TRACKS[0].srcEditado);

    // Conclui faixa retomada -> repeticoesEditado permanece 0
    fake.faixasPendentes.shift()!.resolver('fim');
    await Promise.resolve();
    const stP1 = store.getEstado();
    expect(
      stP1.fase === 'ciclo' &&
        stP1.etapa.tipo === 'p1_liberada' &&
        stP1.etapa.repeticoesEditado
    ).toBe(0);
  });

  it('j) visaoCiclo para cada fase/etapa, incluindo as duas variantes da Pergunta 2 e título/artista nos 6 pares', () => {
    // Fora do ciclo -> null
    expect(visaoCiclo({ fase: 'tcle' })).toBeNull();

    const baseSessao = {
      idParticipante: 'Participante_01',
      autorizaImagem: null,
      linhas: [],
      epoca: 1,
      batimentosAudiveis: false,
    };

    // 1. editado_tocando (normal)
    const vEditado = visaoCiclo({
      fase: 'ciclo',
      sessao: baseSessao,
      par: 2,
      etapa: {
        tipo: 'editado_tocando',
        interrompido: false,
        repeticoesEditado: 0,
        repeticoesOriginal: 0,
      },
    });
    expect(vEditado).toEqual({
      progresso: '2 / 6',
      visual: 'ativo',
      mostrarMusica: false,
      botoesResposta: false,
      botaoOuvirNovamente: false,
      overlayInterrompido: false,
      bloqueioEntrada: true,
    });

    // 2. editado_tocando (interrompido)
    const vEditadoInt = visaoCiclo({
      fase: 'ciclo',
      sessao: baseSessao,
      par: 2,
      etapa: {
        tipo: 'editado_tocando',
        interrompido: true,
        repeticoesEditado: 0,
        repeticoesOriginal: 0,
      },
    });
    expect(vEditadoInt?.visual).toBe('calmo');
    expect(vEditadoInt?.overlayInterrompido).toBe(true);
    expect(vEditadoInt?.botoesResposta).toBe(false);

    // 3. p1_liberada
    const vP1 = visaoCiclo({
      fase: 'ciclo',
      sessao: baseSessao,
      par: 2,
      etapa: {
        tipo: 'p1_liberada',
        repeticoesEditado: 0,
        repeticoesOriginal: 0,
      },
    });
    expect(vP1).toEqual({
      progresso: '2 / 6',
      visual: 'calmo',
      mostrarMusica: false,
      pergunta: { texto: STRINGS.pergunta1, qual: 1 },
      botoesResposta: true,
      botaoOuvirNovamente: true,
      overlayInterrompido: false,
      bloqueioEntrada: false,
    });

    // 4. original_tocando e p2_liberada para todos os 6 pares (testando reconhecido = Sim e Não)
    for (let par = 1; par <= TOTAL_PARES; par++) {
      const track = TRACKS[par - 1];

      const vOrig = visaoCiclo({
        fase: 'ciclo',
        sessao: baseSessao,
        par,
        etapa: {
          tipo: 'original_tocando',
          reconheceu: 'Sim',
          interrompido: false,
          repeticoesEditado: 0,
          repeticoesOriginal: 0,
        },
      });
      expect(vOrig?.visual).toBe('ativo');
      expect(vOrig?.mostrarMusica).toBe(true);
      expect(vOrig?.titulo).toBe(track.titulo);
      expect(vOrig?.artista).toBe(track.artista);
      expect(vOrig?.pergunta).toBeUndefined();

      const vP2Sim = visaoCiclo({
        fase: 'ciclo',
        sessao: baseSessao,
        par,
        etapa: {
          tipo: 'p2_liberada',
          reconheceu: 'Sim',
          repeticoesEditado: 0,
          repeticoesOriginal: 0,
        },
      });
      expect(vP2Sim?.visual).toBe('calmo');
      expect(vP2Sim?.mostrarMusica).toBe(true);
      expect(vP2Sim?.titulo).toBe(track.titulo);
      expect(vP2Sim?.artista).toBe(track.artista);
      expect(vP2Sim?.pergunta).toEqual({
        texto: STRINGS.pergunta2Sim,
        qual: 2,
      });
      expect(vP2Sim?.botoesResposta).toBe(true);
      expect(vP2Sim?.botaoOuvirNovamente).toBe(true);

      const vP2Nao = visaoCiclo({
        fase: 'ciclo',
        sessao: baseSessao,
        par,
        etapa: {
          tipo: 'p2_liberada',
          reconheceu: 'Não',
          repeticoesEditado: 0,
          repeticoesOriginal: 0,
        },
      });
      expect(vP2Nao?.pergunta).toEqual({
        texto: STRINGS.pergunta2Nao,
        qual: 2,
      });
    }

    // 5. transicao
    const vTrans: Estado = {
      fase: 'ciclo',
      sessao: baseSessao,
      par: 1,
      etapa: { tipo: 'transicao' },
    };
    expect(visaoCiclo(vTrans)).toEqual({
      progresso: '1 / 6',
      visual: 'apagado',
      mostrarMusica: false,
      botoesResposta: false,
      botaoOuvirNovamente: false,
      overlayInterrompido: false,
      bloqueioEntrada: true,
    });
  });

  it('k) Recuperação de batimentos: "pagina-visivel" em p1_liberada chama tentarRetomar; em editado_tocando NÃO chama', async () => {
    const fake = criarEngineFalsoControlavel();
    const store = criarSessionStore();
    const ctrl = criarControlador(fake.engine, store);

    store.dispatch({
      tipo: 'ACEITAR',
      proximoNumero: 1,
      autorizaImagem: null,
    });
    store.dispatch({ tipo: 'INICIAR' });
    await ctrl.aguardarFila();

    // Em editado_tocando: pagina-visivel NÃO chama tentarRetomar sozinho
    const stEdit = store.getEstado();
    expect(stEdit.fase === 'ciclo' && stEdit.etapa.tipo).toBe(
      'editado_tocando'
    );
    fake.emitirEventoEstado('pagina-visivel');
    expect(fake.chamadasTentarRetomar).toBe(0);

    // Termina o áudio -> p1_liberada: pagina-visivel CHAMA tentarRetomar
    fake.faixasPendentes.shift()!.resolver('fim');
    await Promise.resolve();
    const stP1 = store.getEstado();
    expect(stP1.fase === 'ciclo' && stP1.etapa.tipo).toBe('p1_liberada');

    fake.emitirEventoEstado('pagina-visivel');
    expect(fake.chamadasTentarRetomar).toBe(1);
  });
});
