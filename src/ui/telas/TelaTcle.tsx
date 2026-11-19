import { useEffect, useState } from 'preact/hooks';
import { audioEngine } from '../../audio/AudioEngine';
import {
  assinarPreparoAudio,
  EstadoPreparoAudio,
  garantirPreload,
  obterEstadoPreparoAudio,
} from '../../audio/preparo';
import {
  EXIGIR_ROLAGEM_ATE_O_FIM,
  NOME_OBRIGATORIO,
} from '../../content/config';
import { STRINGS } from '../../content/strings';
import { sessionStore } from '../../session/store';
import { Evento, ImagemAutorizacao } from '../../session/tipos';
import { proximoNumeroParticipante } from '../../storage/contador';
import {
  assinarPreparoArmazenamento,
  EstadoPreparoArmazenamento,
  garantirSaudeArmazenamento,
  obterEstadoPreparoArmazenamento,
} from '../../storage/preparo';
import { Button } from '../components/Button';
import { Checkbox } from '../components/Checkbox';
import { Modal } from '../components/Modal';
import { RadioGroup } from '../components/RadioGroup';
import { TcleViewer } from '../components/TcleViewer';
import { TextField } from '../components/TextField';

export interface ParametrosPodeAceitar {
  consentiu: boolean;
  nome: string;
  nomeObrigatorio: boolean;
  processando: boolean;
}

export interface ParametrosPodeIniciarSessao {
  audioOk: boolean;
  armazenamentoOk: boolean;
}

/**
 * Função pura que determina se o botão "Aceito participar" deve estar habilitado.
 */
export function podeAceitar({
  consentiu,
  nome,
  nomeObrigatorio,
  processando,
}: ParametrosPodeAceitar): boolean {
  if (processando) return false;
  if (!consentiu) return false;
  if (nomeObrigatorio && nome.trim().length === 0) return false;
  return true;
}

/**
 * Função pura que verifica se ambos os pré-requisitos técnicos (áudio e armazenamento) estão prontos.
 */
export function podeIniciarSessao({
  audioOk,
  armazenamentoOk,
}: ParametrosPodeIniciarSessao): boolean {
  return Boolean(audioOk && armazenamentoOk);
}

/**
 * Constrói o evento ACEITAR para a máquina de estados.
 * Por privacidade, NUNCA recebe nem inclui o nome do participante.
 */
export function montarEventoAceitar(
  proximoNumero: number,
  autorizaImagem: ImagemAutorizacao
): Evento {
  return {
    tipo: 'ACEITAR',
    proximoNumero,
    autorizaImagem,
  };
}

type TipoErroModal = 'audio' | 'preload' | 'armazenamento' | null;

// Tela 1 — Termo de Consentimento Livre e Esclarecido (TCLE)
export function TelaTcle() {
  // O nome existe APENAS neste estado local e é apagado ao sair da tela
  const [nome, setNome] = useState<string>('');
  const [consentiu, setConsentiu] = useState<boolean>(false);
  const [autorizaImagem, setAutorizaImagem] =
    useState<ImagemAutorizacao>(null);
  const [rolouAteOFim, setRolouAteOFim] = useState<boolean>(
    !EXIGIR_ROLAGEM_ATE_O_FIM
  );
  const [processando, setProcessando] = useState<boolean>(false);
  const [erroModal, setErroModal] = useState<TipoErroModal>(null);
  const [estadoAudio, setEstadoAudio] = useState<EstadoPreparoAudio>(() =>
    obterEstadoPreparoAudio()
  );
  const [estadoArmazenamento, setEstadoArmazenamento] =
    useState<EstadoPreparoArmazenamento>(() =>
      obterEstadoPreparoArmazenamento()
    );

  useEffect(() => {
    const desassinarAudio = assinarPreparoAudio(setEstadoAudio);
    const desassinarArmazenamento = assinarPreparoArmazenamento(
      setEstadoArmazenamento
    );

    // Inicia a pré-carga dos 13 áudios e a verificação de saúde do IndexedDB em segundo plano
    void garantirPreload().catch(() => {});
    void garantirSaudeArmazenamento().catch(() => {});

    return () => {
      desassinarAudio();
      desassinarArmazenamento();
      // Garante que o nome seja limpo ao desmontar a Tela 1
      setNome('');
    };
  }, []);

  const mostrarErro = (tipo: 'audio' | 'preload' | 'armazenamento') => {
    setErroModal(tipo);
  };

  // CRÍTICO: audioEngine.unlock() é invocado SINCRONAMENTE no gesto do toque
  const onAceitar = () => {
    if (processando) return;
    setProcessando(true);
    const unlock = audioEngine.unlock();
    unlock.then(async (ok) => {
      if (!ok) {
        mostrarErro('audio');
        setProcessando(false);
        return;
      }
      try {
        const rel = await garantirPreload();
        const audioOk = rel.falhas.length === 0;
        if (!audioOk) {
          mostrarErro('preload');
          setProcessando(false);
          return;
        }

        const saude = await garantirSaudeArmazenamento();
        if (
          !podeIniciarSessao({
            audioOk,
            armazenamentoOk: saude.saudavel,
          })
        ) {
          mostrarErro('armazenamento');
          setProcessando(false);
          return;
        }

        const n = await proximoNumeroParticipante();
        setNome('');
        sessionStore.dispatch(montarEventoAceitar(n, autorizaImagem));
      } catch {
        mostrarErro('armazenamento');
        setProcessando(false);
      }
    });
  };

  const onRecusar = () => {
    if (processando) return;
    setNome('');
    sessionStore.dispatch({ tipo: 'RECUSAR' });
  };

  const botaoAceitarHabilitado = podeAceitar({
    consentiu,
    nome,
    nomeObrigatorio: NOME_OBRIGATORIO,
    processando,
  });

  const textoIndicadorAudio =
    estadoAudio === 'pronto'
      ? STRINGS.audioPronto
      : estadoAudio === 'falha'
      ? STRINGS.audioFalha
      : STRINGS.audioPreparando;

  const textoIndicadorArmazenamento =
    estadoArmazenamento === 'pronto'
      ? STRINGS.armazenamentoPronto
      : estadoArmazenamento === 'falha'
      ? STRINGS.armazenamentoFalha
      : STRINGS.armazenamentoPreparando;

  const mensagemModalErro =
    erroModal === 'audio'
      ? STRINGS.erroAudio
      : erroModal === 'preload'
      ? STRINGS.erroPreload
      : STRINGS.erroArmazenamento;

  return (
    <main class="tela-fluxo tela-tcle">
      <div class="tela-tcle__top-bar">
        <span class="tela-tcle__audio-badge" aria-live="polite">
          <span
            class={`tela-tcle__audio-dot tela-tcle__audio-dot--${estadoAudio}`}
            aria-hidden="true"
          />
          <span>{textoIndicadorAudio}</span>
        </span>

        <span class="tela-tcle__audio-badge" aria-live="polite">
          <span
            class={`tela-tcle__audio-dot tela-tcle__audio-dot--${
              estadoArmazenamento === 'verificando'
                ? 'carregando'
                : estadoArmazenamento
            }`}
            aria-hidden="true"
          />
          <span>{textoIndicadorArmazenamento}</span>
        </span>
      </div>

      <div class="tela-tcle__viewer">
        <TcleViewer
          maxHeight="46vh"
          onChegouAoFim={() => setRolouAteOFim(true)}
        />
      </div>

      <footer class="tela-tcle__footer">
        {/* 1. Campo de nome (apenas para formalizar o termo; nunca é salvo) */}
        <TextField
          id="tcle-campo-nome"
          name="tcle_formalizacao_local"
          label={STRINGS.campoNome.rotulo}
          note={STRINGS.campoNome.nota}
          placeholder={STRINGS.campoNome.placeholder}
          value={nome}
          onInput={setNome}
          disabled={processando}
          autocapitalize="words"
          spellcheck={false}
          autocorrect="off"
          enterkeyhint="done"
        />

        {/* 2. Checkbox obrigatório de consentimento de participação */}
        <Checkbox
          id="tcle-chk-participacao"
          label={STRINGS.consentimentoParticipacao}
          checked={consentiu}
          onChange={setConsentiu}
          disabled={processando || !rolouAteOFim}
        />

        {/* 3. Bloco opcional de registro de imagem (nenhuma opção pré-selecionada) */}
        <RadioGroup
          name="tcle-consentimento-imagem"
          legend={STRINGS.blocoImagemTitulo}
          value={autorizaImagem}
          onChange={setAutorizaImagem}
          disabled={processando}
          options={[
            { value: 'autoriza', label: STRINGS.consentimentoImagemSim },
            { value: 'nao-autoriza', label: STRINGS.consentimentoImagemNao },
          ]}
        />

        {/* 4. Dois botões grandes lado a lado */}
        <div class="tela-tcle__actions">
          <Button
            variant="primary"
            fullWidth
            disabled={!botaoAceitarHabilitado}
            onClick={onAceitar}
          >
            {STRINGS.botoes.aceitoParticipar}
          </Button>
          <Button
            variant="secondary"
            fullWidth
            disabled={processando}
            onClick={onRecusar}
          >
            {STRINGS.botoes.naoAceito}
          </Button>
        </div>
      </footer>

      {/* Modal para erros de desbloqueio de áudio, pré-carga ou armazenamento */}
      <Modal
        aberto={erroModal !== null}
        mensagem={mensagemModalErro}
        rotuloConfirmar={STRINGS.botaoTentarNovamente}
        rotuloCancelar={STRINGS.botaoOk}
        varianteConfirmar="primary"
        onConfirmar={() => {
          setErroModal(null);
          onAceitar();
        }}
        onCancelar={() => setErroModal(null)}
      />
    </main>
  );
}
