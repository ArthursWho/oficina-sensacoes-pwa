import { LinhaSessao } from '../session/tipos';
import { COLUNAS } from './linhas';

const SEPARADOR = ';';
const QUEBRA_LINHA = '\r\n';
const UTF8_BOM_BYTES = new Uint8Array([0xef, 0xbb, 0xbf]);

// Escapa um campo CSV conforme RFC 4180 para separador ";"
function escaparCampoCsv(valor: string | number): string {
  if (typeof valor === 'number') {
    return String(Math.trunc(valor));
  }
  const str = String(valor);
  if (
    str.includes(SEPARADOR) ||
    str.includes('"') ||
    str.includes('\r') ||
    str.includes('\n')
  ) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Gera a string CSV (sem BOM, usada para cópia de texto) com separador ";" e quebras CRLF.
 */
export function gerarCsv(linhas: readonly LinhaSessao[]): string {
  const cabecalho = COLUNAS.join(SEPARADOR);
  const linhasFormatadas = linhas.map((linha) =>
    COLUNAS.map((col) => escaparCampoCsv(linha[col])).join(SEPARADOR)
  );
  return [cabecalho, ...linhasFormatadas].join(QUEBRA_LINHA) + QUEBRA_LINHA;
}

/**
 * Cria o Blob CSV final codificado em UTF-8 COM BOM (EF BB BF) para abertura direta no Excel em pt-BR.
 */
export function gerarCsvBlob(linhas: readonly LinhaSessao[]): Blob {
  const textoCsv = gerarCsv(linhas);
  const textoBytes = new TextEncoder().encode(textoCsv);
  return new Blob([UTF8_BOM_BYTES, textoBytes], {
    type: 'text/csv;charset=utf-8',
  });
}
