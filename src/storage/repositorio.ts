import { LinhaSessao, SessaoConcluida } from '../session/tipos';
import { validarSessao } from '../session/utilidades';
import {
  abrirBanco,
  ErroArmazenamento,
  NOME_DB_PADRAO,
  obterVersaoApp,
  RegistroSessaoDb,
  RegistroUltimaExportacao,
  STORE_META,
  STORE_SESSOES,
} from './db';

export interface RepositorioSessoes {
  salvarSessao(s: SessaoConcluida): Promise<void>;
  listarSessoes(): Promise<SessaoConcluida[]>;
  contarSessoes(): Promise<number>;
  proximoNumeroParticipante(): Promise<number>;
  verificarSaude(): Promise<{ saudavel: boolean; motivo?: string }>;
  registrarExportacao(ids: string[], agora: Date): Promise<void>;
  obterUltimaExportacao(): Promise<RegistroUltimaExportacao | null>;
  contarNaoExportadas(): Promise<number>;
}

// Extrai o sufixo numérico de "Participante_NN" (ex.: "Participante_10" -> 10)
function extrairNumeroParticipante(id: string): number {
  const match = /(\d+)$/.exec(id);
  if (!match) return 0;
  const num = Number.parseInt(match[1], 10);
  return Number.isNaN(num) ? 0 : num;
}

// Clona profundamente uma linha garantindo apenas as 9 colunas oficiais
function clonarLinha(l: LinhaSessao): LinhaSessao {
  return {
    id_participante: l.id_participante,
    data_hora: l.data_hora,
    ordem_musica: l.ordem_musica,
    musica: l.musica,
    reconheceu: l.reconheceu,
    tipo_pergunta_2: l.tipo_pergunta_2,
    resposta_pergunta_2: l.resposta_pergunta_2,
    repeticoes_editado: l.repeticoes_editado,
    repeticoes_original: l.repeticoes_original,
  };
}

// Compara profundamente duas sessões (id_participante e todas as 9 colunas das 6 linhas)
function sessoesIdenticas(a: SessaoConcluida, b: SessaoConcluida): boolean {
  if (a.id_participante !== b.id_participante) return false;
  if (a.linhas.length !== b.linhas.length) return false;

  for (let i = 0; i < a.linhas.length; i++) {
    const la = a.linhas[i];
    const lb = b.linhas[i];
    if (
      la.id_participante !== lb.id_participante ||
      la.data_hora !== lb.data_hora ||
      la.ordem_musica !== lb.ordem_musica ||
      la.musica !== lb.musica ||
      la.reconheceu !== lb.reconheceu ||
      la.tipo_pergunta_2 !== lb.tipo_pergunta_2 ||
      la.resposta_pergunta_2 !== lb.resposta_pergunta_2 ||
      la.repeticoes_editado !== lb.repeticoes_editado ||
      la.repeticoes_original !== lb.repeticoes_original
    ) {
      return false;
    }
  }
  return true;
}

function ehConstraintError(erro: unknown): boolean {
  if (!erro || typeof erro !== 'object') return false;
  const nome = (erro as { name?: string }).name;
  return nome === 'ConstraintError';
}

/**
 * Cria um repositório de sessões apontando para o banco IndexedDB informado.
 */
export function criarRepositorio(
  nomeDb: string = NOME_DB_PADRAO
): RepositorioSessoes {
  return {
    async salvarSessao(s: SessaoConcluida): Promise<void> {
      // 1. Valida a sessão antes de tocar no banco
      const validacao = validarSessao(s);
      if (!validacao.ok) {
        throw new ErroArmazenamento(
          'invalida',
          `Sessão inválida para gravação: ${validacao.erros.join('; ')}`
        );
      }

      const registroParaGravar: RegistroSessaoDb = {
        id_participante: s.id_participante,
        linhas: s.linhas.map(clonarLinha),
        versao_esquema: 1,
        versao_app: obterVersaoApp(),
      };

      const db = await abrirBanco(nomeDb);
      try {
        // 2. Gravação atômica em uma única transação readwrite com `add`
        let ocorreuConstraintError = false;
        try {
          const tx = db.transaction(STORE_SESSOES, 'readwrite');
          await Promise.all([tx.store.add(registroParaGravar), tx.done]);
        } catch (erroTx) {
          if (ehConstraintError(erroTx)) {
            ocorreuConstraintError = true;
          } else {
            const msg =
              erroTx instanceof Error ? erroTx.message : String(erroTx);
            throw new ErroArmazenamento(
              'gravacao',
              `Falha ao gravar sessão "${s.id_participante}": ${msg}`
            );
          }
        }

        // 3. Se o id já existia (ConstraintError), verifica se é idêntico (idempotência) ou conflito real
        if (ocorreuConstraintError) {
          const existente = await db.get(STORE_SESSOES, s.id_participante);
          if (existente && sessoesIdenticas(existente, s)) {
            return;
          }
          throw new ErroArmazenamento(
            'duplicado',
            `Já existe uma sessão diferente gravada com o ID "${s.id_participante}".`
          );
        }

        // 4. Verificação pós-commit: lê de volta pelo id e compara com o que foi gravado
        const lidoDeVolta = await db.get(STORE_SESSOES, s.id_participante);
        if (
          !lidoDeVolta ||
          !sessoesIdenticas(lidoDeVolta, registroParaGravar) ||
          lidoDeVolta.versao_esquema !== 1
        ) {
          throw new ErroArmazenamento(
            'verificacao',
            `Falha na verificação pós-gravação da sessão "${s.id_participante}".`
          );
        }
      } finally {
        db.close();
      }
    },

    async listarSessoes(): Promise<SessaoConcluida[]> {
      const db = await abrirBanco(nomeDb);
      try {
        const todos = await db.getAll(STORE_SESSOES);
        todos.sort(
          (a, b) =>
            extrairNumeroParticipante(a.id_participante) -
            extrairNumeroParticipante(b.id_participante)
        );
        return todos.map((reg) => ({
          id_participante: reg.id_participante,
          linhas: reg.linhas.map(clonarLinha),
        }));
      } finally {
        db.close();
      }
    },

    async contarSessoes(): Promise<number> {
      const db = await abrirBanco(nomeDb);
      try {
        return await db.count(STORE_SESSOES);
      } finally {
        db.close();
      }
    },

    async proximoNumeroParticipante(): Promise<number> {
      const db = await abrirBanco(nomeDb);
      try {
        const chaves = await db.getAllKeys(STORE_SESSOES);
        let maior = 0;
        for (const chave of chaves) {
          const n = extrairNumeroParticipante(String(chave));
          if (n > maior) {
            maior = n;
          }
        }
        return maior + 1;
      } finally {
        db.close();
      }
    },

    async verificarSaude(): Promise<{ saudavel: boolean; motivo?: string }> {
      try {
        const db = await abrirBanco(nomeDb);
        try {
          const contagem = await db.count(STORE_SESSOES);
          if (typeof contagem !== 'number' || contagem < 0) {
            return {
              saudavel: false,
              motivo: 'Leitura de contagem retornou valor inválido.',
            };
          }
          return { saudavel: true };
        } finally {
          db.close();
        }
      } catch (erro) {
        const motivo =
          erro instanceof Error
            ? erro.message
            : 'Erro desconhecido ao verificar IndexedDB.';
        return {
          saudavel: false,
          motivo,
        };
      }
    },

    async registrarExportacao(ids: string[], agora: Date): Promise<void> {
      const db = await abrirBanco(nomeDb);
      try {
        const registro: RegistroUltimaExportacao = {
          chave: 'ultimaExportacao',
          em: agora.toISOString(),
          ids: [...ids],
        };
        const tx = db.transaction(STORE_META, 'readwrite');
        await Promise.all([tx.store.put(registro), tx.done]);
      } finally {
        db.close();
      }
    },

    async obterUltimaExportacao(): Promise<RegistroUltimaExportacao | null> {
      const db = await abrirBanco(nomeDb);
      try {
        const reg = await db.get(STORE_META, 'ultimaExportacao');
        if (!reg) return null;
        return {
          chave: 'ultimaExportacao',
          em: reg.em,
          ids: [...reg.ids],
        };
      } finally {
        db.close();
      }
    },

    async contarNaoExportadas(): Promise<number> {
      const db = await abrirBanco(nomeDb);
      try {
        const [chavesSessoes, ultima] = await Promise.all([
          db.getAllKeys(STORE_SESSOES),
          db.get(STORE_META, 'ultimaExportacao'),
        ]);

        if (!ultima || !Array.isArray(ultima.ids)) {
          return chavesSessoes.length;
        }

        const exportadasSet = new Set(ultima.ids);
        let naoExportadas = 0;
        for (const chave of chavesSessoes) {
          if (!exportadasSet.has(String(chave))) {
            naoExportadas++;
          }
        }
        return naoExportadas;
      } finally {
        db.close();
      }
    },
  };
}

// Instância padrão do repositório apontando para o banco oficial "mundo-utero"
export const repositorio: RepositorioSessoes = criarRepositorio(NOME_DB_PADRAO);
