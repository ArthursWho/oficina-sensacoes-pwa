import { useEffect, useState } from 'preact/hooks';
import { STRINGS } from '../../content/strings';
import {
  baixarArquivo,
  compartilharArquivo,
  copiarComoTexto,
  podeCompartilhar,
} from '../../export/baixar';
import { gerarCsv, gerarCsvBlob } from '../../export/csv';
import { achatarSessoes } from '../../export/linhas';
import { nomeArquivoExportacao } from '../../export/nomeArquivo';
import { gerarXlsx } from '../../export/xlsx';
import { sessionStore } from '../../session/store';
import { Estado } from '../../session/tipos';
import { obterVersaoApp } from '../../storage/db';
import {
  estadoArmazenamento,
  EstadoArmazenamentoDispositivo,
} from '../../storage/persistente';
import { repositorio } from '../../storage/repositorio';
import { Button } from '../components/Button';
import { IconeEngrenagem } from '../components/IconeEngrenagem';
import { Modal } from '../components/Modal';
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
  arquivo: File | null;
  textoCsv: string;
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

  // Contadores lidos do repositório ao abrir o menu
  const [totalSessoes, setTotalSessoes] = useState<number>(0);
  const [naoExportadas, setNaoExportadas] = useState<number>(0);
  const [infoStorage, setInfoStorage] =
    useState<EstadoArmazenamentoDispositivo | null>(null);

  // Estado da exportação
  const [gerandoExportacao, setGerandoExportacao] = useState<boolean>(false);
  const [statusExportacao, setStatusExportacao] = useState<string>('');
  const [erroExportacao, setErroExportacao] = useState<string>('');
  const [ultimoGerado, setUltimoGerado] =
    useState<UltimoArquivoGerado | null>(null);
  const [mostrarTextareaFallback, setMostrarTextareaFallback] =
    useState<boolean>(false);
  const [msgCopia, setMsgCopia] = useState<string>('');

  // Estado de atualização do PWA
  const [atualizacaoPendente, setAtualizacaoPendente] = useState<boolean>(() =>
    temAtualizacaoDisponivel()
  );

  useEffect(() => {
    return assinarAtualizacaoPwa(setAtualizacaoPendente);
  }, []);

  const carregarDadosMenu = async () => {
    try {
      const [total, pendentes, st] = await Promise.all([
        repositorio.contarSessoes(),
        repositorio.contarNaoExportadas(),
        estadoArmazenamento(),
      ]);
      setTotalSessoes(total);
      setNaoExportadas(pendentes);
      setInfoStorage(st);
    } catch {
      // Mantém valores atuais se falhar leitura
    }
  };

  const abrirPainelMenu = () => {
    setErroExportacao('');
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
      // Em fase "tcle", REINICIAR é ignorado pela máquina: fecha o menu e incrementa chaveSessao para remontar a TelaTcle
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

  // Ação: Exportar CSV ou XLSX
  const handleExportar = async (formato: 'csv' | 'xlsx') => {
    if (gerandoExportacao) return;
    setGerandoExportacao(true);
    setErroExportacao('');
    setStatusExportacao('Gerando arquivo…');
    setMsgCopia('');
    setMostrarTextareaFallback(false);

    try {
      const sessoes = await repositorio.listarSessoes();
      if (sessoes.length === 0) {
        setStatusExportacao('');
        setErroExportacao(STRINGS.semSessoes);
        setGerandoExportacao(false);
        return;
      }

      const linhas = achatarSessoes(sessoes);
      const agora = new Date();
      const nome = nomeArquivoExportacao(formato, agora, sessoes.length);
      const textoCsv = gerarCsv(linhas);

      let blob: Blob;
      let mime: string;
      if (formato === 'csv') {
        blob = gerarCsvBlob(linhas);
        mime = 'text/csv;charset=utf-8';
      } else {
        blob = await gerarXlsx(linhas);
        mime =
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      }

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
      await repositorio.registrarExportacao(ids, agora);

      let arquivoFile: File | null = null;
      if (typeof File !== 'undefined') {
        try {
          arquivoFile = new File([blob], nome, { type: mime });
        } catch {
          arquivoFile = null;
        }
      }

      setUltimoGerado({
        nome,
        arquivo: arquivoFile,
        textoCsv,
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

  const handleCompartilhar = async () => {
    if (!ultimoGerado?.arquivo) return;
    const res = await compartilharArquivo(ultimoGerado.arquivo);
    if (!res.ok && res.motivo) {
      setMsgCopia(res.motivo);
    }
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

  const compartilhamentoSuportado =
    ultimoGerado?.arquivo != null && podeCompartilhar(ultimoGerado.arquivo);

  return (
    <>
      {/* Botão discreto de engrenagem no canto superior esquerdo (oposto ao indicador "n / 6") */}
      <button
        type="button"
        class="ui-operator-gear-btn"
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
          class="ui-operator-overlay"
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
                <div class="diag-status status-ok" style={{ whiteSpace: 'normal' }}>
                  {statusExportacao}
                </div>
              )}

              {erroExportacao && (
                <div class="diag-status status-fail" style={{ whiteSpace: 'normal' }}>
                  {erroExportacao}
                </div>
              )}

              {ultimoGerado && (
                <div class="demo-stack">
                  <div class="demo-grid">
                    {compartilhamentoSuportado && (
                      <Button
                        variant="secondary"
                        fullWidth
                        onClick={handleCompartilhar}
                      >
                        {STRINGS.compartilhar}
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
                  <strong>{textoArmazenamentoProtegido}</strong>
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
          </div>
        </div>
      )}
    </>
  );
}
