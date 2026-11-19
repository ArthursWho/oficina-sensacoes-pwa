import { DBSchema, IDBPDatabase, openDB } from 'idb';
import { LinhaSessao } from '../session/tipos';

export const NOME_DB_PADRAO = 'mundo-utero';
export const VERSAO_DB = 1;
export const STORE_SESSOES = 'sessoes';

export type CodigoErroArmazenamento =
  | 'indisponivel'
  | 'abertura'
  | 'gravacao'
  | 'verificacao'
  | 'duplicado'
  | 'invalida';

// Classe de erro tipada para operações de armazenamento local
export class ErroArmazenamento extends Error {
  readonly codigo: CodigoErroArmazenamento;

  constructor(codigo: CodigoErroArmazenamento, mensagem: string) {
    super(mensagem);
    this.name = 'ErroArmazenamento';
    this.codigo = codigo;
  }
}

// Registro exato persistido no object store "sessoes" (sem nome, sem autorização de imagem)
export interface RegistroSessaoDb {
  id_participante: string;
  linhas: LinhaSessao[];
  versao_esquema: 1;
  versao_app: string;
}

export interface EsquemaMundoUteroDb extends DBSchema {
  sessoes: {
    key: string;
    value: RegistroSessaoDb;
  };
}

/**
 * Obtém a versão do build do aplicativo injetada pelo Vite (com fallback seguro para ambiente de testes).
 */
export function obterVersaoApp(): string {
  return typeof __BUILD_VERSION__ !== 'undefined'
    ? __BUILD_VERSION__
    : 'dev-test';
}

/**
 * Abre o banco IndexedDB (nome configurável, versão 1) com função upgrade preparada para futuras migrações.
 */
export async function abrirBanco(
  nomeDb: string = NOME_DB_PADRAO
): Promise<IDBPDatabase<EsquemaMundoUteroDb>> {
  if (typeof indexedDB === 'undefined' || !indexedDB) {
    throw new ErroArmazenamento(
      'indisponivel',
      'IndexedDB não está disponível neste ambiente ou navegador.'
    );
  }

  try {
    return await openDB<EsquemaMundoUteroDb>(nomeDb, VERSAO_DB, {
      upgrade(db, oldVersion) {
        // Migração inicial (v0 -> v1): cria o object store "sessoes" com keyPath "id_participante"
        if (oldVersion < 1) {
          if (!db.objectStoreNames.contains(STORE_SESSOES)) {
            db.createObjectStore(STORE_SESSOES, {
              keyPath: 'id_participante',
            });
          }
        }
        // Futuras migrações (oldVersion < 2, etc.) devem ser adicionadas abaixo
      },
    });
  } catch (erro) {
    if (erro instanceof ErroArmazenamento) {
      throw erro;
    }
    const detalhe = erro instanceof Error ? erro.message : String(erro);
    throw new ErroArmazenamento(
      'abertura',
      `Falha ao abrir o banco IndexedDB "${nomeDb}": ${detalhe}`
    );
  }
}
