import { describe, expect, it } from 'vitest';
import { STRINGS } from '../content/strings';
import { TRACKS } from '../content/tracks';
import { CONFIG_SESSAO_PADRAO, ConfigSessao, TOTAL_PARES } from './config';
import {
  botoes,
  faixaAtual,
  progresso,
  revelarMusica,
  sessaoAtiva,
  sessaoNaoSalva,
  textoPergunta2,
} from './seletores';
import { criarSessionStore } from './store';
import { Efeito, Estado, Evento, Resposta, SessaoConcluida } from './tipos';
import { transicao } from './transicao';
import {
  formatarDataHora,
  formatarIdParticipante,
  validarSessao,
} from './utilidades';

const AGORA_FIXO = '2026-11-19 00:45:00';

// Helper para extrair a época atual do estado
function epocaDe(estado: Estado): number {
  if (
    estado.fase === 'boas_vindas' ||
    estado.fase === 'ciclo' ||
    estado.fase === 'encerramento'
  ) {
    return estado.sessao.epoca;
  }
  return 0;
}

// Helper para rodar uma sessão completa de 6 pares
function rodarSessaoCompleta(
  respostas: Array<{
    p1: Resposta;
    p2: Resposta;
    repEd?: number;
    repOr?: number;
  }>,
  cfg: ConfigSessao = CONFIG_SESSAO_PADRAO
): {
  estadoFinal: Estado;
  todosEstados: Estado[];
  todosEfeitos: Efeito[];
} {
  let estado: Estado = { fase: 'tcle' };
  const todosEstados: Estado[] = [estado];
  const todosEfeitos: Efeito[] = [];

  const aplicar = (ev: Evento) => {
    const res = transicao(estado, ev, cfg);
    expect(res.ignorado).toBe(false);
    estado = res.estado;
    todosEstados.push(estado);
    todosEfeitos.push(...res.efeitos);
    return res;
  };

  aplicar({ tipo: 'ACEITAR', proximoNumero: 1, autorizaImagem: 'autoriza' });
  aplicar({ tipo: 'INICIAR' });

  for (let i = 0; i < TOTAL_PARES; i++) {
    const r = respostas[i];
    aplicar({ tipo: 'AUDIO_EDITADO_FIM', epoca: epocaDe(estado) });

    for (let k = 0; k < (r.repEd ?? 0); k++) {
      aplicar({ tipo: 'OUVIR_NOVAMENTE' });
      aplicar({ tipo: 'AUDIO_EDITADO_FIM', epoca: epocaDe(estado) });
    }

    aplicar({ tipo: 'RESPONDER_P1', resposta: r.p1 });
    aplicar({ tipo: 'AUDIO_ORIGINAL_FIM', epoca: epocaDe(estado) });

    for (let k = 0; k < (r.repOr ?? 0); k++) {
      aplicar({ tipo: 'OUVIR_NOVAMENTE' });
      aplicar({ tipo: 'AUDIO_ORIGINAL_FIM', epoca: epocaDe(estado) });
    }

    aplicar({ tipo: 'RESPONDER_P2', resposta: r.p2, agora: AGORA_FIXO });

    if (i < TOTAL_PARES - 1) {
      aplicar({ tipo: 'TRANSICAO_FIM' });
    }
  }

  return { estadoFinal: estado, todosEstados, todosEfeitos };
}

describe('src/session/ — Máquina de Estados da Sessão (Etapa 4)', () => {
  it('a) caminho feliz com "Sim" em tudo: 6 linhas, tipo_pergunta_2 = "Acertou", persistirSessao emitido 1x e passa em validarSessao', () => {
    const respostas = Array.from({ length: 6 }, () => ({
      p1: 'Sim' as Resposta,
      p2: 'Sim' as Resposta,
    }));

    const { estadoFinal, todosEfeitos } = rodarSessaoCompleta(respostas);
    expect(estadoFinal.fase).toBe('encerramento');
    if (estadoFinal.fase !== 'encerramento') return;

    expect(estadoFinal.concluida.linhas).toHaveLength(6);
    for (const linha of estadoFinal.concluida.linhas) {
      expect(linha.reconheceu).toBe('Sim');
      expect(linha.tipo_pergunta_2).toBe('Acertou');
      expect(linha.resposta_pergunta_2).toBe('Sim');
    }

    const efeitosPersistir = todosEfeitos.filter(
      (e) => e.tipo === 'persistirSessao'
    );
    expect(efeitosPersistir).toHaveLength(1);

    const validacao = validarSessao(estadoFinal.concluida);
    expect(validacao.ok).toBe(true);
    expect(validacao.erros).toEqual([]);
  });

  it('b) caminho com "Não" em tudo: tipo_pergunta_2 = "Surpreendeu"', () => {
    const respostas = Array.from({ length: 6 }, () => ({
      p1: 'Não' as Resposta,
      p2: 'Não' as Resposta,
    }));

    const { estadoFinal } = rodarSessaoCompleta(respostas);
    expect(estadoFinal.fase).toBe('encerramento');
    if (estadoFinal.fase !== 'encerramento') return;

    for (const linha of estadoFinal.concluida.linhas) {
      expect(linha.reconheceu).toBe('Não');
      expect(linha.tipo_pergunta_2).toBe('Surpreendeu');
      expect(linha.resposta_pergunta_2).toBe('Não');
    }
    expect(validarSessao(estadoFinal.concluida).ok).toBe(true);
  });

  it('c) mistura de respostas: ordem, rótulos (com travessão) e colunas corretos nas 6 linhas', () => {
    const respostas: Array<{ p1: Resposta; p2: Resposta }> = [
      { p1: 'Sim', p2: 'Sim' },
      { p1: 'Não', p2: 'Sim' },
      { p1: 'Sim', p2: 'Não' },
      { p1: 'Não', p2: 'Não' },
      { p1: 'Sim', p2: 'Sim' },
      { p1: 'Não', p2: 'Sim' },
    ];

    const { estadoFinal } = rodarSessaoCompleta(respostas);
    expect(estadoFinal.fase).toBe('encerramento');
    if (estadoFinal.fase !== 'encerramento') return;

    estadoFinal.concluida.linhas.forEach((linha, idx) => {
      expect(linha.ordem_musica).toBe(idx + 1);
      expect(linha.musica).toBe(TRACKS[idx].rotulo);
      expect(linha.musica).toContain(' — ');
      expect(linha.reconheceu).toBe(respostas[idx].p1);
      expect(linha.tipo_pergunta_2).toBe(
        respostas[idx].p1 === 'Sim' ? 'Acertou' : 'Surpreendeu'
      );
      expect(linha.resposta_pergunta_2).toBe(respostas[idx].p2);
    });
  });

  it('d) repetições por par: contadas separadamente (editado/original) e zeradas ao iniciar o próximo par', () => {
    const respostas = [
      { p1: 'Sim' as Resposta, p2: 'Sim' as Resposta, repEd: 2, repOr: 1 },
      { p1: 'Não' as Resposta, p2: 'Sim' as Resposta, repEd: 0, repOr: 3 },
      { p1: 'Sim' as Resposta, p2: 'Não' as Resposta, repEd: 1, repOr: 0 },
      { p1: 'Sim' as Resposta, p2: 'Sim' as Resposta, repEd: 0, repOr: 0 },
      { p1: 'Não' as Resposta, p2: 'Não' as Resposta, repEd: 4, repOr: 2 },
      { p1: 'Sim' as Resposta, p2: 'Sim' as Resposta, repEd: 0, repOr: 0 },
    ];

    const { estadoFinal } = rodarSessaoCompleta(respostas);
    expect(estadoFinal.fase).toBe('encerramento');
    if (estadoFinal.fase !== 'encerramento') return;

    const linhas = estadoFinal.concluida.linhas;
    expect(linhas[0].repeticoes_editado).toBe(2);
    expect(linhas[0].repeticoes_original).toBe(1);
    expect(linhas[1].repeticoes_editado).toBe(0);
    expect(linhas[1].repeticoes_original).toBe(3);
    expect(linhas[2].repeticoes_editado).toBe(1);
    expect(linhas[2].repeticoes_original).toBe(0);
    expect(linhas[3].repeticoes_editado).toBe(0);
    expect(linhas[3].repeticoes_original).toBe(0);
    expect(linhas[4].repeticoes_editado).toBe(4);
    expect(linhas[4].repeticoes_original).toBe(2);
  });

  it('e) eventos fora de hora são ignorados: mesmo estado, efeitos [] e ignorado true', () => {
    let st: Estado = { fase: 'tcle' };
    st = transicao(st, {
      tipo: 'ACEITAR',
      proximoNumero: 1,
      autorizaImagem: null,
    }).estado;
    st = transicao(st, { tipo: 'INICIAR' }).estado;

    // 1. RESPONDER_P1 durante editado_tocando
    const r1 = transicao(st, { tipo: 'RESPONDER_P1', resposta: 'Sim' });
    expect(r1.ignorado).toBe(true);
    expect(r1.efeitos).toEqual([]);
    expect(r1.estado).toBe(st);

    // 2. OUVIR_NOVAMENTE durante a reprodução (editado_tocando)
    const r2 = transicao(st, { tipo: 'OUVIR_NOVAMENTE' });
    expect(r2.ignorado).toBe(true);
    expect(r2.efeitos).toEqual([]);
    expect(r2.estado).toBe(st);

    // Termina o áudio editado -> p1_liberada
    st = transicao(st, { tipo: 'AUDIO_EDITADO_FIM', epoca: epocaDe(st) }).estado;

    // 3. AUDIO_EDITADO_FIM duplicado em p1_liberada
    const r3 = transicao(st, { tipo: 'AUDIO_EDITADO_FIM', epoca: epocaDe(st) });
    expect(r3.ignorado).toBe(true);
    expect(r3.efeitos).toEqual([]);
    expect(r3.estado).toBe(st);

    // Responde P1 -> original_tocando
    st = transicao(st, { tipo: 'RESPONDER_P1', resposta: 'Sim' }).estado;

    // 4. RESPONDER_P1 duas vezes seguidas
    const r4 = transicao(st, { tipo: 'RESPONDER_P1', resposta: 'Não' });
    expect(r4.ignorado).toBe(true);
    expect(r4.efeitos).toEqual([]);
    expect(r4.estado).toBe(st);

    // 5. RESPONDER_P2 antes do fim do original
    const r5 = transicao(st, {
      tipo: 'RESPONDER_P2',
      resposta: 'Sim',
      agora: AGORA_FIXO,
    });
    expect(r5.ignorado).toBe(true);
    expect(r5.efeitos).toEqual([]);
    expect(r5.estado).toBe(st);
  });

  it('e2) épocas: eventos de áudio com época antiga são ignorados; após OUVIR_NOVAMENTE a época avança e o fim da faixa antiga não destrava o par', () => {
    let st: Estado = { fase: 'tcle' };
    st = transicao(st, {
      tipo: 'ACEITAR',
      proximoNumero: 1,
      autorizaImagem: null,
    }).estado;
    st = transicao(st, { tipo: 'INICIAR' }).estado; // época = 1

    // Evento com época errada (0 ou 99) é ignorado
    expect(
      transicao(st, { tipo: 'AUDIO_EDITADO_FIM', epoca: 0 }).ignorado
    ).toBe(true);
    expect(
      transicao(st, { tipo: 'AUDIO_INTERROMPIDO', epoca: 99 }).ignorado
    ).toBe(true);

    // Conclui época 1 -> p1_liberada
    st = transicao(st, { tipo: 'AUDIO_EDITADO_FIM', epoca: 1 }).estado;

    // Clica em OUVIR_NOVAMENTE -> avança para época 2 (editado_tocando)
    st = transicao(st, { tipo: 'OUVIR_NOVAMENTE' }).estado;
    expect(epocaDe(st)).toBe(2);

    // Fim atrasado da época 1 não pode destravar o par
    const atrasado = transicao(st, { tipo: 'AUDIO_EDITADO_FIM', epoca: 1 });
    expect(atrasado.ignorado).toBe(true);
    expect(atrasado.estado).toBe(st);

    // Somente época 2 destrava
    const correto = transicao(st, { tipo: 'AUDIO_EDITADO_FIM', epoca: 2 });
    expect(correto.ignorado).toBe(false);
    expect(
      correto.estado.fase === 'ciclo' && correto.estado.etapa.tipo
    ).toBe('p1_liberada');
  });

  it('f) interrupção: AUDIO_INTERROMPIDO + RETOMAR reemite tocarFaixa com nova época e NÃO soma repetição', () => {
    let st: Estado = { fase: 'tcle' };
    st = transicao(st, {
      tipo: 'ACEITAR',
      proximoNumero: 1,
      autorizaImagem: null,
    }).estado;
    st = transicao(st, { tipo: 'INICIAR' }).estado; // época 1

    // Interrompe faixa editada
    const int1 = transicao(st, { tipo: 'AUDIO_INTERROMPIDO', epoca: 1 });
    expect(int1.ignorado).toBe(false);
    expect(int1.efeitos).toEqual([]);
    st = int1.estado;

    // Retoma faixa editada -> época 2, repeticoesEditado continua 0
    const ret1 = transicao(st, { tipo: 'RETOMAR' });
    expect(ret1.ignorado).toBe(false);
    expect(ret1.efeitos).toEqual([
      { tipo: 'tocarFaixa', par: 1, versao: 'editado', epoca: 2 },
    ]);
    st = ret1.estado;

    // Agora termina época 2, usuário pede 1 repetição voluntária -> época 3
    st = transicao(st, { tipo: 'AUDIO_EDITADO_FIM', epoca: 2 }).estado;
    st = transicao(st, { tipo: 'OUVIR_NOVAMENTE' }).estado;
    st = transicao(st, { tipo: 'AUDIO_EDITADO_FIM', epoca: 3 }).estado;

    // Responde P1 -> original_tocando (época 4)
    st = transicao(st, { tipo: 'RESPONDER_P1', resposta: 'Sim' }).estado;

    // Interrompe e retoma o original -> época 5, repeticoesOriginal continua 0
    st = transicao(st, { tipo: 'AUDIO_INTERROMPIDO', epoca: 4 }).estado;
    const ret2 = transicao(st, { tipo: 'RETOMAR' });
    expect(ret2.efeitos).toEqual([
      { tipo: 'tocarFaixa', par: 1, versao: 'original', epoca: 5 },
    ]);
    st = ret2.estado;

    st = transicao(st, { tipo: 'AUDIO_ORIGINAL_FIM', epoca: 5 }).estado;
    st = transicao(st, {
      tipo: 'RESPONDER_P2',
      resposta: 'Sim',
      agora: AGORA_FIXO,
    }).estado;

    expect(st.fase).toBe('ciclo');
    if (st.fase !== 'ciclo') return;
    // Deve registrar apenas a 1 repetição voluntária do editado e 0 do original
    expect(st.sessao.linhas[0].repeticoes_editado).toBe(1);
    expect(st.sessao.linhas[0].repeticoes_original).toBe(0);
  });

  it('g) CANCELAR em boas_vindas e em cada etapa do ciclo: emite [pararTudo], fase "cancelada", sem persistirSessao; REINICIAR volta a tcle', () => {
    // 1. Em boas_vindas
    let st: Estado = transicao(
      { fase: 'tcle' },
      { tipo: 'ACEITAR', proximoNumero: 1, autorizaImagem: null }
    ).estado;
    const cBoasVindas = transicao(st, { tipo: 'CANCELAR' });
    expect(cBoasVindas.estado).toEqual({ fase: 'cancelada' });
    expect(cBoasVindas.efeitos).toEqual([{ tipo: 'pararTudo' }]);

    const reinicio = transicao(cBoasVindas.estado, { tipo: 'REINICIAR' });
    expect(reinicio.estado).toEqual({ fase: 'tcle' });
    expect(reinicio.efeitos).toEqual([]);

    // 2. Em todas as 5 etapas do ciclo
    let base: Estado = transicao(
      { fase: 'tcle' },
      { tipo: 'ACEITAR', proximoNumero: 2, autorizaImagem: null }
    ).estado;
    base = transicao(base, { tipo: 'INICIAR' }).estado; // editado_tocando
    const p1Lib = transicao(base, {
      tipo: 'AUDIO_EDITADO_FIM',
      epoca: epocaDe(base),
    }).estado;
    const origToc = transicao(p1Lib, {
      tipo: 'RESPONDER_P1',
      resposta: 'Sim',
    }).estado;
    const p2Lib = transicao(origToc, {
      tipo: 'AUDIO_ORIGINAL_FIM',
      epoca: epocaDe(origToc),
    }).estado;
    const trans = transicao(p2Lib, {
      tipo: 'RESPONDER_P2',
      resposta: 'Sim',
      agora: AGORA_FIXO,
    }).estado;

    for (const estadoEtapa of [base, p1Lib, origToc, p2Lib, trans]) {
      const cancelado = transicao(estadoEtapa, { tipo: 'CANCELAR' });
      expect(cancelado.ignorado).toBe(false);
      expect(cancelado.estado).toEqual({ fase: 'cancelada' });
      expect(cancelado.efeitos).toEqual([{ tipo: 'pararTudo' }]);
    }
  });

  it('h) RECUSAR: fase "recusado", sem efeitos e sem ID; REINICIAR volta a tcle', () => {
    const rec = transicao({ fase: 'tcle' }, { tipo: 'RECUSAR' });
    expect(rec.ignorado).toBe(false);
    expect(rec.estado).toEqual({ fase: 'recusado' });
    expect(rec.efeitos).toEqual([]);

    const rein = transicao(rec.estado, { tipo: 'REINICIAR' });
    expect(rein.ignorado).toBe(false);
    expect(rein.estado).toEqual({ fase: 'tcle' });
    expect(rein.efeitos).toEqual([]);
  });

  it('i) Persistência: falha bloqueia REINICIAR normal; TENTAR_PERSISTIR_NOVAMENTE reemite persistirSessao; PERSISTENCIA_OK libera REINICIAR; forcar: true descarta', () => {
    const respostas = Array.from({ length: 6 }, () => ({
      p1: 'Sim' as Resposta,
      p2: 'Sim' as Resposta,
    }));
    const { estadoFinal } = rodarSessaoCompleta(respostas);
    expect(estadoFinal.fase).toBe('encerramento');

    // Enquanto pendente, REINICIAR sem forcar é ignorado
    expect(transicao(estadoFinal, { tipo: 'REINICIAR' }).ignorado).toBe(true);

    // Simula falha na persistência
    const comFalha = transicao(estadoFinal, { tipo: 'PERSISTENCIA_FALHA' });
    expect(
      comFalha.estado.fase === 'encerramento' && comFalha.estado.persistencia
    ).toBe('falha');

    // REINICIAR sem forcar continua ignorado
    expect(transicao(comFalha.estado, { tipo: 'REINICIAR' }).ignorado).toBe(
      true
    );

    // TENTAR_PERSISTIR_NOVAMENTE volta a "pendente" e reemite persistirSessao
    const novaTentativa = transicao(comFalha.estado, {
      tipo: 'TENTAR_PERSISTIR_NOVAMENTE',
    });
    expect(novaTentativa.ignorado).toBe(false);
    expect(
      novaTentativa.estado.fase === 'encerramento' &&
        novaTentativa.estado.persistencia
    ).toBe('pendente');
    expect(novaTentativa.efeitos).toHaveLength(1);
    expect(novaTentativa.efeitos[0].tipo).toBe('persistirSessao');

    // PERSISTENCIA_OK libera REINICIAR normal
    const comOk = transicao(novaTentativa.estado, { tipo: 'PERSISTENCIA_OK' });
    const reinicioOk = transicao(comOk.estado, { tipo: 'REINICIAR' });
    expect(reinicioOk.ignorado).toBe(false);
    expect(reinicioOk.estado).toEqual({ fase: 'tcle' });
    expect(reinicioOk.efeitos).toEqual([{ tipo: 'pararTudo' }]);

    // E REINICIAR com forcar: true funciona mesmo em estado "falha"
    const reinicioForcado = transicao(comFalha.estado, {
      tipo: 'REINICIAR',
      forcar: true,
    });
    expect(reinicioForcado.ignorado).toBe(false);
    expect(reinicioForcado.estado).toEqual({ fase: 'tcle' });
    expect(reinicioForcado.efeitos).toEqual([{ tipo: 'pararTudo' }]);
  });

  it('j) Batimentos: ordem exata dos efeitos com BATIMENTOS_VOLTAM_NOS_INTERVALOS = true e com false', () => {
    const respostas = Array.from({ length: 6 }, () => ({
      p1: 'Sim' as Resposta,
      p2: 'Sim' as Resposta,
    }));

    // Caso 1: BATIMENTOS_VOLTAM_NOS_INTERVALOS = true
    const { todosEfeitos: efeitosTrue } = rodarSessaoCompleta(respostas, {
      ...CONFIG_SESSAO_PADRAO,
      BATIMENTOS_VOLTAM_NOS_INTERVALOS: true,
    });

    // ACEITAR -> iniciarBatimentos
    expect(efeitosTrue[0]).toEqual({ tipo: 'iniciarBatimentos' });
    // INICIAR -> fadeOutBatimentos, tocarFaixa(1, editado)
    expect(efeitosTrue[1]).toEqual({ tipo: 'fadeOutBatimentos' });
    expect(efeitosTrue[2]).toEqual({
      tipo: 'tocarFaixa',
      par: 1,
      versao: 'editado',
      epoca: 1,
    });
    // Ao fim do original de cada um dos 6 pares, emite fadeInBatimentos (6 vezes)
    expect(
      efeitosTrue.filter((e) => e.tipo === 'fadeInBatimentos')
    ).toHaveLength(6);
    expect(
      efeitosTrue.filter((e) => e.tipo === 'fadeOutBatimentos')
    ).toHaveLength(6);

    // Caso 2: BATIMENTOS_VOLTAM_NOS_INTERVALOS = false
    const { todosEfeitos: efeitosFalse } = rodarSessaoCompleta(respostas, {
      ...CONFIG_SESSAO_PADRAO,
      BATIMENTOS_VOLTAM_NOS_INTERVALOS: false,
    });

    // fadeOut ocorre apenas 1 vez (no início do Par 1) e fadeIn apenas 1 vez (no encerramento, antes de persistirSessao)
    expect(
      efeitosFalse.filter((e) => e.tipo === 'fadeOutBatimentos')
    ).toHaveLength(1);
    expect(
      efeitosFalse.filter((e) => e.tipo === 'fadeInBatimentos')
    ).toHaveLength(1);

    const ultimosDois = efeitosFalse.slice(-2);
    expect(ultimosDois[0]).toEqual({ tipo: 'fadeInBatimentos' });
    expect(ultimosDois[1].tipo).toBe('persistirSessao');
  });

  it('k) formatarIdParticipante (1, 9, 10, 99, 100) e formatarDataHora com datas fixas', () => {
    expect(formatarIdParticipante(1)).toBe('Participante_01');
    expect(formatarIdParticipante(9)).toBe('Participante_09');
    expect(formatarIdParticipante(10)).toBe('Participante_10');
    expect(formatarIdParticipante(99)).toBe('Participante_99');
    expect(formatarIdParticipante(100)).toBe('Participante_100');

    const d1 = new Date(2026, 0, 5, 7, 8, 9); // 2026-01-05 07:08:09 local
    expect(formatarDataHora(d1)).toBe('2026-01-05 07:08:09');

    const d2 = new Date(2026, 10, 19, 23, 59, 59); // 2026-11-19 23:59:59 local
    expect(formatarDataHora(d2)).toBe('2026-11-19 23:59:59');
  });

  it('l) Privacidade: JSON.stringify de todos os estados e efeitos não contém chave "nome", e autorização de imagem nunca aparece em LinhaSessao nem em SessaoConcluida', () => {
    const respostas = Array.from({ length: 6 }, () => ({
      p1: 'Sim' as Resposta,
      p2: 'Não' as Resposta,
    }));
    const { estadoFinal, todosEstados, todosEfeitos } =
      rodarSessaoCompleta(respostas);

    const jsonEstados = JSON.stringify(todosEstados);
    const jsonEfeitos = JSON.stringify(todosEfeitos);

    expect(jsonEstados).not.toContain('"nome"');
    expect(jsonEfeitos).not.toContain('"nome"');

    // No efeito persistirSessao e em SessaoConcluida não pode haver autorizaImagem
    expect(jsonEfeitos).not.toContain('autoriza');
    expect(estadoFinal.fase).toBe('encerramento');
    if (estadoFinal.fase === 'encerramento') {
      const jsonConcluida = JSON.stringify(estadoFinal.concluida);
      expect(jsonConcluida).not.toContain('autoriza');
      expect(jsonConcluida).not.toContain('nome');
    }
  });

  it('m) validarSessao rejeita: menos de 6 linhas, ordem fora de sequência, rótulo errado, tipo_pergunta_2 incoerente e chave extra', () => {
    const respostas = Array.from({ length: 6 }, () => ({
      p1: 'Sim' as Resposta,
      p2: 'Sim' as Resposta,
    }));
    const { estadoFinal } = rodarSessaoCompleta(respostas);
    if (estadoFinal.fase !== 'encerramento') throw new Error('Esperado encerramento');
    const base = estadoFinal.concluida;

    // 1. Menos de 6 linhas
    expect(
      validarSessao({ ...base, linhas: base.linhas.slice(0, 5) }).ok
    ).toBe(false);

    // 2. Ordem fora de sequência
    const ordemErrada: SessaoConcluida = {
      ...base,
      linhas: base.linhas.map((l, i) =>
        i === 2 ? { ...l, ordem_musica: 9 } : l
      ),
    };
    expect(validarSessao(ordemErrada).ok).toBe(false);

    // 3. Rótulo errado
    const rotuloErrado: SessaoConcluida = {
      ...base,
      linhas: base.linhas.map((l, i) =>
        i === 0 ? { ...l, musica: 'Música Inexistente' } : l
      ),
    };
    expect(validarSessao(rotuloErrado).ok).toBe(false);

    // 4. tipo_pergunta_2 incoerente com reconheceu
    const tipoIncoerente: SessaoConcluida = {
      ...base,
      linhas: base.linhas.map((l, i) =>
        i === 1 ? { ...l, reconheceu: 'Sim', tipo_pergunta_2: 'Surpreendeu' } : l
      ),
    };
    expect(validarSessao(tipoIncoerente).ok).toBe(false);

    // 5. Chave extra na linha
    const comChaveExtra: SessaoConcluida = {
      ...base,
      linhas: base.linhas.map((l, i) =>
        i === 0
          ? ({ ...l, nome_participante: 'Proibido' } as unknown as typeof l)
          : l
      ),
    };
    expect(validarSessao(comChaveExtra).ok).toBe(false);
  });

  it('n) Fuzz determinístico: 5 sementes × 2000 eventos aleatórios (10.000 eventos) nunca lançam exceção e preservam todas as invariantes', () => {
    // Gerador PRNG Mulberry32 determinístico
    function criarPrng(semente: number) {
      let a = semente >>> 0;
      return () => {
        a |= 0;
        a = (a + 0x6d2b79f5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
    }

    const sementes = [42, 1337, 2026, 98765, 555555];

    for (const semente of sementes) {
      const rand = criarPrng(semente);
      let estado: Estado = { fase: 'tcle' };
      let persistenciasNaSessaoAtual = 0;

      for (let passo = 0; passo < 2000; passo++) {
        const epAtual = epocaDe(estado);
        const epSorteada =
          rand() < 0.7 ? epAtual : Math.floor(rand() * 50) - 10;
        const respSorteada: Resposta = rand() < 0.5 ? 'Sim' : 'Não';

        const candidatos: Evento[] = [
          {
            tipo: 'ACEITAR',
            proximoNumero: Math.floor(rand() * 200),
            autorizaImagem:
              rand() < 0.33
                ? 'autoriza'
                : rand() < 0.5
                ? 'nao-autoriza'
                : null,
          },
          { tipo: 'RECUSAR' },
          { tipo: 'INICIAR' },
          { tipo: 'AUDIO_EDITADO_FIM', epoca: epSorteada },
          { tipo: 'AUDIO_ORIGINAL_FIM', epoca: epSorteada },
          { tipo: 'AUDIO_INTERROMPIDO', epoca: epSorteada },
          { tipo: 'RETOMAR' },
          { tipo: 'OUVIR_NOVAMENTE' },
          { tipo: 'RESPONDER_P1', resposta: respSorteada },
          {
            tipo: 'RESPONDER_P2',
            resposta: respSorteada,
            agora: AGORA_FIXO,
          },
          { tipo: 'TRANSICAO_FIM' },
          { tipo: 'PERSISTENCIA_OK' },
          { tipo: 'PERSISTENCIA_FALHA' },
          { tipo: 'TENTAR_PERSISTIR_NOVAMENTE' },
          { tipo: 'CANCELAR' },
          { tipo: 'REINICIAR', forcar: rand() < 0.25 },
        ];

        const ev = candidatos[Math.floor(rand() * candidatos.length)];
        const res = transicao(estado, ev);

        // Se ignorado, o estado precisa ser estritamente o mesmo e efeitos vazios
        if (res.ignorado) {
          expect(res.estado).toBe(estado);
          expect(res.efeitos).toHaveLength(0);
        }

        estado = res.estado;

        // Zera contador de persistência ao voltar ao TCLE ou iniciar nova sessão
        if (
          estado.fase === 'tcle' ||
          estado.fase === 'recusado' ||
          estado.fase === 'cancelada' ||
          ev.tipo === 'ACEITAR'
        ) {
          persistenciasNaSessaoAtual = 0;
        }

        // Verifica invariantes
        if (estado.fase === 'ciclo') {
          expect(estado.par).toBeGreaterThanOrEqual(1);
          expect(estado.par).toBeLessThanOrEqual(6);
          expect(estado.sessao.linhas.length).toBeLessThanOrEqual(6);
        }

        if (estado.fase === 'encerramento') {
          expect(estado.concluida.linhas).toHaveLength(6);
        }

        for (const ef of res.efeitos) {
          if (ef.tipo === 'persistirSessao') {
            persistenciasNaSessaoAtual++;
            if (ev.tipo !== 'TENTAR_PERSISTIR_NOVAMENTE') {
              expect(persistenciasNaSessaoAtual).toBe(1);
            }
          }
        }
      }
    }
  });

  it('o) Seletores e Store: botoes(e), sessaoAtiva, sessaoNaoSalva, progresso, revelarMusica, textoPergunta2 e faixaAtual em todas as etapas', () => {
    const store = criarSessionStore();
    expect(store.getEstado()).toEqual({ fase: 'tcle' });
    expect(sessaoAtiva(store.getEstado())).toBe(false);
    expect(progresso(store.getEstado())).toBeNull();
    expect(faixaAtual(store.getEstado())).toBeNull();

    // ACEITAR -> boas_vindas
    store.dispatch({
      tipo: 'ACEITAR',
      proximoNumero: 7,
      autorizaImagem: 'nao-autoriza',
    });
    expect(sessaoAtiva(store.getEstado())).toBe(true);
    expect(botoes(store.getEstado())).toEqual({
      play: true,
      respostaP1: false,
      respostaP2: false,
      ouvirNovamente: false,
      retomar: false,
    });

    // INICIAR -> editado_tocando (nada habilitado)
    store.dispatch({ tipo: 'INICIAR' });
    expect(progresso(store.getEstado())).toBe('1 / 6');
    expect(revelarMusica(store.getEstado())).toBe(false);
    expect(textoPergunta2(store.getEstado())).toBeNull();
    expect(faixaAtual(store.getEstado())?.ordem).toBe(1);
    expect(botoes(store.getEstado())).toEqual({
      play: false,
      respostaP1: false,
      respostaP2: false,
      ouvirNovamente: false,
      retomar: false,
    });

    // AUDIO_INTERROMPIDO -> apenas retomar habilitado
    store.dispatch({
      tipo: 'AUDIO_INTERROMPIDO',
      epoca: epocaDe(store.getEstado()),
    });
    expect(botoes(store.getEstado()).retomar).toBe(true);
    expect(botoes(store.getEstado()).ouvirNovamente).toBe(false);

    // RETOMAR e AUDIO_EDITADO_FIM -> p1_liberada
    store.dispatch({ tipo: 'RETOMAR' });
    store.dispatch({
      tipo: 'AUDIO_EDITADO_FIM',
      epoca: epocaDe(store.getEstado()),
    });
    expect(revelarMusica(store.getEstado())).toBe(false);
    expect(botoes(store.getEstado())).toEqual({
      play: false,
      respostaP1: true,
      respostaP2: false,
      ouvirNovamente: true,
      retomar: false,
    });

    // RESPONDER_P1 ("Não") -> original_tocando (revela música, escolhe pergunta2Nao, desabilita botões)
    store.dispatch({ tipo: 'RESPONDER_P1', resposta: 'Não' });
    expect(revelarMusica(store.getEstado())).toBe(true);
    expect(textoPergunta2(store.getEstado())).toBe(STRINGS.pergunta2Nao);
    expect(botoes(store.getEstado()).ouvirNovamente).toBe(false);

    // AUDIO_ORIGINAL_FIM -> p2_liberada
    store.dispatch({
      tipo: 'AUDIO_ORIGINAL_FIM',
      epoca: epocaDe(store.getEstado()),
    });
    expect(revelarMusica(store.getEstado())).toBe(true);
    expect(botoes(store.getEstado())).toEqual({
      play: false,
      respostaP1: false,
      respostaP2: true,
      ouvirNovamente: true,
      retomar: false,
    });

    // RESPONDER_P2 -> transicao (mantém revelação até fim do par, tudo desabilitado)
    store.dispatch({
      tipo: 'RESPONDER_P2',
      resposta: 'Sim',
      agora: AGORA_FIXO,
    });
    expect(revelarMusica(store.getEstado())).toBe(true);
    expect(sessaoNaoSalva(store.getEstado())).toBe(false);
    expect(botoes(store.getEstado())).toEqual({
      play: false,
      respostaP1: false,
      respostaP2: false,
      ouvirNovamente: false,
      retomar: false,
    });

    // Verifica sessaoNaoSalva no encerramento (pendente/falha = true, ok = false)
    const respostas6 = Array.from({ length: 6 }, () => ({
      p1: 'Sim' as Resposta,
      p2: 'Sim' as Resposta,
    }));
    const { estadoFinal } = rodarSessaoCompleta(respostas6);
    expect(sessaoNaoSalva(estadoFinal)).toBe(true);
    const salvo = transicao(estadoFinal, { tipo: 'PERSISTENCIA_OK' }).estado;
    expect(sessaoNaoSalva(salvo)).toBe(false);
  });
});
