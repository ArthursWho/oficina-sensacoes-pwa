import 'fake-indexeddb/auto';
import { deleteDB } from 'idb';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ResultadoFaixa } from '../audio/AudioEngine';
import { TRACKS } from '../content/tracks';
import { TOTAL_PARES } from '../session/config';
import { criarControlador, EngineControlador } from '../session/controlador';
import { criarSessionStore } from '../session/store';
import { LinhaSessao, Resposta, SessaoConcluida } from '../session/tipos';
import { formatarIdParticipante } from '../session/utilidades';
import { visaoEncerramento } from '../session/visao';
import { proximoNumeroParticipante } from './contador';
import { abrirBanco, ErroArmazenamento, STORE_SESSOES } from './db';
import {
  estadoArmazenamento,
  pedirArmazenamentoPersistente,
} from './persistente';
import {
  garantirSaudeArmazenamento,
  resetarPreparoArmazenamentoParaTestes,
} from './preparo';
import { criarRepositorio } from './repositorio';
import { podeIniciarSessao } from '../ui/telas/TelaTcle';

let contadorDb = 0;
function novoNomeDb(): string {
  contadorDb++;
  return `mundo-utero-unit-${Date.now()}-${contadorDb}`;
}

function criarSessaoValida(
  numeroParticipante: number,
  reconheceuPadrao: Resposta = 'Sim'
): SessaoConcluida {
  const id = formatarIdParticipante(numeroParticipante);
  const linhas: LinhaSessao[] = TRACKS.map((t, idx) => ({
    id_participante: id,
    data_hora: '2026-11-19 01:45:00',
    ordem_musica: idx + 1,
    musica: t.rotulo,
    reconheceu: reconheceuPadrao,
    tipo_pergunta_2: reconheceuPadrao === 'Sim' ? 'Acertou' : 'Surpreendeu',
    resposta_pergunta_2: 'Sim',
    repeticoes_editado: idx % 2,
    repeticoes_original: 0,
  }));

  return {
    id_participante: id,
    linhas,
  };
}

describe('Etapa 7 — Persistência Local em IndexedDB e Tela 4 Real (Encerramento)', () => {
  const bancosCriados: string[] = [];

  function registrarDb(nome: string): string {
    bancosCriados.push(nome);
    return nome;
  }

  afterEach(async () => {
    while (bancosCriados.length > 0) {
      const nome = bancosCriados.pop()!;
      try {
        await deleteDB(nome);
      } catch {
        // Ignora
      }
    }
  });

  it('a) salvarSessao + listarSessoes: devolve a sessão idêntica e ordena numericamente (2, 10, 1 -> 1, 2, 10)', async () => {
    const nomeDb = registrarDb(novoNomeDb());
    const repo = criarRepositorio(nomeDb);

    const s2 = criarSessaoValida(2);
    const s10 = criarSessaoValida(10);
    const s1 = criarSessaoValida(1);

    await repo.salvarSessao(s2);
    await repo.salvarSessao(s10);
    await repo.salvarSessao(s1);

    expect(await repo.contarSessoes()).toBe(3);

    const listadas = await repo.listarSessoes();
    expect(listadas.map((s) => s.id_participante)).toEqual([
      'Participante_01',
      'Participante_02',
      'Participante_10',
    ]);
    expect(listadas[0]).toEqual(s1);
    expect(listadas[1]).toEqual(s2);
    expect(listadas[2]).toEqual(s10);
  });

  it('b) proximoNumeroParticipante: vazio -> 1; [1,2,3] -> 4; [1,2,5] -> 6; [99] -> 100', async () => {
    const nomeDb = registrarDb(novoNomeDb());
    const repo = criarRepositorio(nomeDb);

    // Vazio -> 1
    expect(await proximoNumeroParticipante(repo)).toBe(1);

    // [1, 2, 3] -> 4
    await repo.salvarSessao(criarSessaoValida(1));
    await repo.salvarSessao(criarSessaoValida(2));
    await repo.salvarSessao(criarSessaoValida(3));
    expect(await proximoNumeroParticipante(repo)).toBe(4);

    // Lacuna [1, 2, 3, 5] -> 6
    await repo.salvarSessao(criarSessaoValida(5));
    expect(await proximoNumeroParticipante(repo)).toBe(6);

    // [..., 99] -> 100
    await repo.salvarSessao(criarSessaoValida(99));
    expect(await proximoNumeroParticipante(repo)).toBe(100);
  });

  it('c) Sessão inválida (menos de 6 linhas, rótulo errado, chave extra): rejeita com "invalida" e o banco continua vazio', async () => {
    const nomeDb = registrarDb(novoNomeDb());
    const repo = criarRepositorio(nomeDb);
    const base = criarSessaoValida(1);

    // 1. Menos de 6 linhas
    await expect(
      repo.salvarSessao({ ...base, linhas: base.linhas.slice(0, 4) })
    ).rejects.toMatchObject({
      name: 'ErroArmazenamento',
      codigo: 'invalida',
    });

    // 2. Rótulo errado
    await expect(
      repo.salvarSessao({
        ...base,
        linhas: base.linhas.map((l, i) =>
          i === 0 ? { ...l, musica: 'Incorreta' } : l
        ),
      })
    ).rejects.toMatchObject({
      codigo: 'invalida',
    });

    // 3. Chave extra
    await expect(
      repo.salvarSessao({
        ...base,
        linhas: base.linhas.map((l, i) =>
          i === 0 ? ({ ...l, extra: '123' } as unknown as LinhaSessao) : l
        ),
      })
    ).rejects.toMatchObject({
      codigo: 'invalida',
    });

    expect(await repo.contarSessoes()).toBe(0);
  });

  it('d) Duplicata idêntica -> sucesso idempotente (1 registro); mesmo id com conteúdo diferente -> rejeita "duplicado" e mantém original intacto', async () => {
    const nomeDb = registrarDb(novoNomeDb());
    const repo = criarRepositorio(nomeDb);

    const original = criarSessaoValida(1, 'Sim');
    await repo.salvarSessao(original);

    // Segunda gravação idêntica -> sucesso idempotente
    await expect(repo.salvarSessao(original)).resolves.toBeUndefined();
    expect(await repo.contarSessoes()).toBe(1);

    // Mesmo ID com conteúdo diferente -> rejeita com "duplicado"
    const divergente = criarSessaoValida(1, 'Não');
    await expect(repo.salvarSessao(divergente)).rejects.toMatchObject({
      name: 'ErroArmazenamento',
      codigo: 'duplicado',
    });

    // Original permanece intacto
    const salvas = await repo.listarSessoes();
    expect(salvas).toHaveLength(1);
    expect(salvas[0]).toEqual(original);
  });

  it('e) Atomicidade: forçar falha durante a transação de gravação -> nenhum registro parcial no banco', async () => {
    const nomeDb = registrarDb(novoNomeDb());
    const repo = criarRepositorio(nomeDb);

    // Força erro na escrita (simulando falha na transação)
    const proto = IDBObjectStore.prototype;
    const spyAdd = vi.spyOn(proto, 'add').mockImplementationOnce(() => {
      throw new DOMException('Falha de disco simulada', 'UnknownError');
    });

    await expect(
      repo.salvarSessao(criarSessaoValida(1))
    ).rejects.toMatchObject({
      name: 'ErroArmazenamento',
      codigo: 'gravacao',
    });

    spyAdd.mockRestore();
    expect(await repo.contarSessoes()).toBe(0);
  });

  it('f) Verificação pós-gravação: simular leitura de volta divergente -> rejeita com "verificacao"', async () => {
    const nomeDb = registrarDb(novoNomeDb());
    const repo = criarRepositorio(nomeDb);

    // Espiona IDBObjectStore.prototype.get para devolver um registro corrompido na leitura de verificação
    const spyGet = vi
      .spyOn(IDBObjectStore.prototype, 'get')
      .mockImplementationOnce(() => {
        const req = {
          result: undefined,
          error: null,
          onsuccess: null as ((ev: Event) => void) | null,
          onerror: null as ((ev: Event) => void) | null,
          addEventListener(tipo: string, cb: () => void) {
            if (tipo === 'success') setTimeout(cb, 0);
          },
          removeEventListener() {},
        };
        setTimeout(() => {
          req.onsuccess?.(new Event('success'));
        }, 0);
        return req as unknown as IDBRequest;
      });

    await expect(
      repo.salvarSessao(criarSessaoValida(1))
    ).rejects.toMatchObject({
      name: 'ErroArmazenamento',
      codigo: 'verificacao',
    });

    spyGet.mockRestore();
  });

  it('g) Registro gravado contém exatamente { id_participante, linhas, versao_esquema, versao_app } e nenhuma chave "nome" ou de autorização de imagem', async () => {
    const nomeDb = registrarDb(novoNomeDb());
    const repo = criarRepositorio(nomeDb);

    await repo.salvarSessao(criarSessaoValida(1));

    const db = await abrirBanco(nomeDb);
    const cru = await db.get(STORE_SESSOES, 'Participante_01');
    db.close();

    expect(cru).toBeDefined();
    if (!cru) return;

    expect(Object.keys(cru).sort()).toEqual([
      'id_participante',
      'linhas',
      'versao_app',
      'versao_esquema',
    ]);
    expect(cru.versao_esquema).toBe(1);
    expect(typeof cru.versao_app).toBe('string');

    const json = JSON.stringify(cru);
    expect(json).not.toContain('"nome"');
    expect(json).not.toContain('autoriza');
  });

  it('h) Fluxo integrado (store + controlador + engine falso + repositório real com fake-indexeddb): sessão completa grava 1 registro, despacha PERSISTENCIA_OK e libera REINICIAR; RECUSAR/CANCELAR/REINICIAR no meio não gravam nada', async () => {
    const nomeDb = registrarDb(novoNomeDb());
    const repo = criarRepositorio(nomeDb);
    const store = criarSessionStore();

    const faixasPendentes: Array<(res: ResultadoFaixa) => void> = [];
    const engineFalso: EngineControlador = {
      iniciarBatimentos() {},
      pararTudo() {},
      async fadeOutBatimentos() {},
      async fadeInBatimentos() {},
      tocarFaixa() {
        return new Promise<ResultadoFaixa>((resolve) => {
          faixasPendentes.push(resolve);
        });
      },
    };

    const ctrl = criarControlador(engineFalso, store, repo);

    // 1. RECUSAR -> 0 registros
    store.dispatch({ tipo: 'RECUSAR' });
    store.dispatch({ tipo: 'REINICIAR' });
    expect(await repo.contarSessoes()).toBe(0);

    // 2. CANCELAR no meio do ciclo -> 0 registros e próximo número continua 1
    const n1 = await proximoNumeroParticipante(repo);
    expect(n1).toBe(1);
    store.dispatch({
      tipo: 'ACEITAR',
      proximoNumero: n1,
      autorizaImagem: 'autoriza',
    });
    store.dispatch({ tipo: 'INICIAR' });
    await ctrl.aguardarFila();
    store.dispatch({ tipo: 'CANCELAR' });
    store.dispatch({ tipo: 'REINICIAR' });
    faixasPendentes.length = 0; // Limpa a promessa da faixa que foi cancelada antes da próxima sessão
    expect(await repo.contarSessoes()).toBe(0);
    expect(await proximoNumeroParticipante(repo)).toBe(1);

    // 3. Sessão completa -> grava 1 registro, despacha PERSISTENCIA_OK e próximo número passa a ser 2
    store.dispatch({
      tipo: 'ACEITAR',
      proximoNumero: await proximoNumeroParticipante(repo),
      autorizaImagem: 'nao-autoriza',
    });
    store.dispatch({ tipo: 'INICIAR' });
    await ctrl.aguardarFila();

    for (let par = 1; par <= TOTAL_PARES; par++) {
      faixasPendentes.shift()!('fim');
      await Promise.resolve();

      store.dispatch({ tipo: 'RESPONDER_P1', resposta: 'Sim' });
      await ctrl.aguardarFila();

      faixasPendentes.shift()!('fim');
      await Promise.resolve();
      await ctrl.aguardarFila();

      store.dispatch({
        tipo: 'RESPONDER_P2',
        resposta: 'Sim',
        agora: '2026-11-19 01:50:00',
      });
      await ctrl.aguardarFila();

      if (par < TOTAL_PARES) {
        store.dispatch({ tipo: 'TRANSICAO_FIM' });
        await ctrl.aguardarFila();
      }
    }

    // Aguarda a transação assíncrona do fake-indexeddb concluir e despachar PERSISTENCIA_OK
    await vi.waitFor(async () => {
      const st = store.getEstado();
      expect(st.fase === 'encerramento' && st.persistencia).toBe('ok');
    });

    expect(await repo.contarSessoes()).toBe(1);
    expect(await proximoNumeroParticipante(repo)).toBe(2);

    // REINICIAR normal agora é aceito
    const rein = store.dispatch({ tipo: 'REINICIAR' });
    expect(rein.ignorado).toBe(false);
    expect(store.getEstado().fase).toBe('tcle');

    ctrl.desconectar();
  });

  it('i) Falha de gravação (repositório falso que rejeita na 1ª tentativa e sucede na 2ª): PERSISTENCIA_FALHA -> bloqueia REINICIAR -> TENTAR_PERSISTIR_NOVAMENTE -> PERSISTENCIA_OK -> libera REINICIAR', async () => {
    const store = criarSessionStore();
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    let tentativas = 0;
    const repoInstavel = {
      async salvarSessao() {
        tentativas++;
        if (tentativas === 1) {
          throw new ErroArmazenamento('gravacao', 'Erro simulado na 1ª tentativa');
        }
      },
    };

    const faixasPendentes: Array<(res: ResultadoFaixa) => void> = [];
    const engineFalso: EngineControlador = {
      iniciarBatimentos() {},
      pararTudo() {},
      async fadeOutBatimentos() {},
      async fadeInBatimentos() {},
      tocarFaixa() {
        return new Promise<ResultadoFaixa>((resolve) => {
          faixasPendentes.push(resolve);
        });
      },
    };

    const ctrl = criarControlador(engineFalso, store, repoInstavel);

    store.dispatch({
      tipo: 'ACEITAR',
      proximoNumero: 1,
      autorizaImagem: null,
    });
    store.dispatch({ tipo: 'INICIAR' });
    await ctrl.aguardarFila();

    for (let par = 1; par <= TOTAL_PARES; par++) {
      faixasPendentes.shift()!('fim');
      await Promise.resolve();
      store.dispatch({ tipo: 'RESPONDER_P1', resposta: 'Sim' });
      await ctrl.aguardarFila();
      faixasPendentes.shift()!('fim');
      await Promise.resolve();
      await ctrl.aguardarFila();
      store.dispatch({
        tipo: 'RESPONDER_P2',
        resposta: 'Sim',
        agora: '2026-11-19 01:52:00',
      });
      await ctrl.aguardarFila();
      if (par < TOTAL_PARES) {
        store.dispatch({ tipo: 'TRANSICAO_FIM' });
        await ctrl.aguardarFila();
      }
    }

    await vi.waitFor(() => {
      const st = store.getEstado();
      expect(st.fase === 'encerramento' && st.persistencia).toBe('falha');
    });

    // REINICIAR sem forcar é ignorado
    expect(store.dispatch({ tipo: 'REINICIAR' }).ignorado).toBe(true);

    // TENTAR_PERSISTIR_NOVAMENTE chama de novo e sucede
    store.dispatch({ tipo: 'TENTAR_PERSISTIR_NOVAMENTE' });
    await ctrl.aguardarFila();

    await vi.waitFor(() => {
      const st = store.getEstado();
      expect(st.fase === 'encerramento' && st.persistencia).toBe('ok');
    });

    expect(tentativas).toBe(2);
    expect(store.dispatch({ tipo: 'REINICIAR' }).ignorado).toBe(false);
    expect(store.getEstado().fase).toBe('tcle');

    ctrl.desconectar();
    errorSpy.mockRestore();
  });

  it('j) verificarSaude: com indexedDB indisponível devolve { saudavel: false } com motivo, sem lançar', async () => {
    const idbOriginal = globalThis.indexedDB;
    try {
      // Remove temporariamente indexedDB do escopo global
      Object.defineProperty(globalThis, 'indexedDB', {
        value: undefined,
        configurable: true,
        writable: true,
      });

      const repoSemIdb = criarRepositorio('db-inexistente');
      const saude = await repoSemIdb.verificarSaude();
      expect(saude.saudavel).toBe(false);
      expect(saude.motivo).toBeTruthy();
    } finally {
      Object.defineProperty(globalThis, 'indexedDB', {
        value: idbOriginal,
        configurable: true,
        writable: true,
      });
    }
  });

  it('k) podeIniciarSessao: todas as combinações e garantirSaudeArmazenamento reflete falha sem consumir ID', async () => {
    expect(
      podeIniciarSessao({ audioOk: true, armazenamentoOk: true })
    ).toBe(true);
    expect(
      podeIniciarSessao({ audioOk: true, armazenamentoOk: false })
    ).toBe(false);
    expect(
      podeIniciarSessao({ audioOk: false, armazenamentoOk: true })
    ).toBe(false);
    expect(
      podeIniciarSessao({ audioOk: false, armazenamentoOk: false })
    ).toBe(false);

    resetarPreparoArmazenamentoParaTestes();
    const repoFalho = {
      salvarSessao: async () => {},
      listarSessoes: async () => [],
      contarSessoes: async () => 0,
      proximoNumeroParticipante: async () => 1,
      verificarSaude: async () => ({
        saudavel: false,
        motivo: 'IndexedDB bloqueado',
      }),
    };

    const saude = await garantirSaudeArmazenamento(repoFalho);
    expect(saude.saudavel).toBe(false);
    expect(
      podeIniciarSessao({ audioOk: true, armazenamentoOk: saude.saudavel })
    ).toBe(false);
  });

  it('l) pedirArmazenamentoPersistente e estadoArmazenamento: com navigator.storage ausente, concedido e negado; nunca lançam', async () => {
    const navOriginal = globalThis.navigator;

    try {
      // 1. navigator.storage ausente
      Object.defineProperty(globalThis, 'navigator', {
        value: {},
        configurable: true,
        writable: true,
      });
      expect(await pedirArmazenamentoPersistente()).toEqual({
        suportado: false,
        persistido: false,
      });
      expect(await estadoArmazenamento()).toEqual({
        suportado: false,
        persistido: false,
      });

      // 2. Concedido + estimate
      Object.defineProperty(globalThis, 'navigator', {
        value: {
          storage: {
            persisted: async () => false,
            persist: async () => true,
            estimate: async () => ({
              usage: 5 * 1024 * 1024,
              quota: 100 * 1024 * 1024,
            }),
          },
        },
        configurable: true,
        writable: true,
      });
      expect(await pedirArmazenamentoPersistente()).toEqual({
        suportado: true,
        persistido: true,
      });
      expect(await estadoArmazenamento()).toEqual({
        suportado: true,
        persistido: false,
        usoMB: 5,
        quotaMB: 100,
      });

      // 3. Negado
      Object.defineProperty(globalThis, 'navigator', {
        value: {
          storage: {
            persisted: async () => false,
            persist: async () => false,
          },
        },
        configurable: true,
        writable: true,
      });
      expect(await pedirArmazenamentoPersistente()).toEqual({
        suportado: true,
        persistido: false,
      });
    } finally {
      Object.defineProperty(globalThis, 'navigator', {
        value: navOriginal,
        configurable: true,
        writable: true,
      });
    }
  });

  it('m) visaoEncerramento para persistência pendente, ok e falha', () => {
    expect(visaoEncerramento({ fase: 'tcle' })).toBeNull();

    const sessaoAtivaDummy = {
      idParticipante: 'Participante_01',
      autorizaImagem: null,
      linhas: [],
      epoca: 12,
      batimentosAudiveis: true,
    };
    const concluidaDummy = criarSessaoValida(1);

    expect(
      visaoEncerramento({
        fase: 'encerramento',
        sessao: sessaoAtivaDummy,
        concluida: concluidaDummy,
        persistencia: 'pendente',
      })
    ).toEqual({
      status: 'salvando',
      mostrarTentarNovamente: false,
      podeReiniciar: false,
    });

    expect(
      visaoEncerramento({
        fase: 'encerramento',
        sessao: sessaoAtivaDummy,
        concluida: concluidaDummy,
        persistencia: 'ok',
      })
    ).toEqual({
      status: 'salvo',
      mostrarTentarNovamente: false,
      podeReiniciar: true,
    });

    expect(
      visaoEncerramento({
        fase: 'encerramento',
        sessao: sessaoAtivaDummy,
        concluida: concluidaDummy,
        persistencia: 'falha',
      })
    ).toEqual({
      status: 'falha',
      mostrarTentarNovamente: true,
      podeReiniciar: false,
    });
  });
});
