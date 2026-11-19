import { useEffect, useRef, useState } from 'preact/hooks';
import { houveLiberacao, tocarEfeito } from '../../audio/efeitosUi';
import { STRINGS } from '../../content/strings';
import { retomarAudioNoGesto } from '../../session/controlador';
import { sessionStore } from '../../session/store';
import { Estado, Resposta } from '../../session/tipos';
import { formatarDataHora } from '../../session/utilidades';
import { visaoCiclo, VisaoCiclo } from '../../session/visao';
import { Button } from '../components/Button';
import { ProgressoPar } from '../components/ProgressoPar';
import { VisualOrganico } from '../components/VisualOrganico';

const TRAVA_CLIQUE_MS = 400;

// Tela 3 — Ciclo Experimental (6 pares: editada -> P1 -> original -> P2)
export function TelaCiclo({ estado }: { estado: Estado }) {
  const visao = visaoCiclo(estado);
  const [travaClique, setTravaClique] = useState<boolean>(false);

  const timerTravaRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const visaoAnteriorRef = useRef<VisaoCiclo | null>(null);

  useEffect(() => {
    if (houveLiberacao(visaoAnteriorRef.current, visao)) {
      tocarEfeito('liberado');
    }
    visaoAnteriorRef.current = visao;
  }, [visao]);

  useEffect(() => {
    return () => {
      if (timerTravaRef.current !== null) clearTimeout(timerTravaRef.current);
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

  return (
    <main class="tela-fluxo tela-ciclo">
      {/* VisualOrganico v2 em tela cheia atrás do conteúdo com tonalidade do par atual */}
      <VisualOrganico intensidade={visao.visual} par={estado.par} />

      {/* Canto superior direito: ProgressoPar discreto */}
      <header class="tela-ciclo__top">
        <ProgressoPar atual={estado.par} total={6} />
      </header>

      {/* Centro: revelação de título/artista quando liberado */}
      <section class="tela-ciclo__centro">
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
    </main>
  );
}
