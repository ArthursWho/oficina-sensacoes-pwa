import { useEffect, useState } from 'preact/hooks';
import { AudioLab } from './audio/AudioLab';
import { sessionStore } from './session/store';
import { Estado } from './session/tipos';
import { GaleriaComponentes } from './ui/GaleriaComponentes';
import { SessaoLab } from './ui/SessaoLab';
import { TelaDiagnostico } from './ui/TelaDiagnostico';
import { TelaBoasVindas } from './ui/telas/TelaBoasVindas';
import {
  TelaCicloPlaceholder,
  TelaEncerramentoPlaceholder,
} from './ui/telas/TelaPlaceholders';
import { TelaRecusa } from './ui/telas/TelaRecusa';
import { TelaTcle } from './ui/telas/TelaTcle';

export function App() {
  const [hash, setHash] = useState<string>(() => window.location.hash);
  const [estado, setEstado] = useState<Estado>(() => sessionStore.getEstado());

  useEffect(() => {
    const onHashChange = () => setHash(window.location.hash);
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  useEffect(() => {
    const desassinar = sessionStore.assinar((novoEstado) => {
      setEstado(novoEstado);
    });
    return desassinar;
  }, []);

  // Quando o fluxo real entra em "cancelada" (fora do #sessao-lab), despacha REINICIAR de forma segura e sem laços
  useEffect(() => {
    if (hash !== '#sessao-lab' && estado.fase === 'cancelada') {
      sessionStore.dispatch({ tipo: 'REINICIAR' });
    }
  }, [estado.fase, hash]);

  // Rotas de ferramentas e diagnóstico por hash
  if (hash === '#diagnostico') {
    return <TelaDiagnostico />;
  }
  if (hash === '#componentes') {
    return <GaleriaComponentes />;
  }
  if (hash === '#audio-lab') {
    return <AudioLab />;
  }
  if (hash === '#sessao-lab') {
    return <SessaoLab />;
  }

  // Rota padrão (sem hash): fluxo principal renderizado a partir de estado.fase
  const renderizarFase = () => {
    switch (estado.fase) {
      case 'tcle':
      case 'cancelada':
        return <TelaTcle key="fase-tcle" />;
      case 'recusado':
        return <TelaRecusa key="fase-recusado" />;
      case 'boas_vindas':
        return <TelaBoasVindas key="fase-boas-vindas" />;
      case 'ciclo':
        return <TelaCicloPlaceholder key="fase-ciclo" estado={estado} />;
      case 'encerramento':
        return (
          <TelaEncerramentoPlaceholder
            key="fase-encerramento"
            estado={estado}
          />
        );
    }
  };

  return (
    <div class="app-screen-transition" key={estado.fase}>
      {renderizarFase()}
    </div>
  );
}
