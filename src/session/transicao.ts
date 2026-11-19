import { TRACKS } from '../content/tracks';
import { CONFIG_SESSAO_PADRAO, ConfigSessao } from './config';
import { Efeito, Estado, Evento, LinhaSessao, Resultado, SessaoConcluida } from './tipos';
import { formatarIdParticipante } from './utilidades';

function ignorar(estado: Estado): Resultado {
  return {
    estado,
    efeitos: [],
    ignorado: true,
  };
}

/**
 * Função redutora 100% pura da sessão experimental.
 * Não faz I/O, não usa Date/Math.random e nunca lança exceção.
 */
export function transicao(
  estado: Estado,
  evento: Evento,
  cfg: ConfigSessao = CONFIG_SESSAO_PADRAO
): Resultado {
  // 1. Tratamento global de REINICIAR conforme a fase atual
  if (evento.tipo === 'REINICIAR') {
    if (estado.fase === 'tcle') {
      return ignorar(estado);
    }
    if (estado.fase === 'recusado' || estado.fase === 'cancelada') {
      return {
        estado: { fase: 'tcle' },
        efeitos: [],
        ignorado: false,
      };
    }
    if (estado.fase === 'boas_vindas' || estado.fase === 'ciclo') {
      return {
        estado: { fase: 'tcle' },
        efeitos: [{ tipo: 'pararTudo' }],
        ignorado: false,
      };
    }
    if (estado.fase === 'encerramento') {
      if (estado.persistencia === 'ok' || evento.forcar === true) {
        return {
          estado: { fase: 'tcle' },
          efeitos: [{ tipo: 'pararTudo' }],
          ignorado: false,
        };
      }
      return ignorar(estado);
    }
  }

  // 2. Tratamento global de CANCELAR (válido apenas em boas_vindas e ciclo)
  if (evento.tipo === 'CANCELAR') {
    if (estado.fase === 'boas_vindas' || estado.fase === 'ciclo') {
      return {
        estado: { fase: 'cancelada' },
        efeitos: [{ tipo: 'pararTudo' }],
        ignorado: false,
      };
    }
    return ignorar(estado);
  }

  // 3. Transições a partir de "tcle"
  if (estado.fase === 'tcle') {
    if (evento.tipo === 'ACEITAR') {
      const idParticipante = formatarIdParticipante(evento.proximoNumero);
      return {
        estado: {
          fase: 'boas_vindas',
          sessao: {
            idParticipante,
            autorizaImagem: evento.autorizaImagem,
            linhas: [],
            epoca: 0,
            batimentosAudiveis: true,
          },
        },
        efeitos: [{ tipo: 'iniciarBatimentos' }],
        ignorado: false,
      };
    }

    if (evento.tipo === 'RECUSAR') {
      return {
        estado: { fase: 'recusado' },
        efeitos: [],
        ignorado: false,
      };
    }

    return ignorar(estado);
  }

  // 4. Transições a partir de "boas_vindas"
  if (estado.fase === 'boas_vindas') {
    if (evento.tipo === 'INICIAR') {
      const novaEpoca = estado.sessao.epoca + 1;
      const efeitos: Efeito[] = [];
      if (estado.sessao.batimentosAudiveis) {
        efeitos.push({ tipo: 'fadeOutBatimentos' });
      }
      efeitos.push({
        tipo: 'tocarFaixa',
        par: 1,
        versao: 'editado',
        epoca: novaEpoca,
      });

      return {
        estado: {
          fase: 'ciclo',
          sessao: {
            ...estado.sessao,
            epoca: novaEpoca,
            batimentosAudiveis: false,
          },
          par: 1,
          etapa: {
            tipo: 'editado_tocando',
            interrompido: false,
            repeticoesEditado: 0,
            repeticoesOriginal: 0,
          },
        },
        efeitos,
        ignorado: false,
      };
    }

    return ignorar(estado);
  }

  // 5. Transições a partir de "ciclo"
  if (estado.fase === 'ciclo') {
    const { sessao, par, etapa } = estado;

    // 5.1 Etapa: editado_tocando
    if (etapa.tipo === 'editado_tocando') {
      if (
        evento.tipo === 'AUDIO_EDITADO_FIM' &&
        evento.epoca === sessao.epoca &&
        !etapa.interrompido
      ) {
        return {
          estado: {
            ...estado,
            etapa: {
              tipo: 'p1_liberada',
              repeticoesEditado: etapa.repeticoesEditado,
              repeticoesOriginal: etapa.repeticoesOriginal,
            },
          },
          efeitos: [],
          ignorado: false,
        };
      }

      if (
        evento.tipo === 'AUDIO_INTERROMPIDO' &&
        evento.epoca === sessao.epoca &&
        !etapa.interrompido
      ) {
        return {
          estado: {
            ...estado,
            etapa: {
              ...etapa,
              interrompido: true,
            },
          },
          efeitos: [],
          ignorado: false,
        };
      }

      if (evento.tipo === 'RETOMAR' && etapa.interrompido) {
        const novaEpoca = sessao.epoca + 1;
        return {
          estado: {
            ...estado,
            sessao: {
              ...sessao,
              epoca: novaEpoca,
            },
            etapa: {
              ...etapa,
              interrompido: false,
            },
          },
          efeitos: [
            {
              tipo: 'tocarFaixa',
              par,
              versao: 'editado',
              epoca: novaEpoca,
            },
          ],
          ignorado: false,
        };
      }

      return ignorar(estado);
    }

    // 5.2 Etapa: p1_liberada
    if (etapa.tipo === 'p1_liberada') {
      if (evento.tipo === 'OUVIR_NOVAMENTE') {
        const novaEpoca = sessao.epoca + 1;
        return {
          estado: {
            ...estado,
            sessao: {
              ...sessao,
              epoca: novaEpoca,
            },
            etapa: {
              tipo: 'editado_tocando',
              interrompido: false,
              repeticoesEditado: etapa.repeticoesEditado + 1,
              repeticoesOriginal: etapa.repeticoesOriginal,
            },
          },
          efeitos: [
            {
              tipo: 'tocarFaixa',
              par,
              versao: 'editado',
              epoca: novaEpoca,
            },
          ],
          ignorado: false,
        };
      }

      if (evento.tipo === 'RESPONDER_P1') {
        const novaEpoca = sessao.epoca + 1;
        return {
          estado: {
            ...estado,
            sessao: {
              ...sessao,
              epoca: novaEpoca,
            },
            etapa: {
              tipo: 'original_tocando',
              reconheceu: evento.resposta,
              interrompido: false,
              repeticoesEditado: etapa.repeticoesEditado,
              repeticoesOriginal: etapa.repeticoesOriginal,
            },
          },
          efeitos: [
            {
              tipo: 'tocarFaixa',
              par,
              versao: 'original',
              epoca: novaEpoca,
            },
          ],
          ignorado: false,
        };
      }

      return ignorar(estado);
    }

    // 5.3 Etapa: original_tocando
    if (etapa.tipo === 'original_tocando') {
      if (
        evento.tipo === 'AUDIO_ORIGINAL_FIM' &&
        evento.epoca === sessao.epoca &&
        !etapa.interrompido
      ) {
        const efeitos: Efeito[] = [];
        let batimentosAudiveis = sessao.batimentosAudiveis;

        if (cfg.BATIMENTOS_VOLTAM_NOS_INTERVALOS) {
          efeitos.push({ tipo: 'fadeInBatimentos' });
          batimentosAudiveis = true;
        }

        return {
          estado: {
            ...estado,
            sessao: {
              ...sessao,
              batimentosAudiveis,
            },
            etapa: {
              tipo: 'p2_liberada',
              reconheceu: etapa.reconheceu,
              repeticoesEditado: etapa.repeticoesEditado,
              repeticoesOriginal: etapa.repeticoesOriginal,
            },
          },
          efeitos,
          ignorado: false,
        };
      }

      if (
        evento.tipo === 'AUDIO_INTERROMPIDO' &&
        evento.epoca === sessao.epoca &&
        !etapa.interrompido
      ) {
        return {
          estado: {
            ...estado,
            etapa: {
              ...etapa,
              interrompido: true,
            },
          },
          efeitos: [],
          ignorado: false,
        };
      }

      if (evento.tipo === 'RETOMAR' && etapa.interrompido) {
        const novaEpoca = sessao.epoca + 1;
        return {
          estado: {
            ...estado,
            sessao: {
              ...sessao,
              epoca: novaEpoca,
            },
            etapa: {
              ...etapa,
              interrompido: false,
            },
          },
          efeitos: [
            {
              tipo: 'tocarFaixa',
              par,
              versao: 'original',
              epoca: novaEpoca,
            },
          ],
          ignorado: false,
        };
      }

      return ignorar(estado);
    }

    // 5.4 Etapa: p2_liberada
    if (etapa.tipo === 'p2_liberada') {
      if (evento.tipo === 'OUVIR_NOVAMENTE') {
        const novaEpoca = sessao.epoca + 1;
        const efeitos: Efeito[] = [];
        if (sessao.batimentosAudiveis) {
          efeitos.push({ tipo: 'fadeOutBatimentos' });
        }
        efeitos.push({
          tipo: 'tocarFaixa',
          par,
          versao: 'original',
          epoca: novaEpoca,
        });

        return {
          estado: {
            ...estado,
            sessao: {
              ...sessao,
              epoca: novaEpoca,
              batimentosAudiveis: false,
            },
            etapa: {
              tipo: 'original_tocando',
              reconheceu: etapa.reconheceu,
              interrompido: false,
              repeticoesEditado: etapa.repeticoesEditado,
              repeticoesOriginal: etapa.repeticoesOriginal + 1,
            },
          },
          efeitos,
          ignorado: false,
        };
      }

      if (evento.tipo === 'RESPONDER_P2') {
        const track = TRACKS[par - 1];
        const novaLinha: LinhaSessao = {
          id_participante: sessao.idParticipante,
          data_hora: evento.agora,
          ordem_musica: par,
          musica: track ? track.rotulo : '',
          reconheceu: etapa.reconheceu,
          tipo_pergunta_2:
            etapa.reconheceu === 'Sim' ? 'Acertou' : 'Surpreendeu',
          resposta_pergunta_2: evento.resposta,
          repeticoes_editado: etapa.repeticoesEditado,
          repeticoes_original: etapa.repeticoesOriginal,
        };

        const novasLinhas = [...sessao.linhas, novaLinha];

        if (par < cfg.TOTAL_PARES) {
          return {
            estado: {
              ...estado,
              sessao: {
                ...sessao,
                linhas: novasLinhas,
              },
              etapa: {
                tipo: 'transicao',
              },
            },
            efeitos: [
              {
                tipo: 'agendarTransicao',
                ms: cfg.TRANSICAO_PAR_MS,
              },
            ],
            ignorado: false,
          };
        }

        // par === TOTAL_PARES: vai para encerramento e emite persistirSessao
        const concluida: SessaoConcluida = {
          id_participante: sessao.idParticipante,
          linhas: novasLinhas,
        };

        const efeitos: Efeito[] = [];
        if (!sessao.batimentosAudiveis) {
          efeitos.push({ tipo: 'fadeInBatimentos' });
        }
        efeitos.push({
          tipo: 'persistirSessao',
          sessao: concluida,
        });

        return {
          estado: {
            fase: 'encerramento',
            sessao: {
              ...sessao,
              linhas: novasLinhas,
              batimentosAudiveis: true,
            },
            concluida,
            persistencia: 'pendente',
          },
          efeitos,
          ignorado: false,
        };
      }

      return ignorar(estado);
    }

    // 5.5 Etapa: transicao
    if (etapa.tipo === 'transicao') {
      if (evento.tipo === 'TRANSICAO_FIM' && par < cfg.TOTAL_PARES) {
        const proximoPar = par + 1;
        const novaEpoca = sessao.epoca + 1;
        const efeitos: Efeito[] = [];

        if (sessao.batimentosAudiveis) {
          efeitos.push({ tipo: 'fadeOutBatimentos' });
        }
        efeitos.push({
          tipo: 'tocarFaixa',
          par: proximoPar,
          versao: 'editado',
          epoca: novaEpoca,
        });

        return {
          estado: {
            fase: 'ciclo',
            sessao: {
              ...sessao,
              epoca: novaEpoca,
              batimentosAudiveis: false,
            },
            par: proximoPar,
            etapa: {
              tipo: 'editado_tocando',
              interrompido: false,
              repeticoesEditado: 0,
              repeticoesOriginal: 0,
            },
          },
          efeitos,
          ignorado: false,
        };
      }

      return ignorar(estado);
    }
  }

  // 6. Transições a partir de "encerramento"
  if (estado.fase === 'encerramento') {
    if (
      evento.tipo === 'PERSISTENCIA_OK' &&
      estado.persistencia !== 'ok'
    ) {
      return {
        estado: {
          ...estado,
          persistencia: 'ok',
        },
        efeitos: [],
        ignorado: false,
      };
    }

    if (
      evento.tipo === 'PERSISTENCIA_FALHA' &&
      estado.persistencia !== 'ok'
    ) {
      return {
        estado: {
          ...estado,
          persistencia: 'falha',
        },
        efeitos: [],
        ignorado: false,
      };
    }

    if (
      evento.tipo === 'TENTAR_PERSISTIR_NOVAMENTE' &&
      estado.persistencia === 'falha'
    ) {
      return {
        estado: {
          ...estado,
          persistencia: 'pendente',
        },
        efeitos: [
          {
            tipo: 'persistirSessao',
            sessao: estado.concluida,
          },
        ],
        ignorado: false,
      };
    }

    return ignorar(estado);
  }

  // Qualquer outra combinação (ex.: recusado/cancelada com evento diferente de REINICIAR)
  return ignorar(estado);
}
