import {
  DescritorTomUi,
  FADE_BATIMENTOS_MS,
  LIMIAR_SILENCIO_DB,
  LOOP_BATIMENTOS_APARADO,
  NIVEL_BATIMENTOS,
  NIVEL_MUSICA,
  VOLUME_MESTRE,
} from './config';
import { BATIMENTOS_SRC } from '../content/tracks';

export type ResultadoFaixa = 'fim' | 'cancelada' | 'interrompida';

export type EventoEstadoAudio =
  | 'running'
  | 'suspended'
  | 'interrupted'
  | 'closed'
  | 'pagina-oculta'
  | 'pagina-visivel';

export interface FalhaPreload {
  src: string;
  mensagem: string;
}

export interface RelatorioPreload {
  ok: string[];
  falhas: FalhaPreload[];
  msPorArquivo: Record<string, number>;
  tempoTotalMs: number;
}

export interface InfoBuffer {
  duracaoS: number;
  canais: number;
  taxa: number;
  silencioInicialMs: number;
  silencioFinalMs: number;
}

export interface EstadoDepuracaoAudio {
  fontesMusicaAtivas: number;
  batimentosTocando: boolean;
  geracao: number;
}

export type AudioContextFactory = () => AudioContext;

export type VersaoFaixaAudio = 'editado' | 'original';

export interface OpcoesTocarFaixa {
  versao?: VersaoFaixaAudio;
}

export interface NiveisVersaoFaixa {
  editado: number;
  original: number;
}

interface FaixaAtiva {
  src: string;
  geracao: number;
  source: AudioBufferSourceNode;
  resolver: (resultado: ResultadoFaixa) => void;
}

const FADE_ANTI_CLICK_S = 0.015; // 15 ms de micro-fade para evitar estalos (clicks)
const RAMPA_NIVEL_VERSAO_S = 0.03; // 30 ms de rampa linear ao alterar nível de versão durante reprodução
const GANHO_VERSAO_MIN = 0.01;
const GANHO_VERSAO_MAX = 1.0;

function limitarGanhoVersao(g: number): number {
  if (!Number.isFinite(g)) return GANHO_VERSAO_MAX;
  return Math.max(GANHO_VERSAO_MIN, Math.min(GANHO_VERSAO_MAX, g));
}

function agoraMs(): number {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}

/**
 * Engine de áudio isolada baseada exclusivamente em Web Audio API.
 * Grafo:
 *   fonteBatimentos -> gainBatimentos -> gainMestre -> destination
 *   fonteMusica     -> gainMusica     -> gainMestre -> destination
 */
export class AudioEngine {
  private readonly criarContexto: AudioContextFactory;
  private readonly fetchFn: typeof fetch;

  private ctx: AudioContext | null = null;
  private gainMestre: GainNode | null = null;
  private gainBatimentos: GainNode | null = null;
  private gainMusica: GainNode | null = null;
  private gainVersaoEditado: GainNode | null = null;
  private gainVersaoOriginal: GainNode | null = null;

  private ganhoVersaoEditado = 1.0;
  private ganhoVersaoOriginal = 1.0;

  private readonly buffers = new Map<string, AudioBuffer>();
  private readonly cacheInfo = new Map<string, InfoBuffer>();

  private fonteBatimentos: AudioBufferSourceNode | null = null;
  private batimentosTocando = false;
  private valorGainBatimentosAtual = 0;
  private timerFadeBatimentos: ReturnType<typeof setTimeout> | null = null;
  private resolverFadeBatimentos: (() => void) | null = null;

  private faixaAtiva: FaixaAtiva | null = null;
  private fontesMusicaAtivas = 0;
  private geracao = 0;

  // Parâmetros ajustáveis em runtime (usados apenas no laboratório #audio-lab)
  private volumeMestre = VOLUME_MESTRE;
  private nivelBatimentos = NIVEL_BATIMENTOS;
  private nivelMusica = NIVEL_MUSICA;
  private loopBatimentosAparado = LOOP_BATIMENTOS_APARADO;

  private readonly ouvintesEstado = new Set<(ev: EventoEstadoAudio) => void>();
  private listenerVisibilidadeRegistrado = false;

  constructor(
    criarContexto: AudioContextFactory = () =>
      new AudioContext({ latencyHint: 'playback' }),
    fetchFn: typeof fetch = (...args) => fetch(...args)
  ) {
    this.criarContexto = criarContexto;
    this.fetchFn = fetchFn;
    this.registrarListenerVisibilidade();
  }

  private registrarListenerVisibilidade(): void {
    if (
      this.listenerVisibilidadeRegistrado ||
      typeof document === 'undefined' ||
      typeof document.addEventListener !== 'function'
    ) {
      return;
    }
    this.listenerVisibilidadeRegistrado = true;
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        this.interromperFaixaPorEventoExterno();
        this.notificarEstado('pagina-oculta');
      } else if (document.visibilityState === 'visible') {
        this.notificarEstado('pagina-visivel');
      }
    });
  }

  private garantirGrafo(): AudioContext {
    if (!this.ctx) {
      const ctx = this.criarContexto();
      const gainMestre = ctx.createGain();
      const gainBatimentos = ctx.createGain();
      const gainMusica = ctx.createGain();

      gainMestre.gain.setValueAtTime(this.volumeMestre, ctx.currentTime);
      gainBatimentos.gain.setValueAtTime(0, ctx.currentTime);
      gainMusica.gain.setValueAtTime(this.nivelMusica, ctx.currentTime);

      gainBatimentos.connect(gainMestre);
      gainMusica.connect(gainMestre);
      gainMestre.connect(ctx.destination);

      const tratarMudancaEstado = () => {
        const st = ctx.state as EventoEstadoAudio;
        if (st !== 'running') {
          this.interromperFaixaPorEventoExterno();
        }
        this.notificarEstado(st);
      };

      if (typeof ctx.addEventListener === 'function') {
        ctx.addEventListener('statechange', tratarMudancaEstado);
      } else {
        ctx.onstatechange = tratarMudancaEstado;
      }

      this.ctx = ctx;
      this.gainMestre = gainMestre;
      this.gainBatimentos = gainBatimentos;
      this.gainMusica = gainMusica;
    }
    return this.ctx;
  }

  private notificarEstado(evento: EventoEstadoAudio): void {
    for (const cb of this.ouvintesEstado) {
      try {
        cb(evento);
      } catch {
        // Isola falhas de callbacks externos
      }
    }
  }

  /**
   * Cria o AudioContext preguiçosamente (se necessário) e chama resume().
   * Deve ser invocado dentro de um gesto de toque/clique do usuário. Idempotente.
   */
  async unlock(): Promise<boolean> {
    const ctx = this.garantirGrafo();
    if (ctx.state !== 'running') {
      try {
        await ctx.resume();
      } catch {
        return false;
      }
    }
    return ctx.state === 'running';
  }

  /**
   * Retorna o estado atual do AudioContext ou "nao-criado" antes do unlock().
   */
  estadoContexto(): 'nao-criado' | AudioContextState {
    if (!this.ctx) return 'nao-criado';
    return this.ctx.state;
  }

  /**
   * Pré-carrega e decodifica uma lista de arquivos de áudio em memória.
   * Não decodifica duas vezes o mesmo src; falha individual não interrompe os demais.
   */
  async preload(
    srcs: readonly string[],
    onProgresso?: (feitos: number, total: number, src: string) => void
  ): Promise<RelatorioPreload> {
    const ctx = this.garantirGrafo();
    const ok: string[] = [];
    const falhas: FalhaPreload[] = [];
    const msPorArquivo: Record<string, number> = {};
    const inicioTotal = agoraMs();
    const total = srcs.length;
    let feitos = 0;

    for (const src of srcs) {
      if (this.buffers.has(src)) {
        ok.push(src);
        msPorArquivo[src] = 0;
        feitos++;
        onProgresso?.(feitos, total, src);
        continue;
      }

      const t0 = agoraMs();
      try {
        const res = await this.fetchFn(src);
        const contentType = res.headers?.get?.('content-type') || '';
        if (!res.ok || contentType.includes('text/html')) {
          throw new Error(`HTTP ${res.status || 'inválido'} ao buscar ${src}`);
        }
        const arrayBuffer = await res.arrayBuffer();
        const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
        this.buffers.set(src, audioBuffer);
        msPorArquivo[src] = Math.round(agoraMs() - t0);
        ok.push(src);
      } catch (err) {
        msPorArquivo[src] = Math.round(agoraMs() - t0);
        const mensagem =
          err instanceof Error ? err.message : 'Erro desconhecido na decodificação';
        falhas.push({ src, mensagem });
      }

      feitos++;
      onProgresso?.(feitos, total, src);
    }

    return {
      ok,
      falhas,
      msPorArquivo,
      tempoTotalMs: Math.round(agoraMs() - inicioTotal),
    };
  }

  /**
   * Analisa (e faz cache) de duração, canais, taxa de amostragem e silêncio inicial/final abaixo de LIMIAR_SILENCIO_DB.
   */
  infoBuffer(src: string): InfoBuffer {
    const emCache = this.cacheInfo.get(src);
    if (emCache) return emCache;

    const buffer = this.buffers.get(src);
    if (!buffer) {
      throw new Error(`Buffer não pré-carregado para análise: ${src}`);
    }

    const limiarLinear = Math.pow(10, LIMIAR_SILENCIO_DB / 20); // -60 dB = 0.001
    const numCanais = buffer.numberOfChannels;
    const totalAmostras = buffer.length;
    const taxa = buffer.sampleRate;

    const canaisData: Float32Array[] = [];
    for (let c = 0; c < numCanais; c++) {
      canaisData.push(buffer.getChannelData(c));
    }

    let indiceInicio = 0;
    while (indiceInicio < totalAmostras) {
      let acima = false;
      for (let c = 0; c < numCanais; c++) {
        if (Math.abs(canaisData[c][indiceInicio]) > limiarLinear) {
          acima = true;
          break;
        }
      }
      if (acima) break;
      indiceInicio++;
    }

    let indiceFim = totalAmostras - 1;
    while (indiceFim > indiceInicio) {
      let acima = false;
      for (let c = 0; c < numCanais; c++) {
        if (Math.abs(canaisData[c][indiceFim]) > limiarLinear) {
          acima = true;
          break;
        }
      }
      if (acima) break;
      indiceFim--;
    }

    const silencioInicialMs = Math.round((indiceInicio / taxa) * 1000);
    const amostrasSilencioFinal = Math.max(0, totalAmostras - 1 - indiceFim);
    const silencioFinalMs = Math.round((amostrasSilencioFinal / taxa) * 1000);

    const info: InfoBuffer = {
      duracaoS: Number(buffer.duration.toFixed(3)),
      canais: numCanais,
      taxa,
      silencioInicialMs,
      silencioFinalMs,
    };

    this.cacheInfo.set(src, info);
    return info;
  }

  private aplicarLoopBatimentos(
    source: AudioBufferSourceNode,
    buffer: AudioBuffer
  ): void {
    source.loop = true;
    if (this.loopBatimentosAparado) {
      const info = this.infoBuffer(BATIMENTOS_SRC);
      const startS = info.silencioInicialMs / 1000;
      const endS = Math.max(startS + 0.05, buffer.duration - info.silencioFinalMs / 1000);
      source.loopStart = startS;
      source.loopEnd = endS;
    } else {
      source.loopStart = 0;
      source.loopEnd = buffer.duration;
    }
  }

  private cancelarTimerFadeBatimentos(): void {
    if (this.timerFadeBatimentos !== null) {
      clearTimeout(this.timerFadeBatimentos);
      this.timerFadeBatimentos = null;
    }
    if (this.resolverFadeBatimentos) {
      const resolver = this.resolverFadeBatimentos;
      this.resolverFadeBatimentos = null;
      resolver();
    }
  }

  private executarRampaBatimentos(alvo: number, ms: number): Promise<void> {
    this.cancelarTimerFadeBatimentos();

    if (!this.ctx || !this.gainBatimentos) {
      this.valorGainBatimentosAtual = alvo;
      return Promise.resolve();
    }

    const duracaoMs = Math.max(0, ms);
    const agora = this.ctx.currentTime;
    const param = this.gainBatimentos.gain;
    const valorAtual =
      typeof param.value === 'number'
        ? param.value
        : this.valorGainBatimentosAtual;

    param.cancelScheduledValues(agora);
    param.setValueAtTime(valorAtual, agora);

    if (duracaoMs === 0) {
      param.setValueAtTime(alvo, agora);
      this.valorGainBatimentosAtual = alvo;
      return Promise.resolve();
    }

    param.linearRampToValueAtTime(alvo, agora + duracaoMs / 1000);
    this.valorGainBatimentosAtual = alvo;

    return new Promise<void>((resolve) => {
      this.resolverFadeBatimentos = resolve;
      this.timerFadeBatimentos = setTimeout(() => {
        this.timerFadeBatimentos = null;
        this.resolverFadeBatimentos = null;
        if (this.ctx && this.gainBatimentos) {
          this.gainBatimentos.gain.setValueAtTime(alvo, this.ctx.currentTime);
        }
        this.valorGainBatimentosAtual = alvo;
        resolve();
      }, duracaoMs);
    });
  }

  /**
   * Inicia o loop de batimentos cardíacos. Idempotente: se já estiver tocando, não cria segunda fonte.
   */
  iniciarBatimentos(opcoes?: { fadeInMs?: number }): void {
    if (this.batimentosTocando && this.fonteBatimentos) {
      return;
    }

    const ctx = this.garantirGrafo();
    const buffer = this.buffers.get(BATIMENTOS_SRC);
    if (!buffer || !this.gainBatimentos) {
      return;
    }

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    this.aplicarLoopBatimentos(source, buffer);
    source.connect(this.gainBatimentos);

    const fadeInMs = opcoes?.fadeInMs ?? 0;
    const agora = ctx.currentTime;
    const param = this.gainBatimentos.gain;
    param.cancelScheduledValues(agora);

    if (fadeInMs > 0) {
      param.setValueAtTime(0, agora);
      this.valorGainBatimentosAtual = 0;
      source.start(0);
      this.fonteBatimentos = source;
      this.batimentosTocando = true;
      void this.executarRampaBatimentos(this.nivelBatimentos, fadeInMs);
    } else {
      param.setValueAtTime(this.nivelBatimentos, agora);
      this.valorGainBatimentosAtual = this.nivelBatimentos;
      source.start(0);
      this.fonteBatimentos = source;
      this.batimentosTocando = true;
    }
  }

  /**
   * Faz rampa linear do ganho dos batimentos até 0 sem parar a fonte.
   */
  fadeOutBatimentos(ms: number = FADE_BATIMENTOS_MS): Promise<void> {
    return this.executarRampaBatimentos(0, ms);
  }

  /**
   * Faz rampa linear do ganho dos batimentos até NIVEL_BATIMENTOS.
   */
  fadeInBatimentos(ms: number = FADE_BATIMENTOS_MS): Promise<void> {
    return this.executarRampaBatimentos(this.nivelBatimentos, ms);
  }

  /**
   * Para imediatamente a fonte de batimentos e libera o nó.
   */
  pararBatimentos(): void {
    this.cancelarTimerFadeBatimentos();
    if (this.fonteBatimentos) {
      try {
        this.fonteBatimentos.onended = null;
        this.fonteBatimentos.stop();
        this.fonteBatimentos.disconnect();
      } catch {
        // Ignora estado intermediário
      }
      this.fonteBatimentos = null;
    }
    this.batimentosTocando = false;
    this.valorGainBatimentosAtual = 0;
    if (this.ctx && this.gainBatimentos) {
      const agora = this.ctx.currentTime;
      this.gainBatimentos.gain.cancelScheduledValues(agora);
      this.gainBatimentos.gain.setValueAtTime(0, agora);
    }
  }

  private encerrarFaixaAtiva(motivo: 'cancelada' | 'interrompida'): void {
    const ativa = this.faixaAtiva;
    if (!ativa) return;

    this.faixaAtiva = null;
    this.fontesMusicaAtivas = 0;

    try {
      ativa.source.onended = null;
      if (this.ctx && this.gainMusica) {
        const agora = this.ctx.currentTime;
        const g = this.gainMusica.gain;
        g.cancelScheduledValues(agora);
        g.setValueAtTime(g.value ?? this.nivelMusica, agora);
        g.linearRampToValueAtTime(0, agora + FADE_ANTI_CLICK_S);
      }
      ativa.source.stop();
      ativa.source.disconnect();
    } catch {
      // No-op se já parada
    }

    ativa.resolver(motivo);
  }

  private interromperFaixaPorEventoExterno(): void {
    if (this.faixaAtiva) {
      this.encerrarFaixaAtiva('interrompida');
    }
  }

  private garantirGrafoVariantes(
    ctx: AudioContext,
    gainMusica: GainNode
  ): { editado: GainNode; original: GainNode } {
    if (!this.gainVersaoEditado || !this.gainVersaoOriginal) {
      const gEditado = ctx.createGain();
      const gOriginal = ctx.createGain();
      gEditado.gain.setValueAtTime(this.ganhoVersaoEditado, ctx.currentTime);
      gOriginal.gain.setValueAtTime(this.ganhoVersaoOriginal, ctx.currentTime);
      gEditado.connect(gainMusica);
      gOriginal.connect(gainMusica);
      this.gainVersaoEditado = gEditado;
      this.gainVersaoOriginal = gOriginal;
    }
    return {
      editado: this.gainVersaoEditado,
      original: this.gainVersaoOriginal,
    };
  }

  /**
   * Define os multiplicadores de ganho separados para as versões "editado" e "original"
   * (já convertidos por `nivelParaGanho`, limitados a [0.01, 1.0]).
   * Quando alterado durante a reprodução de uma faixa, aplica rampa linear de ~30 ms sem estalo.
   */
  definirNiveisVersao(niveis: NiveisVersaoFaixa): void {
    this.ganhoVersaoEditado = limitarGanhoVersao(niveis.editado);
    this.ganhoVersaoOriginal = limitarGanhoVersao(niveis.original);

    if (!this.ctx || !this.gainMusica) {
      return;
    }

    const { editado, original } = this.garantirGrafoVariantes(
      this.ctx,
      this.gainMusica
    );
    const agora = this.ctx.currentTime;

    const aplicarNoGain = (node: GainNode, alvo: number) => {
      const p = node.gain;
      const atual = typeof p.value === 'number' ? p.value : alvo;
      p.cancelScheduledValues(agora);
      if (this.fontesMusicaAtivas > 0) {
        p.setValueAtTime(atual, agora);
        p.linearRampToValueAtTime(alvo, agora + RAMPA_NIVEL_VERSAO_S);
      } else {
        p.setValueAtTime(alvo, agora);
      }
    };

    aplicarNoGain(editado, this.ganhoVersaoEditado);
    aplicarNoGain(original, this.ganhoVersaoOriginal);
  }

  /**
   * Retorna os multiplicadores de ganho atualmente configurados para cada versão.
   */
  obterNiveisVersao(): NiveisVersaoFaixa {
    return {
      editado: this.ganhoVersaoEditado,
      original: this.ganhoVersaoOriginal,
    };
  }

  /**
   * Toca uma faixa musical do início ao fim com garantia estrita de fonte única.
   * Sem `opcoes.versao`, conecta diretamente ao `gainMusica` (comportamento idêntico ao original).
   * Com `opcoes.versao` ("editado" | "original"), passa pelo `GainNode` da respectiva versão antes do `gainMusica`.
   * Resolve com "fim", "cancelada" ou "interrompida".
   */
  async tocarFaixa(
    src: string,
    opcoes?: OpcoesTocarFaixa
  ): Promise<ResultadoFaixa> {
    if (!this.ctx || this.ctx.state !== 'running') {
      throw new Error(
        `AudioContext não está em execução (estado atual: ${this.estadoContexto()}). Chame unlock() primeiro.`
      );
    }

    const buffer = this.buffers.get(src);
    if (!buffer) {
      throw new Error(`Faixa não foi pré-carregada: ${src}`);
    }

    // Se já houver faixa tocando, cancela a anterior antes de iniciar a nova
    if (this.faixaAtiva) {
      this.encerrarFaixaAtiva('cancelada');
    }

    const ctx = this.ctx;
    const gainMusica = this.gainMusica!;
    const minhaGeracao = ++this.geracao;

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = false;

    if (opcoes?.versao === 'editado' || opcoes?.versao === 'original') {
      const nosVersao = this.garantirGrafoVariantes(ctx, gainMusica);
      const destinoVersao =
        opcoes.versao === 'editado' ? nosVersao.editado : nosVersao.original;
      source.connect(destinoVersao);
    } else {
      source.connect(gainMusica);
    }

    // Micro-fade de 15 ms na entrada para evitar click
    const agora = ctx.currentTime;
    gainMusica.gain.cancelScheduledValues(agora);
    gainMusica.gain.setValueAtTime(0, agora);
    gainMusica.gain.linearRampToValueAtTime(
      this.nivelMusica,
      agora + FADE_ANTI_CLICK_S
    );

    return new Promise<ResultadoFaixa>((resolve) => {
      this.faixaAtiva = {
        src,
        geracao: minhaGeracao,
        source,
        resolver: resolve,
      };
      this.fontesMusicaAtivas = 1;

      source.onended = () => {
        // Ignora completamente se o evento vier de uma geração antiga
        if (!this.faixaAtiva || this.faixaAtiva.geracao !== minhaGeracao) {
          return;
        }
        const finalizada = this.faixaAtiva;
        this.faixaAtiva = null;
        this.fontesMusicaAtivas = 0;
        try {
          source.disconnect();
        } catch {
          // No-op
        }
        finalizada.resolver('fim');
      };

      source.start(0);
    });
  }

  /**
   * Cancela a faixa musical ativa (se houver). A promessa de tocarFaixa resolve com "cancelada".
   */
  pararFaixa(): void {
    if (!this.faixaAtiva) return;
    this.encerrarFaixaAtiva('cancelada');
  }

  /**
   * Para imediatamente qualquer faixa musical e os batimentos cardíacos.
   */
  pararTudo(): void {
    this.pararFaixa();
    this.pararBatimentos();
  }

  /**
   * Tenta retomar o AudioContext suspenso/interrompido (para uso futuro da camada de sessão).
   */
  async tentarRetomar(): Promise<boolean> {
    if (!this.ctx) return false;
    try {
      await this.ctx.resume();
    } catch {
      return false;
    }
    return this.ctx.state === 'running';
  }

  /**
   * Registra callback para mudanças de estado do contexto e visibilidade da página.
   * Retorna função para remover o registro.
   */
  aoMudarEstado(cb: (evento: EventoEstadoAudio) => void): () => void {
    this.ouvintesEstado.add(cb);
    return () => {
      this.ouvintesEstado.delete(cb);
    };
  }

  /**
   * Retorna instantâneo somente-leitura para o laboratório e testes automatizados.
   */
  depuracao(): EstadoDepuracaoAudio {
    return {
      fontesMusicaAtivas: this.fontesMusicaAtivas,
      batimentosTocando: this.batimentosTocando,
      geracao: this.geracao,
    };
  }

  /**
   * Sintetiza um tom curto de interface ("sine") através de um GainNode de efeitos próprio
   * conectado ao gainMestre.
   * Retorna false sem tocar nada se o contexto não estiver "running" ou se houver faixa musical soando.
   * Nunca altera fontesMusicaAtivas e nunca lança exceção.
   */
  tocarTom(desc: DescritorTomUi): boolean {
    try {
      if (
        !this.ctx ||
        this.ctx.state !== 'running' ||
        !this.gainMestre ||
        this.fontesMusicaAtivas > 0
      ) {
        return false;
      }

      if (
        !desc ||
        !Array.isArray(desc.frequenciasHz) ||
        desc.frequenciasHz.length === 0 ||
        typeof this.ctx.createOscillator !== 'function'
      ) {
        return false;
      }

      const ctx = this.ctx;
      const agora = ctx.currentTime;
      const duracaoS = Math.max(0.01, desc.duracaoMs / 1000);
      const ataqueS = Math.max(0.002, desc.ataqueMs / 1000);
      const decaimentoS = Math.max(0.005, desc.decaimentoMs / 1000);
      const fimS = agora + Math.max(duracaoS, ataqueS + decaimentoS);
      const nivelPorOsc =
        Math.max(0, Math.min(1, desc.nivel)) / desc.frequenciasHz.length;

      const gainEfeito = ctx.createGain();
      gainEfeito.gain.cancelScheduledValues(agora);
      gainEfeito.gain.setValueAtTime(0, agora);
      gainEfeito.gain.linearRampToValueAtTime(nivelPorOsc, agora + ataqueS);
      gainEfeito.gain.linearRampToValueAtTime(0, fimS);
      gainEfeito.connect(this.gainMestre);

      for (const freq of desc.frequenciasHz) {
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        if (osc.frequency && typeof osc.frequency.setValueAtTime === 'function') {
          osc.frequency.setValueAtTime(freq, agora);
        }
        osc.connect(gainEfeito);
        osc.start(agora);
        osc.stop(fimS);
      }

      return true;
    } catch {
      return false;
    }
  }

  // --- Métodos auxiliares para os controles de runtime do Laboratório (#audio-lab) ---

  obterParametrosRuntime(): {
    volumeMestre: number;
    nivelBatimentos: number;
    nivelMusica: number;
    loopBatimentosAparado: boolean;
    ganhoBatimentosAtual: number;
  } {
    return {
      volumeMestre: this.volumeMestre,
      nivelBatimentos: this.nivelBatimentos,
      nivelMusica: this.nivelMusica,
      loopBatimentosAparado: this.loopBatimentosAparado,
      ganhoBatimentosAtual: this.valorGainBatimentosAtual,
    };
  }

  definirVolumeMestreRuntime(valor: number): void {
    this.volumeMestre = Math.max(0, Math.min(1, valor));
    if (this.ctx && this.gainMestre) {
      const agora = this.ctx.currentTime;
      this.gainMestre.gain.cancelScheduledValues(agora);
      this.gainMestre.gain.setValueAtTime(this.volumeMestre, agora);
    }
  }

  definirNivelBatimentosRuntime(valor: number): void {
    this.nivelBatimentos = Math.max(0, Math.min(1, valor));
    if (this.batimentosTocando && this.ctx && this.gainBatimentos) {
      const agora = this.ctx.currentTime;
      this.gainBatimentos.gain.cancelScheduledValues(agora);
      this.gainBatimentos.gain.setValueAtTime(this.nivelBatimentos, agora);
      this.valorGainBatimentosAtual = this.nivelBatimentos;
    }
  }

  definirNivelMusicaRuntime(valor: number): void {
    this.nivelMusica = Math.max(0, Math.min(1, valor));
    if (this.ctx && this.gainMusica) {
      const agora = this.ctx.currentTime;
      this.gainMusica.gain.cancelScheduledValues(agora);
      this.gainMusica.gain.setValueAtTime(this.nivelMusica, agora);
    }
  }

  definirLoopBatimentosAparadoRuntime(aparado: boolean): void {
    this.loopBatimentosAparado = aparado;
    if (this.fonteBatimentos) {
      const buffer = this.buffers.get(BATIMENTOS_SRC);
      if (buffer) {
        this.aplicarLoopBatimentos(this.fonteBatimentos, buffer);
      }
    }
  }
}

// Instância singleton padrão para consumo pela aplicação
export const audioEngine = new AudioEngine();
