import { sessionStore } from '../../session/store';
import { Estado } from '../../session/tipos';
import { Button } from '../components/Button';

// Placeholder provisório para a Tela 3 (Ciclo experimental — será implementada na Etapa 6)
export function TelaCicloPlaceholder({ estado }: { estado: Estado }) {
  const par = estado.fase === 'ciclo' ? estado.par : 0;
  const etapa = estado.fase === 'ciclo' ? estado.etapa.tipo : '—';

  return (
    <main class="tela-fluxo tela-placeholder">
      <div class="diag-container">
        <h1 class="diag-title">Ciclo experimental (Etapa 6)</h1>
        <p class="diag-subtitle">Tela provisória (placeholder)</p>
        <p>
          Fase: <strong>{estado.fase}</strong> | Par: <strong>{par} / 6</strong>{' '}
          | Etapa: <strong>{etapa}</strong>
        </p>
        <Button
          variant="danger"
          onClick={() => sessionStore.dispatch({ tipo: 'CANCELAR' })}
        >
          Cancelar (provisório)
        </Button>
      </div>
    </main>
  );
}

// Placeholder provisório para a Tela 4 (Encerramento — será implementada nas próximas etapas)
export function TelaEncerramentoPlaceholder({ estado }: { estado: Estado }) {
  return (
    <main class="tela-fluxo tela-placeholder">
      <div class="diag-container">
        <h1 class="diag-title">Encerramento (Placeholder)</h1>
        <p class="diag-subtitle">
          Fase atual: <strong>{estado.fase}</strong>
        </p>
        <Button
          variant="secondary"
          onClick={() =>
            sessionStore.dispatch({ tipo: 'REINICIAR', forcar: true })
          }
        >
          Reiniciar (provisório)
        </Button>
      </div>
    </main>
  );
}
