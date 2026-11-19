import { LinhaSessao } from '../session/tipos';
import { COLUNAS } from './linhas';

const MIME_XLSX =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/**
 * Gera um arquivo XLSX em memória (Blob) carregando a biblioteca SheetJS (`xlsx`) sob demanda.
 * Usado exclusivamente para ESCRITA de dados locais validados.
 */
export async function gerarXlsx(
  linhas: readonly LinhaSessao[]
): Promise<Blob> {
  const XLSX = await import('xlsx');

  // Monta matriz AOA (array of arrays): linha 0 = cabeçalho, linhas seguintes = dados tipados
  const aoa: Array<Array<string | number>> = [
    [...COLUNAS],
    ...linhas.map((l) => [
      String(l.id_participante),
      String(l.data_hora),
      Math.trunc(l.ordem_musica),
      String(l.musica),
      String(l.reconheceu),
      String(l.tipo_pergunta_2),
      String(l.resposta_pergunta_2),
      Math.trunc(l.repeticoes_editado),
      Math.trunc(l.repeticoes_original),
    ]),
  ];

  const ws = XLSX.utils.aoa_to_sheet(aoa);

  // Garante explicitamente os tipos das células (números vs texto, especialmente data_hora como texto 's')
  const colunasNumericas = new Set([2, 7, 8]); // ordem_musica, repeticoes_editado, repeticoes_original
  for (let r = 1; r <= linhas.length; r++) {
    for (let c = 0; c < COLUNAS.length; c++) {
      const ref = XLSX.utils.encode_cell({ r, c });
      const cell = ws[ref];
      if (!cell) continue;
      if (colunasNumericas.has(c)) {
        cell.t = 'n';
        cell.v = Number(cell.v);
      } else {
        cell.t = 's';
        cell.v = String(cell.v);
      }
    }
  }

  // Larguras de coluna razoáveis para leitura imediata
  ws['!cols'] = [
    { wch: 18 }, // id_participante
    { wch: 21 }, // data_hora
    { wch: 14 }, // ordem_musica
    { wch: 44 }, // musica
    { wch: 12 }, // reconheceu
    { wch: 16 }, // tipo_pergunta_2
    { wch: 20 }, // resposta_pergunta_2
    { wch: 19 }, // repeticoes_editado
    { wch: 20 }, // repeticoes_original
  ];

  // Congela a primeira linha (cabeçalho)
  (ws as Record<string, unknown>)['!freeze'] = {
    xSplit: 0,
    ySplit: 1,
    topLeftCell: 'A2',
    activePane: 'bottomLeft',
    state: 'frozen',
  };

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'sessoes');

  const bufferOut = XLSX.write(wb, {
    bookType: 'xlsx',
    type: 'array',
  }) as ArrayBuffer;

  return new Blob([bufferOut], { type: MIME_XLSX });
}
