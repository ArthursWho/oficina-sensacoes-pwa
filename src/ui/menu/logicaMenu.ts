import { STRINGS } from '../../content/strings';
import { sessaoAtiva, sessaoNaoSalva } from '../../session/seletores';
import { Estado } from '../../session/tipos';

export type AcaoEngrenagem = 'abrir-menu' | 'pedir-confirmacao';

export interface InfoContagemMenu {
  totalSessoes: number;
  naoExportadas?: number;
}

export interface AcoesMenuDisponiveis {
  novoParticipante: {
    habilitado: boolean;
    exigeAvisoNaoSalva: boolean;
  };
  cancelarSessao: {
    habilitado: boolean;
  };
  exportar: {
    habilitado: boolean;
    motivo?: string;
  };
}

/**
 * Determina o que acontece ao tocar no ícone de engrenagem:
 * se houver sessão ativa (boas_vindas ou ciclo), exige confirmação; caso contrário abre o menu direto.
 */
export function aoTocarEngrenagem(estado: Estado): AcaoEngrenagem {
  return sessaoAtiva(estado) ? 'pedir-confirmacao' : 'abrir-menu';
}

/**
 * Calcula o estado de habilitação e avisos das ações do Menu do Operador.
 */
export function acoesMenu(
  estado: Estado,
  info: InfoContagemMenu
): AcoesMenuDisponiveis {
  const ativa = sessaoAtiva(estado);
  const naoSalva = sessaoNaoSalva(estado);
  const temSessoes = info.totalSessoes > 0;

  return {
    novoParticipante: {
      habilitado: true,
      exigeAvisoNaoSalva: naoSalva,
    },
    cancelarSessao: {
      habilitado: ativa,
    },
    exportar: {
      habilitado: temSessoes,
      ...(!temSessoes ? { motivo: STRINGS.semSessoes } : {}),
    },
  };
}
