/**
 * Gera o nome padronizado do arquivo de exportação em horário LOCAL:
 * "mundo-utero_YYYYMMDD-HHmmss_Nsessoes.ext"
 * Quando `modoEnsaio === true`, recebe o prefixo "ENSAIO_".
 */
export function nomeArquivoExportacao(
  ext: 'csv' | 'xlsx',
  agora: Date,
  totalSessoes: number,
  opcoes?: { ensaio?: boolean }
): string {
  const pad2 = (v: number) => String(v).padStart(2, '0');
  const ano = agora.getFullYear();
  const mes = pad2(agora.getMonth() + 1);
  const dia = pad2(agora.getDate());
  const hora = pad2(agora.getHours());
  const min = pad2(agora.getMinutes());
  const seg = pad2(agora.getSeconds());

  const n = Math.max(0, Math.trunc(totalSessoes));
  const prefixo = opcoes?.ensaio ? 'ENSAIO_' : '';
  return `${prefixo}mundo-utero_${ano}${mes}${dia}-${hora}${min}${seg}_${n}sessoes.${ext}`;
}
