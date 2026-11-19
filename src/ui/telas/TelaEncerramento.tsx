import { STRINGS } from '../../content/strings';
import { sessionStore } from '../../session/store';
import { Estado } from '../../session/tipos';
import { visaoEncerramento } from '../../session/visao';
import { Button } from '../components/Button';
import { VisualOrganico } from '../components/VisualOrganico';

// Tela 4 Real — Encerramento da experiência (batimentos voltam ao fundo, sem botões para o participante)
export function TelaEncerramento({ estado }: { estado: Estado }) {
  const visao = visaoEncerramento(estado);
  if (!visao) {
    return null;
  }

  return (
    <main class="tela-fluxo tela-encerramento">
      <VisualOrganico intensidade="calmo" par={6} />

      {/* Indicador discreto do operador no canto superior direito: aparece apenas quando status === "salvo" */}
      <header class="tela-encerramento__top">
        {visao.status === 'salvo' && (
          <span class="tela-encerramento__saved-badge" aria-live="polite">
            <span
              class="tela-tcle__audio-dot tela-tcle__audio-dot--pronto"
              aria-hidden="true"
            />
            <span>{STRINGS.sessaoSalva}</span>
          </span>
        )}
      </header>

      {/* Centro: mensagem acolhedora de agradecimento com fade-in ~500 ms */}
      <section class="tela-encerramento__centro">
        <div class="tela-encerramento__card">
          <h1 class="tela-encerramento__title">{STRINGS.encerramento.titulo}</h1>
          <p class="tela-encerramento__message">
            {STRINGS.encerramento.mensagem}
          </p>
        </div>
      </section>

      {/* Faixa inferior discreta em caso de falha na gravação */}
      <footer class="tela-encerramento__footer">
        {visao.mostrarTentarNovamente && (
          <div class="tela-encerramento__error-bar" role="alert">
            <span>{STRINGS.erroSalvar}</span>
            <Button
              variant="secondary"
              onClick={() =>
                sessionStore.dispatch({ tipo: 'TENTAR_PERSISTIR_NOVAMENTE' })
              }
            >
              {STRINGS.botaoTentarNovamente}
            </Button>
          </div>
        )}
      </footer>
    </main>
  );
}
