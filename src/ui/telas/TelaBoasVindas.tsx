import { useState } from 'preact/hooks';
import { STRINGS } from '../../content/strings';
import { sessionStore } from '../../session/store';
import { Button } from '../components/Button';

// Ícone SVG de Play para o botão "Iniciar"
function IconePlay() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <polygon points="6 3 20 12 6 21 6 3" />
    </svg>
  );
}

// Tela 2 — Boas-vindas (batimentos seguem tocando ao fundo)
export function TelaBoasVindas() {
  const [iniciando, setIniciando] = useState<boolean>(false);

  const handleIniciar = () => {
    if (iniciando) return;
    setIniciando(true);
    sessionStore.dispatch({ tipo: 'INICIAR' });
  };

  return (
    <main class="tela-fluxo tela-boas-vindas">
      <div class="tela-boas-vindas__content">
        <h1 class="tela-boas-vindas__frase">{STRINGS.tela2Frase}</h1>
        <div class="tela-boas-vindas__action">
          <Button
            variant="primary"
            icon={<IconePlay />}
            disabled={iniciando}
            onClick={handleIniciar}
          >
            {STRINGS.botoes.iniciar}
          </Button>
        </div>
      </div>
    </main>
  );
}
