// Tipagens estritas da máquina de estados da sessão (sem I/O, sem `any`)

export type Resposta = 'Sim' | 'Não';

export type ImagemAutorizacao = 'autoriza' | 'nao-autoriza' | null;

export type TipoPergunta2 = 'Acertou' | 'Surpreendeu';

export type StatusPersistencia = 'pendente' | 'ok' | 'falha';

// Linha individual correspondente às 9 colunas exatas da exportação futura
export interface LinhaSessao {
  id_participante: string;
  data_hora: string;
  ordem_musica: number;
  musica: string;
  reconheceu: Resposta;
  tipo_pergunta_2: TipoPergunta2;
  resposta_pergunta_2: Resposta;
  repeticoes_editado: number;
  repeticoes_original: number;
}

// Sessão finalizada pronta para persistência (sem nome e sem autorização de imagem)
export interface SessaoConcluida {
  id_participante: string;
  linhas: LinhaSessao[];
}

// Dados em memória durante uma sessão ativa
export interface DadosSessaoAtiva {
  idParticipante: string;
  autorizaImagem: ImagemAutorizacao;
  linhas: LinhaSessao[];
  epoca: number;
  batimentosAudiveis: boolean;
}

// Sub-etapas dentro de cada par do ciclo (1..6)
export type EtapaPar =
  | {
      tipo: 'editado_tocando';
      interrompido: boolean;
      repeticoesEditado: number;
      repeticoesOriginal: number;
    }
  | {
      tipo: 'p1_liberada';
      repeticoesEditado: number;
      repeticoesOriginal: number;
    }
  | {
      tipo: 'original_tocando';
      reconheceu: Resposta;
      interrompido: boolean;
      repeticoesEditado: number;
      repeticoesOriginal: number;
    }
  | {
      tipo: 'p2_liberada';
      reconheceu: Resposta;
      repeticoesEditado: number;
      repeticoesOriginal: number;
    }
  | {
      tipo: 'transicao';
    };

// Estado global da sessão (união discriminada por `fase`)
export type Estado =
  | { fase: 'tcle' }
  | { fase: 'recusado' }
  | { fase: 'cancelada' }
  | { fase: 'boas_vindas'; sessao: DadosSessaoAtiva }
  | {
      fase: 'ciclo';
      sessao: DadosSessaoAtiva;
      par: number;
      etapa: EtapaPar;
    }
  | {
      fase: 'encerramento';
      sessao: DadosSessaoAtiva;
      concluida: SessaoConcluida;
      persistencia: StatusPersistencia;
    };

// Eventos aceitos pela função redutora pura (união discriminada por `tipo`)
export type Evento =
  | {
      tipo: 'ACEITAR';
      proximoNumero: number;
      autorizaImagem: ImagemAutorizacao;
    }
  | { tipo: 'RECUSAR' }
  | { tipo: 'INICIAR' }
  | { tipo: 'AUDIO_EDITADO_FIM'; epoca: number }
  | { tipo: 'AUDIO_ORIGINAL_FIM'; epoca: number }
  | { tipo: 'AUDIO_INTERROMPIDO'; epoca: number }
  | { tipo: 'RETOMAR' }
  | { tipo: 'OUVIR_NOVAMENTE' }
  | { tipo: 'RESPONDER_P1'; resposta: Resposta }
  | { tipo: 'RESPONDER_P2'; resposta: Resposta; agora: string }
  | { tipo: 'TRANSICAO_FIM' }
  | { tipo: 'PERSISTENCIA_OK' }
  | { tipo: 'PERSISTENCIA_FALHA' }
  | { tipo: 'TENTAR_PERSISTIR_NOVAMENTE' }
  | { tipo: 'CANCELAR' }
  | { tipo: 'REINICIAR'; forcar?: boolean };

// Efeitos declarativos (dados puros) a serem executados pelo controlador externo
export type Efeito =
  | { tipo: 'iniciarBatimentos' }
  | { tipo: 'fadeOutBatimentos' }
  | { tipo: 'fadeInBatimentos' }
  | {
      tipo: 'tocarFaixa';
      par: number;
      versao: 'editado' | 'original';
      epoca: number;
    }
  | { tipo: 'pararTudo' }
  | { tipo: 'agendarTransicao'; ms: number }
  | { tipo: 'persistirSessao'; sessao: SessaoConcluida };

// Retorno da função redutora pura `transicao`
export interface Resultado {
  estado: Estado;
  efeitos: Efeito[];
  ignorado: boolean;
}
