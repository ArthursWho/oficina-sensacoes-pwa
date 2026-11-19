import { STRINGS } from '../../content/strings';
import { sessionStore } from '../../session/store';

// Tela de Recusa: visual calmo e acolhedor, sem gravar nenhum dado
export function TelaRecusa() {
  const handleVoltar = () => {
    sessionStore.dispatch({ tipo: 'REINICIAR' });
  };

  return (
    <main class="tela-fluxo tela-recusa">
      <div class="tela-recusa__card">
        <h1 class="tela-recusa__title">{STRINGS.recusa.titulo}</h1>
        <p class="tela-recusa__message">{STRINGS.recusa.mensagem}</p>
      </div>

      <button
        type="button"
        class="tela-recusa__back-btn"
        onClick={handleVoltar}
      >
        {STRINGS.voltarAoInicio}
      </button>
    </main>
  );
}
