import { useEffect, useState } from 'preact/hooks';
import {
  assinarPreferenciaEfeitosUi,
  definirPreferenciaEfeitosUi,
  obterPreferenciaEfeitosUi,
} from '../../audio/efeitosUi';
import { obterContagemPreloadAudio } from '../../audio/preparo';
import { STRINGS } from '../../content/strings';
import {
  baixarArquivo,
  compartilharArquivo,
  compartilharTexto,
  copiarComoTexto,
  prepararCompartilhamento,
  PreparoCompartilhamento,
  ResultadoCompartilhamento,
} from '../../export/baixar';
import { gerarCsv, gerarCsvBlob } from '../../export/csv';
import { achatarSessoes } from '../../export/linhas';
import { nomeArquivoExportacao } from '../../export/nomeArquivo';
import { gerarXlsx } from '../../export/xlsx';
import {
  assinarWakeLockGlobal,
  EstadoWakeLock,
  obterEstadoWakeLockGlobal,
} from '../../plataforma/wakeLock';
import { sessionStore } from '../../session/store';
import { Estado } from '../../session/tipos';
import { obterDataBuildApp, obterVersaoApp } from '../../storage/db';
import {
  assinarModoEnsaio,
  bannerModoEnsaio,
  definirModoEnsaio,
  obterModoEnsaio,
  podeAlternarEnsaio,
} from '../../storage/ensaio';
import { obterModoBuildAtual } from '../../storage/nomesBanco';
import {
  estadoArmazenamento,
  EstadoArmazenamentoDispositivo,
} from '../../storage/persistente';
import { repositorioAtivo } from '../../storage/repositorio';
import { Button } from '../components/Button';
import { IconeEngrenagem } from '../components/IconeEngrenagem';
import { Modal } from '../components/Modal';
import {
  assinarDiagnosticoVisual,
  DiagnosticoVisual,
  obterDiagnosticoVisual,
} from '../components/VisualOrganico';
import { acoesMenu, aoTocarEngrenagem } from './logicaMenu';
import {
  aplicarAtualizacaoPwa,
  assinarAtualizacaoPwa,
  temAtualizacaoDisponivel,
} from './pwaUpdate';

export interface MenuOperadorProps {
  estado: Estado;
  onRemontarTcle: () => void;
}

interface UltimoArquivoGerado {
  nome: string;
  blob: Blob;
  textoCsv: string;
  preparoShare: PreparoCompartilhamento;
}

interface ErroShareUi {
  amigavel: string;
  detalheTecnico: string;
}

function obterDisplayModeAtual(): string {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return 'browser';
  }
  if (window.matchMedia('(display-mode: fullscreen)').matches) {
    return 'fullscreen';
  }
  if (window.matchMedia('(display-mode: standalone)').matches) {
    return 'standalone';
  }
  return 'browser';
}

// Botão global de engrenagem + Painel sobreposto do Menu do Operador
export function MenuOperador({ estado, onRemontarTcle }: MenuOperadorProps) {
  const [menuAberto, setMenuAberto] = useState<boolean>(false);
  const [modalInterromperAberto, setModalInterromperAberto] =
    useState<boolean>(false);
  const [modalNaoSalvaAberto, setModalNaoSalvaAberto] =
    useState<boolean>(false);
  const [modalAtualizarAberto, setModalAtualizarAberto] =
    useState<boolean>(false);

  // Contadores lidos do repositório ativo ao abrir o menu
  const [totalSessoes, setTotalSessoes] = useState<number>(0);
  const [naoExportadas, setNaoExportadas] = useState<number>(0);
  const [infoStorage, setInfoStorage] =
    useState<EstadoArmazenamentoDispositivo | null>(null);

  // Estado da exportação e compartilhamento
  const [gerandoExportacao, setGerandoExportacao] = useState<boolean>(false);
  const [statusExportacao, setStatusExportacao] = useState<string>('');
  const [erroExportacao, setErroExportacao] = useState<string>('');
  const [ultimoGerado, setUltimoGerado] =
    useState<UltimoArquivoGerado | null>(null);
  const [erroShare, setErroShare] = useState<ErroShareUi | null>(null);
  const [mostrarTextareaFallback, setMostrarTextareaFallback] =
    useState<boolean>(false);
  const [msgCopia, setMsgCopia] = useState<string>('');

  // Estado de atualização do PWA, Wake Lock, Sons da interface e Modo de Ensaio
  const [atualizacaoPendente, setAtualizacaoPendente] = useState<boolean>(() =>
    temAtualizacaoDisponivel()
  );
  const [wakeLockState, setWakeLockState] = useState<EstadoWakeLock>(() =>
    obterEstadoWakeLockGlobal()
  );
  const [sonsUiAtivos, setSonsUiAtivos] = useState<boolean>(() =>
    obterPreferenciaEfeitosUi()
  );
  const [modoEnsaio, setModoEnsaio] = useState<boolean>(() =>
    obterModoEnsaio()
  );

  // Seção recolhível de Diagnóstico
  const [diagAberto, setDiagAberto] = useState<boolean>(false);
  const [swAtivo, setSwAtivo] = useState<boolean>(false);
  const [isOnline, setIsOnline] = useState<boolean>(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [diagVisual, setDiagVisual] = useState<DiagnosticoVisual>(() =>
    obterDiagnosticoVisual()
  );

  useEffect(() => {
    const u1 = assinarAtualizacaoPwa(setAtualizacaoPendente);
    const u2 = assinarWakeLockGlobal(setWakeLockState);
    const u3 = assinarPreferenciaEfeitosUi(setSonsUiAtivos);
    const u4 = assinarModoEnsaio(setModoEnsaio);
    const u5 = assinarDiagnosticoVisual(setDiagVisual);

    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);

    return () => {
      u1();
      u2();
      u3();
      u4();
      u5();
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  const verificarSwAtivo = async () => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
      setSwAtivo(false);
      return;
    }
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      setSwAtivo(Boolean(navigator.serviceWorker.controller || reg?.active));
    } catch {
      setSwAtivo(false);
    }
  };

  const carregarDadosMenu = async () => {
    setWakeLockState(obterEstadoWakeLockGlobal());
    void verificarSwAtivo();
    try {
      const [total, pendentes, st, prefs] = await Promise.all([
        repositorioAtivo.contarSessoes(),
        repositorioAtivo.contarNaoExportadas(),
        estadoArmazenamento(),
        repositorioAtivo.obterPreferencias(),
      ]);
      setTotalSessoes(total);
      setNaoExportadas(pendentes);
      setInfoStorage(st);
      definirPreferenciaEfeitosUi(prefs.efeitosUi);
    } catch {
      // Mantém valores atuais se falhar leitura
    }
  };

  const handleAlternarSonsUi = async () => {
    const novoValor = !sonsUiAtivos;
    definirPreferenciaEfeitosUi(novoValor);
    try {
      await repositorioAtivo.salvarPreferencias({ efeitosUi: novoValor });
    } catch {
      // Mantém preferência em memória mesmo se falhar gravação
    }
  };

  const handleAlternarModoEnsaio = async () => {
    if (!podeAlternarEnsaio(estado)) return;
    const novoValor = !modoEnsaio;
    definirModoEnsaio(novoValor, estado);
    setUltimoGerado(null);
    setStatusExportacao('');
    setErroExportacao('');
    onRemontarTcle();
    await carregarDadosMenu();
  };

  const abrirPainelMenu = () => {
    setErroExportacao('');
    setErroShare(null);
    setMsgCopia('');
    setMenuAberto(true);
    void carregarDadosMenu();
  };

  // Toque na engrenagem
  const handleTocarEngrenagem = () => {
    const acao = aoTocarEngrenagem(estado);
    if (acao === 'pedir-confirmacao') {
      setModalInterromperAberto(true);
    } else {
      abrirPainelMenu();
    }
  };

  // Confirmar interrupção no modal da engrenagem -> CANCELAR e abre o menu
  const handleConfirmarInterrupcaoEngrenagem = () => {
    setModalInterromperAberto(false);
    sessionStore.dispatch({ tipo: 'CANCELAR' });
    abrirPainelMenu();
  };

  const acoes = acoesMenu(estado, { totalSessoes, naoExportadas });

  // Ação: Iniciar novo participante
  const handleIniciarNovoParticipante = () => {
    if (acoes.novoParticipante.exigeAvisoNaoSalva) {
      setModalNaoSalvaAberto(true);
      return;
    }

    if (estado.fase === 'tcle') {
      setMenuAberto(false);
      onRemontarTcle();
      return;
    }

    setMenuAberto(false);
    sessionStore.dispatch({ tipo: 'REINICIAR' });
    onRemontarTcle();
  };

  const handleDescartarNaoSalvaEContinuar = () => {
    setModalNaoSalvaAberto(false);
    setMenuAberto(false);
    sessionStore.dispatch({ tipo: 'REINICIAR', forcar: true });
    onRemontarTcle();
  };

  // Ação: Cancelar sessão atual
  const handleCancelarSessaoAtual = () => {
    if (!acoes.cancelarSessao.habilitado) return;
    setMenuAberto(false);
    sessionStore.dispatch({ tipo: 'CANCELAR' });
  };

  // Ação: Exportar CSV ou XLSX (usa repositorioAtivo e prefixo ENSAIO_ quando em modo de ensaio)
  const handleExportar = async (formato: 'csv' | 'xlsx') => {
    if (gerandoExportacao) return;
    setGerandoExportacao(true);
    setErroExportacao('');
    setErroShare(null);
    setStatusExportacao('Gerando arquivo…');
    setMsgCopia('');
    setMostrarTextareaFallback(false);

    try {
      const sessoes = await repositorioAtivo.listarSessoes();
      if (sessoes.length === 0) {
        setStatusExportacao('');
        setErroExportacao(STRINGS.semSessoes);
        setGerandoExportacao(false);
        return;
      }

      const linhas = achatarSessoes(sessoes);
      const agora = new Date();
      const nome = nomeArquivoExportacao(formato, agora, sessoes.length, {
        ensaio: obterModoEnsaio(),
      });
      const textoCsv = gerarCsv(linhas);

      const blob =
        formato === 'csv' ? gerarCsvBlob(linhas) : await gerarXlsx(linhas);

      const preparoShare = prepararCompartilhamento({
        formato,
        blobDownload: blob,
        nomeOriginal: nome,
        textoCsvSemBom: textoCsv,
      });

      const resDownload = baixarArquivo(blob, nome);
      if (!resDownload.ok) {
        setStatusExportacao('');
        setErroExportacao(
          resDownload.motivo ?? 'Falha ao iniciar o download do arquivo.'
        );
        setGerandoExportacao(false);
        return;
      }

      const ids = sessoes.map((s) => s.id_participante);
      await repositorioAtivo.registrarExportacao(ids, agora);

      setUltimoGerado({
        nome,
        blob,
        textoCsv,
        preparoShare,
      });
      setStatusExportacao(STRINGS.arquivoGerado.replace('{nome}', nome));
      await carregarDadosMenu();
    } catch (erro) {
      const msg =
        erro instanceof Error ? erro.message : 'Erro ao gerar exportação.';
      setStatusExportacao('');
      setErroExportacao(msg);
    } finally {
      setGerandoExportacao(false);
    }
  };

  const tratarResultadoShare = (
    res: ResultadoCompartilhamento,
    variante: number | null
  ) => {
    if (res.ok || res.cancelado) {
      setErroShare(null);
      return;
    }

    const detalhe = STRINGS.detalheTecnicoCompartilhar
      .replace('{nome}', res.nome ?? 'Error')
      .replace('{mensagem}', res.mensagem ?? 'Falha desconhecida')
      .replace('{n}', String(variante ?? '—'));

    setErroShare({
      amigavel: STRINGS.erroCompartilharAmigavel,
      detalheTecnico: detalhe,
    });
  };

  // Handler SÍNCRONO para "Compartilhar arquivo" (variantes 1 ou 2)
  const handleCompartilharArquivo = () => {
    const prep = ultimoGerado?.preparoShare;
    if (!prep || !prep.arquivo) return;
    setErroShare(null);
    compartilharArquivo(prep.arquivo).then((res) =>
      tratarResultadoShare(res, prep.variante)
    );
  };

  // Handler SÍNCRONO para "Compartilhar como texto" (variante 3)
  const handleCompartilharTexto = () => {
    const prep = ultimoGerado?.preparoShare;
    if (!prep) return;
    setErroShare(null);
    compartilharTexto(prep.nomeOriginal, prep.textoCsvSemBom).then((res) =>
      tratarResultadoShare(res, prep.variante)
    );
  };

  const handleCopiarTexto = async () => {
    if (!ultimoGerado) return;
    const copiou = await copiarComoTexto(ultimoGerado.textoCsv);
    if (copiou) {
      setMsgCopia('Dados copiados para a área de transferência.');
      setMostrarTextareaFallback(false);
    } else {
      setMsgCopia(
        'Não foi possível copiar automaticamente. Selecione e copie o texto abaixo:'
      );
      setMostrarTextareaFallback(true);
    }
  };

  const textoArmazenamentoProtegido = !infoStorage
    ? '...'
    : !infoStorage.suportado
    ? 'sem suporte'
    : infoStorage.persistido
    ? 'sim'
    : 'não';

  const textoQuotaStorage =
    infoStorage?.usoMB !== undefined && infoStorage?.quotaMB !== undefined
      ? ` (${infoStorage.usoMB} MB / ${infoStorage.quotaMB} MB)`
      : '';

  const textoWakeLock =
    wakeLockState.status === 'ativo'
      ? STRINGS.wakeAtiva
      : wakeLockState.status === 'indisponivel'
      ? STRINGS.wakeIndisponivel
      : wakeLockState.status === 'negado'
      ? `${STRINGS.wakeNegada}${
          wakeLockState.motivo ? ` (${wakeLockState.motivo})` : ''
        }`
      : 'inativa';

  const modoShare = ultimoGerado?.preparoShare.modo ?? 'indisponivel';
  const podeMudarEnsaio = podeAlternarEnsaio(estado);
  const textoBannerEnsaio = bannerModoEnsaio(estado, modoEnsaio);
  const contagemAudio = obterContagemPreloadAudio();
  const modoBuildStr =
    obterModoBuildAtual() === 'producao' ? 'PRODUÇÃO' : 'DESENVOLVIMENTO';

  return (
    <>
      {/* Faixa fixa global no topo de todas as telas e do menu quando o Modo de Ensaio está ativo */}
      {textoBannerEnsaio && (
        <div class="ui-ensaio-banner" role="status" aria-live="polite">
          {textoBannerEnsaio}
        </div>
      )}

      {/* Botão discreto de engrenagem no canto superior esquerdo (oposto ao indicador "n / 6") */}
      <button
        type="button"
        class={`ui-operator-gear-btn ${
          textoBannerEnsaio ? 'ui-operator-gear-btn--with-banner' : ''
        }`}
        aria-label={STRINGS.menuTitulo}
        onClick={handleTocarEngrenagem}
      >
        <IconeEngrenagem size={20} />
      </button>

      {/* Modal de confirmação ao tocar na engrenagem durante sessão ativa */}
      <Modal
        aberto={modalInterromperAberto}
        mensagem={STRINGS.menuOperador.confirmacaoInterromper}
        rotuloConfirmar={STRINGS.menuOperador.botaoInterromper}
        rotuloCancelar={STRINGS.menuOperador.botaoContinuar}
        varianteConfirmar="danger"
        onConfirmar={handleConfirmarInterrupcaoEngrenagem}
        onCancelar={() => setModalInterromperAberto(false)}
      />

      {/* Modal de confirmação ao iniciar novo participante quando a sessão encerrada ainda não foi salva */}
      <Modal
        aberto={modalNaoSalvaAberto}
        mensagem={STRINGS.avisoNaoSalva}
        rotuloConfirmar={STRINGS.descartarContinuar}
        rotuloCancelar={STRINGS.voltar}
        varianteConfirmar="danger"
        onConfirmar={handleDescartarNaoSalvaEContinuar}
        onCancelar={() => setModalNaoSalvaAberto(false)}
      />

      {/* Modal de confirmação para atualizar e reiniciar o aplicativo */}
      <Modal
        aberto={modalAtualizarAberto}
        mensagem={STRINGS.confirmarAtualizar}
        rotuloConfirmar={STRINGS.botaoAtualizar}
        rotuloCancelar={STRINGS.voltar}
        varianteConfirmar="primary"
        onConfirmar={() => {
          setModalAtualizarAberto(false);
          void aplicarAtualizacaoPwa();
        }}
        onCancelar={() => setModalAtualizarAberto(false)}
      />

      {/* Painel sobreposto em tela cheia do Menu do Operador */}
      {menuAberto && (
        <div
          class={`ui-operator-overlay ${
            textoBannerEnsaio ? 'ui-operator-overlay--with-banner' : ''
          }`}
          role="dialog"
          aria-modal="true"
          aria-labelledby="operator-menu-title"
        >
          <div class="ui-operator-panel">
            {/* 1. Título e botão Fechar */}
            <header class="ui-operator-header">
              <h2 id="operator-menu-title" class="ui-operator-title">
                {STRINGS.menuTitulo}
              </h2>
              <Button variant="secondary" onClick={() => setMenuAberto(false)}>
                {STRINGS.menuFechar}
              </Button>
            </header>

            {/* 2. Contadores: Sessões concluídas e Ainda não exportadas */}
            <section class="ui-operator-section">
              <div class="ui-operator-counters">
                <div class="lab-stat-card">
                  <span class="diag-detail">{STRINGS.contadorSessoes}</span>
                  <strong class="lab-stat-val">
                    {STRINGS.contadorSessoes}: {totalSessoes}
                  </strong>
                </div>
                <div class="lab-stat-card">
                  <span class="diag-detail">{STRINGS.naoExportadas}</span>
                  <strong class="lab-stat-val">
                    {STRINGS.naoExportadas}: {naoExportadas}
                  </strong>
                </div>
              </div>
            </section>

            {/* 3. Ações de sessão: Iniciar novo participante e Cancelar sessão atual */}
            <section class="ui-operator-section">
              <div class="demo-grid">
                <Button
                  variant="primary"
                  fullWidth
                  disabled={!acoes.novoParticipante.habilitado}
                  onClick={handleIniciarNovoParticipante}
                >
                  {STRINGS.menuOperador.iniciarNovoParticipante}
                </Button>
                <Button
                  variant="danger"
                  fullWidth
                  disabled={!acoes.cancelarSessao.habilitado}
                  onClick={handleCancelarSessaoAtual}
                >
                  {STRINGS.menuOperador.cancelarSessaoAtual}
                </Button>
              </div>
            </section>

            {/* 4. Seção Exportar */}
            <section class="ui-operator-section">
              <h3 class="demo-section__title">
                {STRINGS.menuOperador.exportarDados}
              </h3>

              {!acoes.exportar.habilitado && acoes.exportar.motivo && (
                <p class="diag-detail">{acoes.exportar.motivo}</p>
              )}

              <div class="demo-grid">
                <Button
                  variant="primary"
                  fullWidth
                  disabled={!acoes.exportar.habilitado || gerandoExportacao}
                  onClick={() => handleExportar('csv')}
                >
                  {STRINGS.exportarCsv}
                </Button>
                <Button
                  variant="secondary"
                  fullWidth
                  disabled={!acoes.exportar.habilitado || gerandoExportacao}
                  onClick={() => handleExportar('xlsx')}
                >
                  {STRINGS.exportarXlsx}
                </Button>
              </div>

              {statusExportacao && (
                <div
                  class="diag-status status-ok"
                  style={{ whiteSpace: 'normal' }}
                >
                  {statusExportacao}
                </div>
              )}

              {erroExportacao && (
                <div
                  class="diag-status status-fail"
                  style={{ whiteSpace: 'normal' }}
                >
                  {erroExportacao}
                </div>
              )}

              {ultimoGerado && (
                <div class="demo-stack">
                  <div class="demo-grid">
                    {modoShare === 'arquivo' && (
                      <Button
                        variant="secondary"
                        fullWidth
                        onClick={handleCompartilharArquivo}
                      >
                        {STRINGS.compartilhar}
                      </Button>
                    )}
                    {modoShare === 'texto' && (
                      <Button
                        variant="secondary"
                        fullWidth
                        onClick={handleCompartilharTexto}
                      >
                        {STRINGS.compartilharTexto}
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      fullWidth
                      onClick={handleCopiarTexto}
                    >
                      {STRINGS.copiarTexto}
                    </Button>
                  </div>

                  {erroShare && (
                    <div class="ui-operator-share-error" role="alert">
                      <p class="ui-operator-share-error__msg">
                        {erroShare.amigavel}
                      </p>
                      <span class="ui-operator-share-error__tech">
                        {erroShare.detalheTecnico}
                      </span>
                    </div>
                  )}

                  {msgCopia && <p class="diag-detail">{msgCopia}</p>}

                  {mostrarTextareaFallback && (
                    <textarea
                      class="ui-operator-textarea"
                      readOnly
                      rows={6}
                      value={ultimoGerado.textoCsv}
                      onFocus={(e) => e.currentTarget.select()}
                    />
                  )}
                </div>
              )}
            </section>

            {/* 5. Seção Aplicativo */}
            <section class="ui-operator-section">
              <h3 class="demo-section__title">Aplicativo</h3>
              <div class="demo-stack">
                <div class="diag-item">
                  <span class="diag-label">{STRINGS.versaoInstalada}</span>
                  <strong>{obterVersaoApp()}</strong>
                </div>
                <div class="diag-item">
                  <span class="diag-label">{STRINGS.armazenamentoProtegido}</span>
                  <strong>
                    {textoArmazenamentoProtegido}
                    {textoQuotaStorage}
                  </strong>
                </div>
                <div class="diag-item">
                  <span class="diag-label">{STRINGS.telaSempreLigada}</span>
                  <strong>
                    {STRINGS.telaSempreLigada}: {textoWakeLock}
                  </strong>
                </div>
                <div class="diag-item">
                  <div>
                    <span class="diag-label">{STRINGS.sonsInterface}</span>
                    <span class="diag-detail">
                      {STRINGS.sonsInterfaceAviso}
                    </span>
                  </div>
                  <Button
                    variant={sonsUiAtivos ? 'primary' : 'secondary'}
                    onClick={handleAlternarSonsUi}
                  >
                    {sonsUiAtivos ? STRINGS.ligado : STRINGS.desligado}
                  </Button>
                </div>
                <div class="diag-item">
                  <div>
                    <span class="diag-label">{STRINGS.modoEnsaioTitulo}</span>
                    <span class="diag-detail">
                      {STRINGS.modoEnsaioApoio}
                      {!podeMudarEnsaio
                        ? ` (${STRINGS.modoEnsaioBloqueado})`
                        : ''}
                    </span>
                  </div>
                  <Button
                    variant={modoEnsaio ? 'danger' : 'secondary'}
                    disabled={!podeMudarEnsaio}
                    onClick={handleAlternarModoEnsaio}
                  >
                    {modoEnsaio ? STRINGS.ligado : STRINGS.desligado}
                  </Button>
                </div>
                <div class="diag-item">
                  <span class="diag-label">
                    {atualizacaoPendente
                      ? STRINGS.atualizacaoDisponivel
                      : STRINGS.semAtualizacao}
                  </span>
                  {atualizacaoPendente ? (
                    <Button
                      variant="primary"
                      onClick={() => setModalAtualizarAberto(true)}
                    >
                      {STRINGS.botaoAtualizar}
                    </Button>
                  ) : (
                    <span class="diag-detail">{STRINGS.semAtualizacao}</span>
                  )}
                </div>
              </div>
            </section>

            {/* 6. Seção Diagnóstico (recolhível) */}
            <section class="ui-operator-section">
              <div
                class="demo-row"
                style={{ justifyContent: 'space-between' }}
              >
                <h3 class="demo-section__title">
                  {STRINGS.diagnosticoMenuTitulo}
                </h3>
                <Button
                  variant="ghost"
                  onClick={() => setDiagAberto((v) => !v)}
                >
                  {diagAberto ? 'Ocultar diagnóstico' : 'Exibir diagnóstico'}
                </Button>
              </div>

              {diagAberto && (
                <div class="demo-stack">
                  <div class="diag-item">
                    <span class="diag-label">Versão / Commit do build</span>
                    <strong>{obterVersaoApp()}</strong>
                  </div>
                  <div class="diag-item">
                    <span class="diag-label">Data do build</span>
                    <strong>{obterDataBuildApp()}</strong>
                  </div>
                  <div class="diag-item">
                    <span class="diag-label">Modo de build</span>
                    <strong>{modoBuildStr}</strong>
                  </div>
                  <div class="diag-item">
                    <span class="diag-label">Banco ativo</span>
                    <strong>{repositorioAtivo.nomeBancoVigente()}</strong>
                  </div>
                  <div class="diag-item">
                    <span class="diag-label">Service Worker ativo</span>
                    <strong>{swAtivo ? 'sim' : 'não'}</strong>
                  </div>
                  <div class="diag-item">
                    <span class="diag-label">Modo de exibição</span>
                    <strong>{obterDisplayModeAtual()}</strong>
                  </div>
                  <div class="diag-item">
                    <span class="diag-label">Conexão</span>
                    <strong>{isOnline ? 'online' : 'offline'}</strong>
                  </div>
                  <div class="diag-item">
                    <span class="diag-label">{STRINGS.telaSempreLigada}</span>
                    <strong>{textoWakeLock}</strong>
                  </div>
                  <div class="diag-item">
                    <span class="diag-label">
                      {STRINGS.armazenamentoProtegido} (uso / quota)
                    </span>
                    <strong>
                      {textoArmazenamentoProtegido}
                      {textoQuotaStorage}
                    </strong>
                  </div>
                  <div class="diag-item">
                    <span class="diag-label">Áudios pré-carregados</span>
                    <strong>
                      {contagemAudio.carregados}/{contagemAudio.total}
                    </strong>
                  </div>
                  <div class="diag-item">
                    <span class="diag-label">Modo visual / FPS medido</span>
                    <strong>
                      {diagVisual.modoEscolhido} (
                      {diagVisual.fpsMedido !== null
                        ? `${diagVisual.fpsMedido} fps`
                        : 'n/d'}
                      )
                    </strong>
                  </div>
                </div>
              )}
            </section>
          </div>
        </div>
      )}
    </>
  );
}
