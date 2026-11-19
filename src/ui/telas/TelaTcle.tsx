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

type TipoErroModal = 'audio' | 'preload' | null;

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

  useEffect(() => {
    const desassinar = assinarPreparoAudio(setEstadoAudio);
    // Inicia a pré-carga dos 13 áudios em segundo plano enquanto o participante lê o termo
    void garantirPreload().catch(() => {});

    return () => {
      desassinar();
      // Garante que o nome seja limpo ao desmontar a Tela 1
      setNome('');
    };
  }, []);

  const mostrarErro = (tipo: 'audio' | 'preload') => {
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
        if (rel.falhas.length > 0) {
          mostrarErro('preload');
          setProcessando(false);
          return;
        }
        const n = await proximoNumeroParticipante();
        setNome('');
        sessionStore.dispatch(montarEventoAceitar(n, autorizaImagem));
      } catch {
        mostrarErro('preload');
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

      {/* Modal para erros de desbloqueio de áudio ou falha de pré-carga */}
      <Modal
        aberto={erroModal !== null}
        mensagem={
          erroModal === 'audio' ? STRINGS.erroAudio : STRINGS.erroPreload
        }
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
