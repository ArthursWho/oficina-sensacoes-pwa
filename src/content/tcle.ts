// Termo de Consentimento Livre e Esclarecido (TCLE) estruturado e tipado

export interface PendenciasTcle {
  professoraNome: string;
  professoraEmail: string;
  representanteNome: string;
  representanteContato: string;
  enquadramentoEticoConfirmado: boolean;
}

export interface SecaoTcle {
  numero: number;
  titulo: string;
  paragrafos?: string[];
  itensNumerados?: string[];
  paragrafosPosLista?: string[];
  nota?: string;
}

export interface DocumentoTcle {
  titulo: string;
  subtitulos: string[];
  secoes: SecaoTcle[];
}

// Constantes pendentes que devem ser preenchidas antes da versão final da oficina
export const PENDENCIAS: PendenciasTcle = {
  professoraNome: '[nome da professora]',
  professoraEmail: '[e-mail institucional]',
  representanteNome: '[nome]',
  representanteContato: '[e-mail ou telefone]',
  enquadramentoEticoConfirmado: false,
};

const NOTA_ENQUADRAMENTO_PENDENTE =
  '[Confirmar o enquadramento com a professora responsável.]';

// Verifica se uma string ainda contém marcador pendente entre colchetes
function contemColchetes(valor: string): boolean {
  return /\[[^\]]+\]/.test(valor);
}

// Retorna a lista descritiva de pendências abertas no TCLE
export function listarPendencias(
  pendencias: PendenciasTcle = PENDENCIAS
): string[] {
  const lista: string[] = [];

  if (contemColchetes(pendencias.professoraNome)) {
    lista.push(`professoraNome: ${pendencias.professoraNome}`);
  }
  if (contemColchetes(pendencias.professoraEmail)) {
    lista.push(`professoraEmail: ${pendencias.professoraEmail}`);
  }
  if (contemColchetes(pendencias.representanteNome)) {
    lista.push(`representanteNome: ${pendencias.representanteNome}`);
  }
  if (contemColchetes(pendencias.representanteContato)) {
    lista.push(`representanteContato: ${pendencias.representanteContato}`);
  }
  if (!pendencias.enquadramentoEticoConfirmado) {
    lista.push(
      `enquadramentoEticoConfirmado: false (${NOTA_ENQUADRAMENTO_PENDENTE})`
    );
  }

  return lista;
}

// Retorna true se houver qualquer pendência textual entre colchetes ou se o enquadramento ético não estiver confirmado
export function temPendencias(
  pendencias: PendenciasTcle = PENDENCIAS
): boolean {
  return listarPendencias(pendencias).length > 0;
}

// Constrói o documento do TCLE preservando literalmente o texto especificado
export function construirTcle(
  pendencias: PendenciasTcle = PENDENCIAS
): DocumentoTcle {
  const baseSecao9 =
    'Por se tratar de uma atividade de ensino, sem finalidade de pesquisa científica, a oficina pode se enquadrar na exceção prevista na Resolução CNS nº 510/2016. Mesmo assim, o grupo mantém o anonimato, a participação voluntária e o uso dos dados restrito ao relatório da disciplina.';

  const paragrafoSecao9 = pendencias.enquadramentoEticoConfirmado
    ? baseSecao9
    : `${baseSecao9} ${NOTA_ENQUADRAMENTO_PENDENTE}`;

  return {
    titulo: 'Termo de Consentimento Livre e Esclarecido (TCLE)',
    subtitulos: [
      'Oficina de Sensações - O mundo a partir do útero',
      'Universidade da Região de Joinville - UNIVILLE | Curso: Psicologia - Noturno - 1º Semestre',
      'Disciplinas envolvidas: Estatística (Profa. Mariana), Embriologia e Genética (Profa. Valeria), Processos Básicos em Psicologia I (Profa. Luciana) e Psicologia: História, Escolas e Profissão I (Profa. Adelaide).',
      'Discentes responsáveis: Arthur Santos, Duainy Joaquim, João Sousa, Maria Eduarda Gaspar e Oswaldo Ferreira Neto',
      'Local: Bloco A, Sala 118',
    ],
    secoes: [
      {
        numero: 1,
        titulo: 'Convite',
        paragrafos: [
          'Você está sendo convidado(a) a participar, de forma voluntária, da atividade didática "Oficina de Sensações - O mundo a partir do útero", realizada por estudantes do 1º semestre do curso de Psicologia da Univille, como parte das disciplinas citadas acima.',
        ],
      },
      {
        numero: 2,
        titulo: 'Objetivo da oficina',
        paragrafos: [
          'Proporcionar uma experiência aproximada de como os sons chegam ao feto, com os sons graves preservados e os sons agudos atenuados, para discutir sensação, percepção, desenvolvimento embrionário, história da Psicologia e coleta de dados.',
          'A experiência é uma aproximação sensorial com fins didáticos e não representa uma reprodução fiel da acústica intrauterina.',
        ],
      },
      {
        numero: 3,
        titulo: 'Como será a sua participação',
        paragrafos: ['A atividade dura de 10 a 20 minutos. Você irá:'],
        itensNumerados: [
          'Ler este termo e decidir se deseja participar.',
          'Usar fones de ouvido em um ambiente com pouca luz, com um som grave e baixo nos intervalos, que simula batimentos cardíacos.',
          'Ouvir seis músicas conhecidas, uma de cada vez, sempre em dois momentos: primeiro uma versão editada (simulando a audição intrauterina) e, em seguida, a versão original sem filtro, com revelação do nome da música e do artista.',
          'Responder no aplicativo, após cada versão editada, se reconheceu a música (Sim ou Não); e, após cada versão original, se acertou qual era a música ou se ficou surpreso(a) com a resposta (Sim ou Não). Caso deseje, poderá ouvir novamente cada trecho ao final da reprodução, antes de responder.',
          'Participar de uma breve conversa final com o grupo sobre a experiência.',
        ],
      },
      {
        numero: 4,
        titulo: 'Dados coletados',
        paragrafos: [
          'Serão coletados no aplicativo apenas: se você reconheceu cada uma das seis músicas editadas (Sim ou Não), se acertou qual era a música ou se se surpreendeu ao ouvir a versão original (Sim ou Não) e quantas vezes optou por ouvir novamente cada faixa.',
          'O seu nome é solicitado apenas na tela deste termo e não é salvo nem associado às suas respostas na base de dados exportada. Não serão coletados CPF, e-mail ou qualquer dado que permita identificar você nas respostas do aplicativo.',
        ],
      },
      {
        numero: 5,
        titulo: 'Riscos e desconfortos',
        paragrafos: [
          'Os riscos são considerados mínimos. Os áudios serão reproduzidos em volume baixo a moderado, sem variações bruscas de intensidade. Ainda assim, podem ocorrer:',
        ],
        itensNumerados: [
          'Leve desconforto ao ouvir sons abafados ou graves.',
          'Estranhamento ou cansaço por permanecer em ambiente com pouca luz e umidificador ligado.',
          'Desconforto emocional, caso o tema (gestação e bebês) desperte lembranças ou sentimentos.',
        ],
        paragrafosPosLista: [
          'Se sentir qualquer desconforto, avise o condutor da atividade ou levante a mão. A atividade será interrompida imediatamente, sem qualquer prejuízo para você.',
        ],
      },
      {
        numero: 6,
        titulo: 'Benefícios',
        paragrafos: [
          'Não há benefício financeiro. O benefício é educativo: viver na prática como sensação e percepção se relacionam, aprender sobre a audição pré-natal e contribuir para o aprendizado dos estudantes.',
        ],
      },
      {
        numero: 7,
        titulo: 'Participação voluntária e liberdade de desistir',
        itensNumerados: [
          'A sua participação é totalmente voluntária.',
          'Você pode se recusar a participar, ou interromper a atividade a qualquer momento, sem dar explicações e sem nenhum prejuízo.',
          'Não há custo para participar nem pagamento pela participação.',
        ],
      },
      {
        numero: 8,
        titulo: 'Sigilo, anonimato e uso dos dados',
        itensNumerados: [
          'As respostas são anônimas e não serão associadas ao seu nome.',
          'Os dados serão usados apenas no relatório das disciplinas envolvidas, de forma agrupada.',
          'Os dados serão tratados conforme a Lei Geral de Proteção de Dados (Lei nº 13.709/2018).',
          'Por serem anonimizados, os dados já enviados não poderão ser individualizados e retirados depois do envio. Se você desistir antes de concluir, as respostas parciais não serão utilizadas.',
          'Este termo não vincula o seu nome aos dados coletados no aplicativo.',
        ],
      },
      {
        numero: 9,
        titulo: 'Enquadramento ético',
        paragrafos: [paragrafoSecao9],
      },
      {
        numero: 10,
        titulo: 'Contato',
        paragrafos: [
          'Em caso de dúvidas, procure qualquer integrante do grupo durante a atividade ou entre em contato com:',
        ],
        itensNumerados: [
          `Professor(a) responsável: ${pendencias.professoraNome} - ${pendencias.professoraEmail}`,
          `Representante do grupo: ${pendencias.representanteNome} - ${pendencias.representanteContato}`,
        ],
      },
      {
        numero: 11,
        titulo: 'Consentimento de participação',
        paragrafos: [
          'Declaro que li e compreendi as informações acima, tive a oportunidade de esclarecer minhas dúvidas, e concordo em participar da Oficina de Sensações, de forma voluntária.',
        ],
        nota: '(Obs.: se o participante for menor de 18 anos, o consentimento deve contar com autorização do responsável legal.)',
      },
      {
        numero: 12,
        titulo: 'Autorização para registro de fotos e vídeos (opcional)',
        paragrafos: [
          'Durante a oficina, o grupo poderá fazer fotos ou vídeos da atividade em andamento, exclusivamente para registro e para ilustrar o relatório e a apresentação das disciplinas. Essa autorização é opcional e independente da participação: você pode participar sem ser fotografado(a).',
          'Se você autorizar:',
        ],
        itensNumerados: [
          'As imagens serão usadas apenas em fins acadêmicos e didáticos da Univille, sem fins comerciais.',
          'Sempre que possível, o grupo evitará mostrar o seu rosto (por exemplo, fotos de costas, de mãos ou do ambiente).',
          'As imagens não serão associadas ao seu nome nem às suas respostas no aplicativo.',
          'Você pode revogar a autorização a qualquer momento, pedindo a exclusão das imagens ao grupo.',
        ],
      },
    ],
  };
}

// Instância padrão do TCLE exportada para consumo imediato
export const TCLE_DOCUMENTO: DocumentoTcle = construirTcle(PENDENCIAS);
