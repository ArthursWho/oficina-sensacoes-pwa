import { describe, expect, it } from 'vitest';
import { AudioEngine } from './AudioEngine';
import { BATIMENTOS_SRC } from '../content/tracks';

// --- Implementação de AudioContext Falso (Fake) para testes determinísticos em Node ---

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
  connect() {
    return this;
  }
  disconnect() {}
}

class FakeAudioBufferSourceNode {
  buffer: AudioBuffer | null = null;
  loop = false;
  loopStart = 0;
  loopEnd = 0;
  onended: (() => void) | null = null;
  iniciado = false;
  parado = false;

  connect() {
    return this;
  }

  disconnect() {}

  start() {
    this.iniciado = true;
  }

  stop() {
    this.parado = true;
    // Simula disparo de onended caso não tenha sido removido antes de stop()
    if (this.onended) {
      this.onended();
    }
  }

  simularFimNatural() {
    if (this.onended) {
      this.onended();
    }
  }
}

class FakeAudioBuffer {
  readonly duration: number;
  readonly length: number;
  readonly numberOfChannels = 1;
  readonly sampleRate = 1000;
  private readonly channelData: Float32Array;

  constructor(duracaoS = 2) {
    this.duration = duracaoS;
    this.length = Math.floor(duracaoS * this.sampleRate);
    this.channelData = new Float32Array(this.length);
    // Preenche o miolo com sinal acima do limiar (-60 dB = 0.001) e deixa 100ms de silêncio nas pontas
    for (let i = 100; i < this.length - 100; i++) {
      this.channelData[i] = 0.25;
    }
  }

  getChannelData(): Float32Array {
    return this.channelData;
  }
}

class FakeAudioContext {
  state: AudioContextState = 'suspended';
  currentTime = 0;
  readonly destination = {};
  readonly sourcesCriados: FakeAudioBufferSourceNode[] = [];
  readonly gainsCriados: FakeGainNode[] = [];
  private readonly listeners = new Set<() => void>();
  onstatechange: (() => void) | null = null;

  createGain(): GainNode {
    const g = new FakeGainNode();
    this.gainsCriados.push(g);
    return g as unknown as GainNode;
  }

  createBufferSource(): AudioBufferSourceNode {
    const s = new FakeAudioBufferSourceNode();
    this.sourcesCriados.push(s);
    return s as unknown as AudioBufferSourceNode;
  }

  async decodeAudioData(ab: ArrayBuffer): Promise<AudioBuffer> {
    if (ab.byteLength === 0) {
      throw new Error('Buffer de áudio vazio ou corrompido');
    }
    return new FakeAudioBuffer(2.5) as unknown as AudioBuffer;
  }

  async resume(): Promise<void> {
    this.mudarEstado('running');
  }

  addEventListener(tipo: string, cb: () => void) {
    if (tipo === 'statechange') {
      this.listeners.add(cb);
    }
  }

  mudarEstado(novoEstado: AudioContextState) {
    this.state = novoEstado;
    for (const cb of this.listeners) {
      cb();
    }
    this.onstatechange?.();
  }
}

function criarFetchFake(urlsFalhas: Set<string> = new Set()): typeof fetch {
  return (async (input: RequestInfo | URL) => {
    const url = String(input);
    if (urlsFalhas.has(url)) {
      return {
        ok: false,
        status: 404,
        headers: new Map([['content-type', 'text/plain']]),
        arrayBuffer: async () => new ArrayBuffer(0),
      } as unknown as Response;
    }
    return {
      ok: true,
      status: 200,
      headers: new Map([['content-type', 'audio/mpeg']]),
      arrayBuffer: async () => new ArrayBuffer(1024),
    } as unknown as Response;
  }) as typeof fetch;
}

describe('src/audio/AudioEngine.ts', () => {
  it('a) tocarFaixa chamada duas vezes seguidas: primeira resolve "cancelada", segunda resolve "fim"; fontesMusicaAtivas nunca passa de 1', async () => {
    const fakeCtx = new FakeAudioContext();
    const engine = new AudioEngine(
      () => fakeCtx as unknown as AudioContext,
      criarFetchFake()
    );

    const desbloqueado = await engine.unlock();
    expect(desbloqueado).toBe(true);
    expect(engine.estadoContexto()).toBe('running');

    await engine.preload(['./audio/faixa1.mp3', './audio/faixa2.mp3']);

    const p1 = engine.tocarFaixa('./audio/faixa1.mp3');
    expect(engine.depuracao().fontesMusicaAtivas).toBe(1);

    const p2 = engine.tocarFaixa('./audio/faixa2.mp3');
    expect(engine.depuracao().fontesMusicaAtivas).toBe(1);

    // A primeira promessa já deve ter resolvido como "cancelada"
    await expect(p1).resolves.toBe('cancelada');
    expect(engine.depuracao().fontesMusicaAtivas).toBe(1);

    // Simula o término natural da segunda fonte criada
    const segundaFonte = fakeCtx.sourcesCriados[1];
    segundaFonte.simularFimNatural();

    await expect(p2).resolves.toBe('fim');
    expect(engine.depuracao().fontesMusicaAtivas).toBe(0);
  });

  it('b) onended de uma fonte antiga (geração antiga) NÃO resolve a promessa da faixa nova', async () => {
    const fakeCtx = new FakeAudioContext();
    const engine = new AudioEngine(
      () => fakeCtx as unknown as AudioContext,
      criarFetchFake()
    );

    await engine.unlock();
    await engine.preload(['./audio/faixa1.mp3', './audio/faixa2.mp3']);

    // Captura uma referência ao callback onended da fonte 1 antes de ser limpo
    const p1 = engine.tocarFaixa('./audio/faixa1.mp3');
    const fonte1 = fakeCtx.sourcesCriados[0];
    const onEndedAntigoSalvo = fonte1.onended;

    let p2Resolveu = false;
    const p2 = engine.tocarFaixa('./audio/faixa2.mp3').then((res) => {
      p2Resolveu = true;
      return res;
    });

    await expect(p1).resolves.toBe('cancelada');

    // Mesmo se o navegador disparasse tardiamente o callback antigo salvo, a faixa 2 não deve ser afetada
    onEndedAntigoSalvo?.();
    await Promise.resolve();
    expect(p2Resolveu).toBe(false);
    expect(engine.depuracao().fontesMusicaAtivas).toBe(1);

    // Agora termina a fonte 2 normalmente
    const fonte2 = fakeCtx.sourcesCriados[1];
    fonte2.simularFimNatural();
    await expect(p2).resolves.toBe('fim');
    expect(engine.depuracao().fontesMusicaAtivas).toBe(0);
  });

  it('c) tocarFaixa de src não pré-carregado rejeita com erro claro', async () => {
    const fakeCtx = new FakeAudioContext();
    const engine = new AudioEngine(
      () => fakeCtx as unknown as AudioContext,
      criarFetchFake()
    );

    await engine.unlock();
    await expect(
      engine.tocarFaixa('./audio/nao_carregado.mp3')
    ).rejects.toThrow(/pré-carregada/i);
  });

  it('d) statechange para "suspended" durante a faixa resolve "interrompida" e limpa o estado', async () => {
    const fakeCtx = new FakeAudioContext();
    const engine = new AudioEngine(
      () => fakeCtx as unknown as AudioContext,
      criarFetchFake()
    );

    const eventosRecebidos: string[] = [];
    engine.aoMudarEstado((ev) => eventosRecebidos.push(ev));

    await engine.unlock();
    await engine.preload(['./audio/faixa1.mp3']);

    const promessa = engine.tocarFaixa('./audio/faixa1.mp3');
    expect(engine.depuracao().fontesMusicaAtivas).toBe(1);

    // Simula interrupção externa do sistema operacional (suspensão do contexto)
    fakeCtx.mudarEstado('suspended');

    await expect(promessa).resolves.toBe('interrompida');
    expect(engine.depuracao().fontesMusicaAtivas).toBe(0);
    expect(eventosRecebidos).toContain('suspended');
  });

  it('e) iniciarBatimentos duas vezes não cria duas fontes (idempotente)', async () => {
    const fakeCtx = new FakeAudioContext();
    const engine = new AudioEngine(
      () => fakeCtx as unknown as AudioContext,
      criarFetchFake()
    );

    await engine.unlock();
    await engine.preload([BATIMENTOS_SRC]);

    engine.iniciarBatimentos();
    expect(engine.depuracao().batimentosTocando).toBe(true);
    expect(fakeCtx.sourcesCriados).toHaveLength(1);

    // Segunda chamada enquanto já toca não deve criar novo AudioBufferSourceNode
    engine.iniciarBatimentos({ fadeInMs: 500 });
    expect(fakeCtx.sourcesCriados).toHaveLength(1);

    engine.pararBatimentos();
    expect(engine.depuracao().batimentosTocando).toBe(false);
  });

  it('f) pararFaixa sem faixa ativa não lança erro (no-op)', async () => {
    const fakeCtx = new FakeAudioContext();
    const engine = new AudioEngine(
      () => fakeCtx as unknown as AudioContext,
      criarFetchFake()
    );

    expect(() => engine.pararFaixa()).not.toThrow();
    await engine.unlock();
    expect(() => engine.pararFaixa()).not.toThrow();
    expect(() => engine.pararTudo()).not.toThrow();
  });

  it('g) preload com um arquivo falhando retorna os outros em ok[] e o falho em falhas[] sem decodificar duplicado', async () => {
    const fakeCtx = new FakeAudioContext();
    const falhos = new Set(['./audio/corrompido.mp3']);
    const engine = new AudioEngine(
      () => fakeCtx as unknown as AudioContext,
      criarFetchFake(falhos)
    );

    const progresso: Array<{ feitos: number; total: number; src: string }> = [];
    const relatorio = await engine.preload(
      ['./audio/ok1.mp3', './audio/corrompido.mp3', './audio/ok2.mp3'],
      (feitos, total, src) => progresso.push({ feitos, total, src })
    );

    expect(relatorio.ok).toEqual(['./audio/ok1.mp3', './audio/ok2.mp3']);
    expect(relatorio.falhas).toHaveLength(1);
    expect(relatorio.falhas[0].src).toBe('./audio/corrompido.mp3');
    expect(relatorio.falhas[0].mensagem).toContain('404');
    expect(progresso).toHaveLength(3);

    // Verifica análise de silêncio do buffer pré-carregado (100ms inicial e 100ms final no FakeAudioBuffer)
    const info = engine.infoBuffer('./audio/ok1.mp3');
    expect(info.duracaoS).toBe(2.5);
    expect(info.silencioInicialMs).toBe(100);
    expect(info.silencioFinalMs).toBe(100);
  });
});
