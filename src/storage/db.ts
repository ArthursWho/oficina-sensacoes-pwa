import { DBSchema, IDBPDatabase, openDB } from 'idb';
import { LinhaSessao } from '../session/tipos';
import { NOME_BANCO_PRODUCAO } from './nomesBanco';

// NÃO ALTERE o nome de produção depois do início da coleta: mudar o nome esconde as sessões já gravadas
export const NOME_DB_PADRAO = NOME_BANCO_PRODUCAO;
export const VERSAO_DB = 2;
export const STORE_SESSOES = 'sessoes';
export const STORE_META = 'meta';

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

// Registro de metadados de exportação no object store "meta" (v2)
export interface RegistroUltimaExportacao {
  chave: 'ultimaExportacao';
  em: string;
  ids: string[];
}

// Registro de preferências do operador no object store "meta" (v2)
export interface RegistroPreferenciasDb {
  chave: 'preferencias';
  efeitosUi: boolean;
}

export type RegistroMetaDb = RegistroUltimaExportacao | RegistroPreferenciasDb;

export interface EsquemaMundoUteroDb extends DBSchema {
  sessoes: {
    key: string;
    value: RegistroSessaoDb;
  };
  meta: {
    key: string;
    value: RegistroMetaDb;
  };
}

/**
 * Obtém a versão do build do aplicativo injetada pelo Vite (formato "1.0.0+<sha>" ou "1.0.0+sem-git").
 */
export function obterVersaoApp(): string {
  return typeof __BUILD_VERSION__ !== 'undefined'
    ? __BUILD_VERSION__
    : '1.0.0+sem-git';
}

/**
 * Obtém a data/hora ISO do build injetada pelo Vite.
 */
export function obterDataBuildApp(): string {
  return typeof __BUILD_TIMESTAMP__ !== 'undefined'
    ? __BUILD_TIMESTAMP__
    : 'dev-local';
}

/**
 * Abre o banco IndexedDB (nome configurável, versão 2) preservando "sessoes" e criando "meta".
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
        // Migração v0 -> v1: cria o object store "sessoes" com keyPath "id_participante"
        if (oldVersion < 1) {
          if (!db.objectStoreNames.contains(STORE_SESSOES)) {
            db.createObjectStore(STORE_SESSOES, {
              keyPath: 'id_participante',
            });
          }
        }
        // Migração v1 -> v2: mantém "sessoes" intacto e cria o store "meta" com keyPath "chave"
        if (oldVersion < 2) {
          if (!db.objectStoreNames.contains(STORE_META)) {
            db.createObjectStore(STORE_META, {
              keyPath: 'chave',
            });
          }
        }
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
