import { ComponentType } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { sessionStore } from './session/store';
import { Estado } from './session/tipos';
import { ModoBuild } from './storage/nomesBanco';
import { MenuOperador } from './ui/menu/MenuOperador';
import { TelaBoasVindas } from './ui/telas/TelaBoasVindas';
import { TelaCiclo } from './ui/telas/TelaCiclo';
import { TelaEncerramento } from './ui/telas/TelaEncerramento';
import { TelaRecusa } from './ui/telas/TelaRecusa';
import { TelaTcle } from './ui/telas/TelaTcle';

export type RotaLab =
  | 'diagnostico'
  | 'componentes'
  | 'audio-lab'
  | 'sessao-lab'
  | 'armazenamento-lab'
  | 'compartilhar-lab'
  | null;

/**
 * Função pura que decide se o hash atual deve abrir uma rota de laboratório.
 * Em modo "producao", qualquer hash é ignorado e retorna sempre `null`.
 */
export function resolverRotaLaboratorio(
  hash: string,
  modoBuild: ModoBuild
): RotaLab {
  if (modoBuild === 'producao') {
    return null;
  }
  const limpo = hash.startsWith('#') ? hash.slice(1) : '';
  if (
    limpo === 'diagnostico' ||
    limpo === 'componentes' ||
    limpo === 'audio' + '-lab' ||
    limpo === 'sessao' + '-lab' ||
    limpo === 'armazenamento' + '-lab' ||
    limpo === 'compartilhar' + '-lab'
  ) {
    return limpo as RotaLab;
  }
  return null;
}

export function App() {
  const [hash, setHash] = useState<string>(() => window.location.hash);
  const [estado, setEstado] = useState<Estado>(() => sessionStore.getEstado());
  const [chaveSessao, setChaveSessao] = useState<number>(1);
  const [LabComp, setLabComp] = useState<ComponentType | null>(null);

  const rotaLab =
    import.meta.env.VITE_MODO !== 'producao'
      ? resolverRotaLaboratorio(hash, 'desenvolvimento')
      : null;

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

  // Quando o fluxo real entra em "cancelada" (fora de laboratório), despacha REINICIAR
  useEffect(() => {
    if (!rotaLab && estado.fase === 'cancelada') {
      sessionStore.dispatch({ tipo: 'REINICIAR' });
    }
  }, [estado.fase, rotaLab]);

  // Carregamento sob demanda dos laboratórios: eliminado pelo Rollup quando VITE_MODO === "producao"
  useEffect(() => {
    if (import.meta.env.VITE_MODO !== 'producao') {
      if (!rotaLab) {
        setLabComp(null);
        return;
      }

      let ativo = true;
      const carregarLab = async () => {
        let comp: ComponentType | null = null;
        if (rotaLab === 'diagnostico') {
          const m = await import('./ui/TelaDiagnostico');
          comp = m.TelaDiagnostico;
        } else if (rotaLab === 'componentes') {
          const m = await import('./ui/GaleriaComponentes');
          comp = m.GaleriaComponentes;
        } else if (rotaLab === 'audio-lab') {
          const m = await import('./audio/AudioLab');
          comp = m.AudioLab;
        } else if (rotaLab === 'sessao-lab') {
          const m = await import('./ui/SessaoLab');
          comp = m.SessaoLab;
        } else if (rotaLab === 'armazenamento-lab') {
          const m = await import('./ui/ArmazenamentoLab');
          comp = m.ArmazenamentoLab;
        } else if (rotaLab === 'compartilhar-lab') {
          const m = await import('./ui/CompartilharLab');
          comp = m.CompartilharLab;
        }
        if (ativo) {
          setLabComp(() => comp);
        }
      };

      void carregarLab();
      return () => {
        ativo = false;
      };
    }
  }, [rotaLab]);

  if (import.meta.env.VITE_MODO !== 'producao' && rotaLab && LabComp) {
    const ComponenteLaboratorio = LabComp;
    return <ComponenteLaboratorio />;
  }

  // Rota padrão (e qualquer hash em produção): fluxo principal renderizado a partir de estado.fase
  const renderizarFase = () => {
    switch (estado.fase) {
      case 'tcle':
      case 'cancelada':
        return <TelaTcle key={`fase-tcle-${chaveSessao}`} />;
      case 'recusado':
        return <TelaRecusa key="fase-recusado" />;
      case 'boas_vindas':
        return <TelaBoasVindas key="fase-boas-vindas" />;
      case 'ciclo':
        return <TelaCiclo key="fase-ciclo" estado={estado} />;
      case 'encerramento':
        return <TelaEncerramento key="fase-encerramento" estado={estado} />;
    }
  };

  return (
    <>
      <MenuOperador
        estado={estado}
        onRemontarTcle={() => setChaveSessao((c) => c + 1)}
      />
      <div class="app-screen-transition" key={`${estado.fase}-${chaveSessao}`}>
        {renderizarFase()}
      </div>
    </>
  );
}
