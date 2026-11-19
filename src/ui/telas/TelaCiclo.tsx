import { useEffect, useRef, useState } from 'preact/hooks';
import { STRINGS } from '../../content/strings';
import { retomarAudioNoGesto } from '../../session/controlador';
import { sessionStore } from '../../session/store';
import { Estado, Resposta } from '../../session/tipos';
import { formatarDataHora } from '../../session/utilidades';
import { visaoCiclo } from '../../session/visao';
import { Button } from '../components/Button';
import { Modal } from '../components/Modal';
import { ProgressoPar } from '../components/ProgressoPar';
import { VisualOrganico } from '../components/VisualOrganico';

const TRAVA_CLIQUE_MS = 400;
const SEGURAR_CANCELAR_MS = 2000;

// Tela 3 — Ciclo Experimental (6 pares: editada -> P1 -> original -> P2)
export function TelaCiclo({ estado }: { estado: Estado }) {
  const visao = visaoCiclo(estado);
  const [travaClique, setTravaClique] = useState<boolean>(false);
  const [modalCancelarAberto, setModalCancelarAberto] =
    useState<boolean>(false);

  const timerTravaRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const timerSegurarRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerTravaRef.current !== null) clearTimeout(timerTravaRef.current);
      if (timerSegurarRef.current !== null)
        clearTimeout(timerSegurarRef.current);
    };
  }, []);

  if (!visao || estado.fase !== 'ciclo') {
    return null;
  }

  const aplicarTrava400ms = () => {
    setTravaClique(true);
    if (timerTravaRef.current !== null) clearTimeout(timerTravaRef.current);
    timerTravaRef.current = setTimeout(() => {
      timerTravaRef.current = null;
      setTravaClique(false);
    }, TRAVA_CLIQUE_MS);
  };

  const handleResponder = (resposta: Resposta) => {
    if (travaClique || !visao.pergunta) return;
    aplicarTrava400ms();

    if (visao.pergunta.qual === 1) {
      sessionStore.dispatch({ tipo: 'RESPONDER_P1', resposta });
    } else {
      sessionStore.dispatch({
        tipo: 'RESPONDER_P2',
        resposta,
        agora: formatarDataHora(new Date()),
      });
    }
  };

  const handleOuvirNovamente = () => {
    if (travaClique) return;
    aplicarTrava400ms();
    sessionStore.dispatch({ tipo: 'OUVIR_NOVAMENTE' });
  };

  // Overlay de interrupção: chama retomarAudioNoGesto() SINCRONAMENTE e despacha RETOMAR sem await entre eles
  const handleRetomar = () => {
    void retomarAudioNoGesto();
    sessionStore.dispatch({ tipo: 'RETOMAR' });
  };

  // TODO etapa 8: remover quando o menu do operador existir
  const iniciarPressaoProgresso = () => {
    if (timerSegurarRef.current !== null) {
      clearTimeout(timerSegurarRef.current);
    }
    timerSegurarRef.current = setTimeout(() => {
      timerSegurarRef.current = null;
      setModalCancelarAberto(true);
    }, SEGURAR_CANCELAR_MS);
  };

  // TODO etapa 8: remover quando o menu do operador existir
  const cancelarPressaoProgresso = () => {
    if (timerSegurarRef.current !== null) {
      clearTimeout(timerSegurarRef.current);
      timerSegurarRef.current = null;
    }
  };

  return (
    <main class="tela-fluxo tela-ciclo">
      {/* Canto superior: ProgressoPar discreto (com gesto temporário de segurar por 2s para cancelar) */}
      <header class="tela-ciclo__top">
        <div
          class="tela-ciclo__progresso-touch"
          onPointerDown={iniciarPressaoProgresso}
          onPointerUp={cancelarPressaoProgresso}
          onPointerLeave={cancelarPressaoProgresso}
          onPointerCancel={cancelarPressaoProgresso}
        >
          <ProgressoPar atual={estado.par} total={6} />
        </div>
      </header>

      {/* Centro: VisualOrganico sempre presente + revelação de título/artista quando liberado */}
      <section class="tela-ciclo__centro">
        <VisualOrganico intensidade={visao.visual} />

        {visao.mostrarMusica && visao.titulo && (
          <div class="tela-ciclo__musica" aria-live="polite">
            <h1 class="tela-ciclo__musica-titulo">{visao.titulo}</h1>
            {visao.artista && (
              <p class="tela-ciclo__musica-artista">{visao.artista}</p>
            )}
          </div>
        )}
      </section>

      {/* Rodapé de pergunta e controles: NÃO estão no DOM enquanto não liberados */}
      <footer class="tela-ciclo__controles">
        {visao.pergunta && (
          <div
            class="tela-ciclo__bloco-pergunta"
            key={`pergunta-${estado.par}-${visao.pergunta.qual}`}
          >
            <h2 class="tela-ciclo__pergunta-texto">{visao.pergunta.texto}</h2>

            {visao.botoesResposta && (
              <div class="tela-ciclo__respostas">
                <Button
                  variant="primary"
                  fullWidth
                  disabled={travaClique}
                  onClick={() => handleResponder('Sim')}
                >
                  {STRINGS.botoes.sim}
                </Button>
                <Button
                  variant="primary"
                  fullWidth
                  disabled={travaClique}
                  onClick={() => handleResponder('Não')}
                >
                  {STRINGS.botoes.nao}
                </Button>
              </div>
            )}

            {visao.botaoOuvirNovamente && (
              <div class="tela-ciclo__replay">
                <Button
                  variant="secondary"
                  disabled={travaClique}
                  onClick={handleOuvirNovamente}
                >
                  {STRINGS.botoes.ouvirNovamente}
                </Button>
              </div>
            )}
          </div>
        )}
      </footer>

      {/* Overlay de interrupção quando o áudio para por evento externo */}
      {visao.overlayInterrompido && (
        <div
          class="ui-modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-label="Áudio interrompido"
        >
          <div class="ui-modal">
            <p class="ui-modal__message">O áudio foi interrompido.</p>
            <Button variant="primary" fullWidth onClick={handleRetomar}>
              Retomar
            </Button>
          </div>
        </div>
      )}

      {/* TODO etapa 8: remover quando o menu do operador existir */}
      <Modal
        aberto={modalCancelarAberto}
        mensagem="Cancelar sessão? Nada será gravado."
        rotuloConfirmar="Cancelar sessão"
        rotuloCancelar="Continuar"
        varianteConfirmar="danger"
        onConfirmar={() => {
          setModalCancelarAberto(false);
          sessionStore.dispatch({ tipo: 'CANCELAR' });
        }}
        onCancelar={() => setModalCancelarAberto(false)}
      />
    </main>
  );
}
