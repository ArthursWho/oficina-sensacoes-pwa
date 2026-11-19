import { useEffect, useRef, useState } from 'preact/hooks';
import {
  audioEngine,
  EventoEstadoAudio,
  InfoBuffer,
  RelatorioPreload,
  ResultadoFaixa,
} from './AudioEngine';
import {
  FADE_BATIMENTOS_MS,
  LOOP_BATIMENTOS_APARADO,
  NIVEL_BATIMENTOS,
  NIVEL_MUSICA,
  VOLUME_MESTRE,
} from './config';
import { ALL_AUDIO_SRCS, BATIMENTOS_SRC, TRACKS } from '../content/tracks';
import { Button } from '../ui/components/Button';
import { Checkbox } from '../ui/components/Checkbox';

interface MedicaoFaixa {
  src: string;
  resultado: ResultadoFaixa;
  duracaoMedidaS: number;
  duracaoBufferS: number;
}

interface ResultadoEstresseCliques {
  executando: boolean;
  maxFontesObservadas: number;
  passou: boolean | null;
  amostras: number;
}

interface ResultadoEstresseFades {
  executando: boolean;
  ganhoFinal: number | null;
  ganhoEsperado: number | null;
  passou: boolean | null;
}

function horarioLog(): string {
  const d = new Date();
  return d.toTimeString().slice(0, 8) + '.' + String(d.getMilliseconds()).padStart(3, '0');
}

// Página de laboratório da Engine de Áudio (#audio-lab)
export function AudioLab() {
  const [estadoCtx, setEstadoCtx] = useState<string>(() =>
    audioEngine.estadoContexto()
  );
  const [depuracao, setDepuracao] = useState(() => audioEngine.depuracao());
  const [ultimaResolucao, setUltimaResolucao] = useState<string>('—');

  // Pré-carga
  const [carregandoPreload, setCarregandoPreload] = useState(false);
  const [progressoPreload, setProgressoPreload] = useState({
    feitos: 0,
    total: ALL_AUDIO_SRCS.length,
    atual: '',
  });
  const [relatorioPreload, setRelatorioPreload] =
    useState<RelatorioPreload | null>(null);
  const [infosBuffer, setInfosBuffer] = useState<Record<string, InfoBuffer>>({});

  // Batimentos e níveis runtime
  const [loopAparado, setLoopAparado] = useState<boolean>(
    LOOP_BATIMENTOS_APARADO
  );
  const [volumeMestre, setVolumeMestre] = useState<number>(VOLUME_MESTRE);
  const [nivelBatimentos, setNivelBatimentos] =
    useState<number>(NIVEL_BATIMENTOS);
  const [nivelMusica, setNivelMusica] = useState<number>(NIVEL_MUSICA);

  // Faixas: cronômetro ao vivo e última medição
  const [faixaTocandoSrc, setFaixaTocandoSrc] = useState<string | null>(null);
  const [tempoDecorridoS, setTempoDecorridoS] = useState<number>(0);
  const [ultimaMedicao, setUltimaMedicao] = useState<MedicaoFaixa | null>(null);
  const inicioFaixaRef = useRef<number>(0);

  // Simulação de par
  const [parSimuladoIdx, setParSimuladoIdx] = useState<number>(0);
  const [simulandoPar, setSimulandoPar] = useState<boolean>(false);

  // Testes de estresse
  const [estresseCliques, setEstresseCliques] =
    useState<ResultadoEstresseCliques>({
      executando: false,
      maxFontesObservadas: 0,
      passou: null,
      amostras: 0,
    });
  const [estresseFades, setEstresseFades] = useState<ResultadoEstresseFades>({
    executando: false,
    ganhoFinal: null,
    ganhoEsperado: null,
    passou: null,
  });

  // Log de eventos
  const [logs, setLogs] = useState<string[]>([
    `[${horarioLog()}] Laboratório de áudio iniciado.`,
  ]);
  const logAreaRef = useRef<HTMLPreElement>(null);

  const adicionarLog = (msg: string) => {
    setLogs((prev) => [`[${horarioLog()}] ${msg}`, ...prev.slice(0, 199)]);
  };

  const sincronizarEstado = () => {
    setEstadoCtx(audioEngine.estadoContexto());
    setDepuracao(audioEngine.depuracao());
  };

  useEffect(() => {
    const desregistrar = audioEngine.aoMudarEstado((ev: EventoEstadoAudio) => {
      sincronizarEstado();
      adicionarLog(`Evento de estado/visibilidade: ${ev}`);
    });

    const timer = window.setInterval(() => {
      sincronizarEstado();
      if (audioEngine.depuracao().fontesMusicaAtivas > 0 && inicioFaixaRef.current > 0) {
        setTempoDecorridoS(
          Number(((performance.now() - inicioFaixaRef.current) / 1000).toFixed(2))
        );
      }
    }, 80);

    return () => {
      desregistrar();
      window.clearInterval(timer);
    };
  }, []);

  // 2. Desbloquear e pré-carregar
  const handleUnlock = async () => {
    const ok = await audioEngine.unlock();
    sincronizarEstado();
    adicionarLog(
      `unlock() -> ${ok ? 'OK (running)' : 'FALHOU'} (estado: ${audioEngine.estadoContexto()})`
    );
  };

  const handlePreload = async () => {
    setCarregandoPreload(true);
    adicionarLog(`Iniciando pré-carga de ${ALL_AUDIO_SRCS.length} arquivos...`);

    const rel = await audioEngine.preload(
      ALL_AUDIO_SRCS,
      (feitos, total, src) => {
        setProgressoPreload({ feitos, total, atual: src });
      }
    );

    const mapaInfos: Record<string, InfoBuffer> = {};
    for (const src of rel.ok) {
      try {
        mapaInfos[src] = audioEngine.infoBuffer(src);
      } catch {
        // Ignora caso não disponível
      }
    }

    setInfosBuffer(mapaInfos);
    setRelatorioPreload(rel);
    setCarregandoPreload(false);
    sincronizarEstado();
    adicionarLog(
      `Pré-carga concluída em ${rel.tempoTotalMs} ms: ${rel.ok.length} OK, ${rel.falhas.length} falha(s).`
    );
  };

  // 3. Controles de batimentos
  const handleIniciarBatimentos = async () => {
    await audioEngine.unlock();
    audioEngine.iniciarBatimentos({ fadeInMs: FADE_BATIMENTOS_MS });
    sincronizarEstado();
    adicionarLog(`iniciarBatimentos({ fadeInMs: ${FADE_BATIMENTOS_MS} })`);
  };

  const handleFadeOutBatimentos = async () => {
    adicionarLog(`fadeOutBatimentos(${FADE_BATIMENTOS_MS} ms) iniciado...`);
    await audioEngine.fadeOutBatimentos(FADE_BATIMENTOS_MS);
    sincronizarEstado();
    adicionarLog('fadeOutBatimentos concluído (volume = 0).');
  };

  const handleFadeInBatimentos = async () => {
    adicionarLog(`fadeInBatimentos(${FADE_BATIMENTOS_MS} ms) iniciado...`);
    await audioEngine.fadeInBatimentos(FADE_BATIMENTOS_MS);
    sincronizarEstado();
    adicionarLog(`fadeInBatimentos concluído (volume = ${nivelBatimentos}).`);
  };

  const handlePararBatimentos = () => {
    audioEngine.pararBatimentos();
    sincronizarEstado();
    adicionarLog('pararBatimentos() chamado.');
  };

  const handleToggleLoopAparado = (novoValor: boolean) => {
    setLoopAparado(novoValor);
    audioEngine.definirLoopBatimentosAparadoRuntime(novoValor);
    adicionarLog(`LOOP_BATIMENTOS_APARADO em runtime = ${novoValor}`);
  };

  // 4. Reprodução de faixa individual
  const handleTocarFaixa = async (src: string) => {
    await audioEngine.unlock();
    const t0 = performance.now();
    inicioFaixaRef.current = t0;
    setFaixaTocandoSrc(src);
    setTempoDecorridoS(0);
    sincronizarEstado();
    adicionarLog(`tocarFaixa("${src}") iniciada (geração ${audioEngine.depuracao().geracao + 1})`);

    try {
      const resultado = await audioEngine.tocarFaixa(src);
      const duracaoMedidaS = Number(((performance.now() - t0) / 1000).toFixed(2));
      const duracaoBufferS = infosBuffer[src]?.duracaoS ?? 0;

      setUltimaResolucao(`${resultado} (${src.replace('./audio/', '')})`);
      setUltimaMedicao({
        src,
        resultado,
        duracaoMedidaS,
        duracaoBufferS,
      });

      if (audioEngine.depuracao().fontesMusicaAtivas === 0) {
        setFaixaTocandoSrc(null);
      }
      sincronizarEstado();
      adicionarLog(
        `tocarFaixa("${src}") resolveu "${resultado}" em ${duracaoMedidaS}s (buffer: ${duracaoBufferS}s)`
      );
      return resultado;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setUltimaResolucao(`ERRO: ${msg}`);
      setFaixaTocandoSrc(null);
      sincronizarEstado();
      adicionarLog(`ERRO em tocarFaixa("${src}"): ${msg}`);
      return 'cancelada' as ResultadoFaixa;
    }
  };

  // 5. Sequência de teste do fluxo real ("Simular um par")
  const handleSimularPar = async () => {
    const track = TRACKS[parSimuladoIdx] ?? TRACKS[0];
    setSimulandoPar(true);
    adicionarLog(`=== Iniciando simulação do Par ${track.ordem}: ${track.rotulo} ===`);

    await audioEngine.unlock();
    if (!audioEngine.depuracao().batimentosTocando) {
      audioEngine.iniciarBatimentos({ fadeInMs: 0 });
      adicionarLog('Batimentos iniciados para a simulação.');
    }

    adicionarLog('Passo 1/4: fadeOutBatimentos...');
    await audioEngine.fadeOutBatimentos(FADE_BATIMENTOS_MS);

    adicionarLog(`Passo 2/4: tocando versão EDITADA (${track.srcEditado})...`);
    const resEditado = await handleTocarFaixa(track.srcEditado);
    if (resEditado !== 'fim') {
      adicionarLog(`Simulação abortada após editada (resultado: ${resEditado}).`);
      setSimulandoPar(false);
      return;
    }

    adicionarLog(`Passo 3/4: tocando versão ORIGINAL (${track.srcOriginal})...`);
    const resOriginal = await handleTocarFaixa(track.srcOriginal);
    if (resOriginal !== 'fim') {
      adicionarLog(`Simulação abortada após original (resultado: ${resOriginal}).`);
      setSimulandoPar(false);
      return;
    }

    adicionarLog('Passo 4/4: fadeInBatimentos...');
    await audioEngine.fadeInBatimentos(FADE_BATIMENTOS_MS);
    adicionarLog(`=== Simulação do Par ${track.ordem} concluída com sucesso! ===`);
    setSimulandoPar(false);
  };

  // 6.a) Estresse de cliques: 30 chamadas em ~2s, amostrando fontesMusicaAtivas a cada 20 ms
  const handleEstresseCliques = async () => {
    await audioEngine.unlock();
    const faixasDisponiveis = TRACKS.flatMap((t) => [t.srcEditado, t.srcOriginal]).filter(
      (src) => Boolean(infosBuffer[src])
    );

    if (faixasDisponiveis.length === 0) {
      adicionarLog('ERRO Estresse de cliques: faça a pré-carga dos 13 áudios primeiro.');
      return;
    }

    setEstresseCliques({
      executando: true,
      maxFontesObservadas: 0,
      passou: null,
      amostras: 0,
    });
    adicionarLog('Iniciando Estresse de cliques (30 chamadas em ~2s)...');

    let maxFontes = 0;
    let amostras = 0;

    const sampler = window.setInterval(() => {
      const f = audioEngine.depuracao().fontesMusicaAtivas;
      if (f > maxFontes) maxFontes = f;
      amostras++;
    }, 20);

    for (let i = 0; i < 30; i++) {
      const src = faixasDisponiveis[i % faixasDisponiveis.length];
      void audioEngine.tocarFaixa(src).catch(() => {});
      const f = audioEngine.depuracao().fontesMusicaAtivas;
      if (f > maxFontes) maxFontes = f;
      await new Promise((r) => setTimeout(r, 65));
    }

    window.clearInterval(sampler);
    audioEngine.pararFaixa();
    sincronizarEstado();

    const passou = maxFontes <= 1;
    setEstresseCliques({
      executando: false,
      maxFontesObservadas: maxFontes,
      passou,
      amostras,
    });
    adicionarLog(
      `Estresse de cliques finalizado: máx fontesMusicaAtivas = ${maxFontes} (${amostras} amostras) -> ${
        passou ? 'PASSOU' : 'FALHOU'
      }`
    );
  };

  // 6.b) Estresse de fades: alterna fadeOut/fadeIn 10 vezes rápido
  const handleEstresseFades = async () => {
    await audioEngine.unlock();
    if (!infosBuffer[BATIMENTOS_SRC]) {
      adicionarLog('ERRO Estresse de fades: faça a pré-carga dos áudios primeiro.');
      return;
    }

    audioEngine.iniciarBatimentos({ fadeInMs: 0 });
    setEstresseFades({
      executando: true,
      ganhoFinal: null,
      ganhoEsperado: null,
      passou: null,
    });
    adicionarLog('Iniciando Estresse de fades (10 alternâncias rápidas)...');

    for (let i = 0; i < 9; i++) {
      if (i % 2 === 0) {
        void audioEngine.fadeOutBatimentos(300);
      } else {
        void audioEngine.fadeInBatimentos(300);
      }
      await new Promise((r) => setTimeout(r, 60));
    }

    // 10ª operação (índice 9 = ímpar -> fadeIn completo até nivelBatimentos)
    await audioEngine.fadeInBatimentos(350);
    const params = audioEngine.obterParametrosRuntime();
    const ganhoFinal = Number(params.ganhoBatimentosAtual.toFixed(3));
    const ganhoEsperado = Number(params.nivelBatimentos.toFixed(3));
    const passou = Math.abs(ganhoFinal - ganhoEsperado) < 0.005;

    setEstresseFades({
      executando: false,
      ganhoFinal,
      ganhoEsperado,
      passou,
    });
    sincronizarEstado();
    adicionarLog(
      `Estresse de fades finalizado: ganho final = ${ganhoFinal} (esperado = ${ganhoEsperado}) -> ${
        passou ? 'PASSOU' : 'FALHOU'
      }`
    );
  };

  // 8. Copiar log
  const handleCopiarLog = async () => {
    const texto = logs.join('\n');
    try {
      await navigator.clipboard.writeText(texto);
      adicionarLog('Log copiado para a área de transferência.');
    } catch {
      if (logAreaRef.current) {
        const range = document.createRange();
        range.selectNodeContents(logAreaRef.current);
        const sel = window.getSelection();
        sel?.removeAllRanges();
        sel?.addRange(range);
        adicionarLog('Clipboard indisponível: texto do log selecionado na tela.');
      }
    }
  };

  return (
    <main class="demo-gallery">
      <header class="demo-header">
        <div>
          <h1 class="diag-title">Laboratório de Áudio — Etapa 3</h1>
          <p class="diag-subtitle">
            Engine Web Audio API isolada (#audio-lab)
          </p>
        </div>
        <div class="demo-row">
          <a href="#diagnostico" class="demo-back-link">
            ← Diagnóstico (#diagnostico)
          </a>
          <a href="#componentes" class="demo-back-link">
            Galeria (#componentes)
          </a>
        </div>
      </header>

      {/* 1. Estado em tempo real */}
      <section class="demo-section">
        <h2 class="demo-section__title">1. Estado em Tempo Real</h2>
        <div class="lab-status-grid">
          <div class="lab-stat-card">
            <span class="diag-detail">estadoContexto()</span>
            <strong
              class={`lab-stat-val ${
                estadoCtx === 'running' ? 'lab-text-ok' : 'lab-text-warn'
              }`}
            >
              {estadoCtx}
            </strong>
          </div>
          <div class="lab-stat-card">
            <span class="diag-detail">fontesMusicaAtivas (máx 1)</span>
            <strong
              class={`lab-stat-val ${
                depuracao.fontesMusicaAtivas <= 1 ? 'lab-text-ok' : 'lab-text-fail'
              }`}
            >
              {depuracao.fontesMusicaAtivas}
            </strong>
          </div>
          <div class="lab-stat-card">
            <span class="diag-detail">batimentosTocando</span>
            <strong class="lab-stat-val">
              {depuracao.batimentosTocando ? 'SIM (loop)' : 'NÃO'}
            </strong>
          </div>
          <div class="lab-stat-card">
            <span class="diag-detail">geracao</span>
            <strong class="lab-stat-val">{depuracao.geracao}</strong>
          </div>
          <div class="lab-stat-card lab-stat-card--wide">
            <span class="diag-detail">Última resolução de tocarFaixa</span>
            <strong class="lab-stat-val">{ultimaResolucao}</strong>
          </div>
        </div>
      </section>

      {/* 2. Desbloqueio e pré-carga */}
      <section class="demo-section">
        <h2 class="demo-section__title">2. Desbloqueio e Pré-carga (13 MP3s)</h2>
        <div class="demo-grid">
          <Button variant="primary" onClick={handleUnlock}>
            Desbloquear áudio (unlock)
          </Button>
          <Button
            variant="secondary"
            onClick={handlePreload}
            disabled={carregandoPreload}
          >
            {carregandoPreload
              ? `Carregando (${progressoPreload.feitos}/${progressoPreload.total})...`
              : 'Pré-carregar os 13 áudios'}
          </Button>
        </div>

        {(carregandoPreload || relatorioPreload) && (
          <div class="lab-progress-box">
            <div class="lab-progress-bar">
              <div
                class="lab-progress-fill"
                style={{
                  width: `${Math.round(
                    ((relatorioPreload
                      ? relatorioPreload.ok.length + relatorioPreload.falhas.length
                      : progressoPreload.feitos) /
                      ALL_AUDIO_SRCS.length) *
                      100
                  )}%`,
                }}
              />
            </div>
            {relatorioPreload && (
              <p class="diag-detail">
                Tempo total: <strong>{relatorioPreload.tempoTotalMs} ms</strong> | OK:{' '}
                <strong>{relatorioPreload.ok.length}</strong> | Falhas:{' '}
                <strong>{relatorioPreload.falhas.length}</strong>
              </p>
            )}
          </div>
        )}

        {relatorioPreload && (
          <ul class="lab-preload-list">
            {ALL_AUDIO_SRCS.map((src) => {
              const ok = relatorioPreload.ok.includes(src);
              const falha = relatorioPreload.falhas.find((f) => f.src === src);
              const info = infosBuffer[src];
              const msDecod = relatorioPreload.msPorArquivo[src] ?? 0;

              return (
                <li key={src} class="lab-preload-item">
                  <div>
                    <span class={ok ? 'lab-text-ok' : 'lab-text-fail'}>
                      {ok ? '✓' : '✗'}
                    </span>{' '}
                    <strong>{src.replace('./audio/', '')}</strong>
                  </div>
                  {ok && info ? (
                    <span class="diag-detail">
                      {info.duracaoS}s | silêncio ini: {info.silencioInicialMs} ms |
                      fim: {info.silencioFinalMs} ms | decod: {msDecod} ms
                    </span>
                  ) : (
                    <span class="lab-text-fail">
                      {falha?.mensagem ?? 'Falha ao carregar'}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* 3. Batimentos */}
      <section class="demo-section">
        <h2 class="demo-section__title">3. Controle dos Batimentos Cardíacos</h2>
        <div class="demo-grid">
          <Button variant="primary" onClick={handleIniciarBatimentos}>
            Iniciar
          </Button>
          <Button variant="secondary" onClick={handleFadeOutBatimentos}>
            Fade-out ({FADE_BATIMENTOS_MS} ms)
          </Button>
          <Button variant="secondary" onClick={handleFadeInBatimentos}>
            Fade-in ({FADE_BATIMENTOS_MS} ms)
          </Button>
          <Button variant="danger" onClick={handlePararBatimentos}>
            Parar
          </Button>
        </div>
        <Checkbox
          id="chk-loop-aparado"
          label={`Loop aparado (LOOP_BATIMENTOS_APARADO = ${loopAparado}) — descarta silêncio inicial/final`}
          checked={loopAparado}
          onChange={handleToggleLoopAparado}
        />
      </section>

      {/* 4. Faixas musicais */}
      <section class="demo-section">
        <div class="demo-row" style={{ justifyContent: 'space-between' }}>
          <h2 class="demo-section__title">4. Faixas Musicais (6 Pares)</h2>
          <Button variant="ghost" onClick={() => audioEngine.pararFaixa()}>
            Cancelar faixa atual (pararFaixa)
          </Button>
        </div>

        <div class="lab-live-timer">
          <div>
            Faixa ativa:{' '}
            <strong>
              {faixaTocandoSrc
                ? faixaTocandoSrc.replace('./audio/', '')
                : 'Nenhuma'}
            </strong>
          </div>
          <div>
            Tempo decorrido ao vivo:{' '}
            <strong>{faixaTocandoSrc ? `${tempoDecorridoS}s` : '0.00s'}</strong>
            {faixaTocandoSrc && infosBuffer[faixaTocandoSrc]
              ? ` / ${infosBuffer[faixaTocandoSrc].duracaoS}s`
              : ''}
          </div>
          {ultimaMedicao && (
            <div class="diag-detail">
              Última medição ({ultimaMedicao.src.replace('./audio/', '')} →{' '}
              <strong>{ultimaMedicao.resultado}</strong>): real{' '}
              <strong>{ultimaMedicao.duracaoMedidaS}s</strong> vs buffer{' '}
              <strong>{ultimaMedicao.duracaoBufferS}s</strong>
            </div>
          )}
        </div>

        <div class="demo-stack">
          {TRACKS.map((track) => {
            const infoEd = infosBuffer[track.srcEditado];
            const infoOr = infosBuffer[track.srcOriginal];
            return (
              <div key={track.ordem} class="lab-track-row">
                <div class="lab-track-info">
                  <strong>
                    {track.ordem}. {track.rotulo}
                  </strong>
                  <span class="diag-detail">
                    Editada: {infoEd ? `${infoEd.duracaoS}s` : '—'} | Original:{' '}
                    {infoOr ? `${infoOr.duracaoS}s` : '—'}
                  </span>
                </div>
                <div class="lab-track-actions">
                  <Button
                    variant="secondary"
                    onClick={() => handleTocarFaixa(track.srcEditado)}
                  >
                    Editada
                  </Button>
                  <Button
                    variant="primary"
                    onClick={() => handleTocarFaixa(track.srcOriginal)}
                  >
                    Original
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* 5. Sequência de teste do fluxo real */}
      <section class="demo-section">
        <h2 class="demo-section__title">
          5. Sequência de Teste do Fluxo Real ("Simular um par")
        </h2>
        <p class="diag-detail">
          Executa: fadeOutBatimentos → tocar editada → ao fim, tocar original → ao
          fim, fadeInBatimentos.
        </p>
        <div class="demo-row">
          <select
            class="ui-textfield__input"
            value={parSimuladoIdx}
            onChange={(e) =>
              setParSimuladoIdx(Number(e.currentTarget.value))
            }
            disabled={simulandoPar}
          >
            {TRACKS.map((t, idx) => (
              <option key={t.ordem} value={idx}>
                Par {t.ordem}: {t.rotulo}
              </option>
            ))}
          </select>
          <Button
            variant="primary"
            onClick={handleSimularPar}
            disabled={simulandoPar}
          >
            {simulandoPar ? 'Simulando par...' : 'Simular um par'}
          </Button>
        </div>
      </section>

      {/* 6. Testes de estresse */}
      <section class="demo-section">
        <h2 class="demo-section__title">6. Testes de Estresse</h2>
        <div class="demo-grid">
          <div class="lab-stress-box">
            <h3 class="demo-subsection__title">a) Estresse de cliques (30x em ~2s)</h3>
            <p class="diag-detail">
              Amostra fontesMusicaAtivas a cada 20 ms para provar que nunca passa de 1.
            </p>
            <Button
              variant="secondary"
              fullWidth
              onClick={handleEstresseCliques}
              disabled={estresseCliques.executando}
            >
              {estresseCliques.executando
                ? 'Executando 30 cliques...'
                : 'Estresse de cliques'}
            </Button>
            {estresseCliques.passou !== null && (
              <div
                class={`diag-status ${
                  estresseCliques.passou ? 'status-ok' : 'status-fail'
                }`}
              >
                {estresseCliques.passou ? 'PASSOU' : 'FALHOU'} — Máx fontes:{' '}
                {estresseCliques.maxFontesObservadas} ({estresseCliques.amostras}{' '}
                amostras)
              </div>
            )}
          </div>

          <div class="lab-stress-box">
            <h3 class="demo-subsection__title">b) Estresse de fades (10x rápido)</h3>
            <p class="diag-detail">
              Alterna fadeOut/fadeIn 10x nos batimentos e verifica o ganho final.
            </p>
            <Button
              variant="secondary"
              fullWidth
              onClick={handleEstresseFades}
              disabled={estresseFades.executando}
            >
              {estresseFades.executando
                ? 'Alternando fades...'
                : 'Estresse de fades'}
            </Button>
            {estresseFades.passou !== null && (
              <div
                class={`diag-status ${
                  estresseFades.passou ? 'status-ok' : 'status-fail'
                }`}
              >
                {estresseFades.passou ? 'PASSOU' : 'FALHOU'} — Ganho final:{' '}
                {estresseFades.ganhoFinal} (esperado: {estresseFades.ganhoEsperado})
              </div>
            )}
          </div>
        </div>
      </section>

      {/* 7. Níveis (Sliders de runtime) */}
      <section class="demo-section">
        <h2 class="demo-section__title">
          7. Níveis em Runtime (copiar valores calibrados para src/audio/config.ts)
        </h2>
        <div class="demo-stack">
          <label class="lab-slider-row">
            <span>
              VOLUME_MESTRE = <strong>{volumeMestre.toFixed(2)}</strong>
            </span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={volumeMestre}
              onInput={(e) => {
                const v = Number(e.currentTarget.value);
                setVolumeMestre(v);
                audioEngine.definirVolumeMestreRuntime(v);
              }}
            />
          </label>

          <label class="lab-slider-row">
            <span>
              NIVEL_BATIMENTOS = <strong>{nivelBatimentos.toFixed(2)}</strong>
            </span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={nivelBatimentos}
              onInput={(e) => {
                const v = Number(e.currentTarget.value);
                setNivelBatimentos(v);
                audioEngine.definirNivelBatimentosRuntime(v);
              }}
            />
          </label>

          <label class="lab-slider-row">
            <span>
              NIVEL_MUSICA = <strong>{nivelMusica.toFixed(2)}</strong>
            </span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={nivelMusica}
              onInput={(e) => {
                const v = Number(e.currentTarget.value);
                setNivelMusica(v);
                audioEngine.definirNivelMusicaRuntime(v);
              }}
            />
          </label>
        </div>
        <pre class="lab-config-snippet">
          {`export const VOLUME_MESTRE = ${volumeMestre.toFixed(2)};\nexport const NIVEL_BATIMENTOS = ${nivelBatimentos.toFixed(2)};\nexport const NIVEL_MUSICA = ${nivelMusica.toFixed(2)};\nexport const LOOP_BATIMENTOS_APARADO = ${loopAparado};`}
        </pre>
      </section>

      {/* 8. Log de eventos */}
      <section class="demo-section">
        <div class="demo-row" style={{ justifyContent: 'space-between' }}>
          <h2 class="demo-section__title">8. Log de Eventos ({logs.length})</h2>
          <div class="demo-row">
            <Button variant="secondary" onClick={handleCopiarLog}>
              Copiar log
            </Button>
            <Button variant="ghost" onClick={() => setLogs([])}>
              Limpar
            </Button>
          </div>
        </div>
        <pre ref={logAreaRef} class="lab-log-area">
          {logs.join('\n')}
        </pre>
      </section>
    </main>
  );
}
