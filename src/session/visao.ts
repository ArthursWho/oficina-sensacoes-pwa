import { STRINGS } from '../content/strings';
import {
  botoes,
  faixaAtual,
  progresso,
  revelarMusica,
  textoPergunta2,
} from './seletores';
import { Estado } from './tipos';

export type IntensidadeVisual = 'ativo' | 'calmo' | 'apagado';

export interface PerguntaVisao {
  texto: string;
  qual: 1 | 2;
}

export interface VisaoCiclo {
  progresso: string;
  visual: IntensidadeVisual;
  mostrarMusica: boolean;
  titulo?: string;
  artista?: string;
  pergunta?: PerguntaVisao;
  botoesResposta: boolean;
  botaoOuvirNovamente: boolean;
  overlayInterrompido: boolean;
  bloqueioEntrada: boolean;
}

/**
 * Modelo de visão 100% puro para a Tela 3 (Ciclo Experimental).
 * Retorna null se o estado atual não estiver na fase "ciclo".
 */
export function visaoCiclo(estado: Estado): VisaoCiclo | null {
  if (estado.fase !== 'ciclo') {
    return null;
  }

  const prog = progresso(estado) ?? `${estado.par} / 6`;
  const track = faixaAtual(estado);
  const stBotoes = botoes(estado);
  const deveRevelar = revelarMusica(estado);
  const { etapa } = estado;

  // Etapa de transição entre pares: tudo apagado e entrada bloqueada
  if (etapa.tipo === 'transicao') {
    return {
      progresso: prog,
      visual: 'apagado',
      mostrarMusica: false,
      botoesResposta: false,
      botaoOuvirNovamente: false,
      overlayInterrompido: false,
      bloqueioEntrada: true,
    };
  }

  // Etapas de reprodução (editado_tocando ou original_tocando)
  if (
    etapa.tipo === 'editado_tocando' ||
    etapa.tipo === 'original_tocando'
  ) {
    const interrompido = etapa.interrompido;
    const mostrarMusica =
      etapa.tipo === 'original_tocando' && !interrompido ? true : etapa.tipo === 'original_tocando';

    return {
      progresso: prog,
      visual: interrompido ? 'calmo' : 'ativo',
      mostrarMusica,
      ...(mostrarMusica && track
        ? { titulo: track.titulo, artista: track.artista }
        : {}),
      botoesResposta: false,
      botaoOuvirNovamente: false,
      overlayInterrompido: interrompido,
      bloqueioEntrada: !interrompido,
    };
  }

  // Etapa p1_liberada: pergunta 1 e botão ouvir novamente
  if (etapa.tipo === 'p1_liberada') {
    return {
      progresso: prog,
      visual: 'calmo',
      mostrarMusica: false,
      pergunta: {
        texto: STRINGS.pergunta1,
        qual: 1,
      },
      botoesResposta: stBotoes.respostaP1,
      botaoOuvirNovamente: stBotoes.ouvirNovamente,
      overlayInterrompido: false,
      bloqueioEntrada: false,
    };
  }

  // Etapa p2_liberada: título/artista visíveis + pergunta 2 condicional + ouvir novamente
  const txtP2 = textoPergunta2(estado) ?? STRINGS.pergunta2Sim;
  return {
    progresso: prog,
    visual: 'calmo',
    mostrarMusica: deveRevelar,
    ...(deveRevelar && track
      ? { titulo: track.titulo, artista: track.artista }
      : {}),
    pergunta: {
      texto: txtP2,
      qual: 2,
    },
    botoesResposta: stBotoes.respostaP2,
    botaoOuvirNovamente: stBotoes.ouvirNovamente,
    overlayInterrompido: false,
    bloqueioEntrada: false,
  };
}
