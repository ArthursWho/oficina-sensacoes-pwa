/**
 * Gera o nome padronizado do arquivo de exportação em horário LOCAL:
 * "mundo-utero_YYYYMMDD-HHmmss_Nsessoes.ext"
 */
export function nomeArquivoExportacao(
  ext: 'csv' | 'xlsx',
  agora: Date,
  totalSessoes: number
): string {
  const pad2 = (v: number) => String(v).padStart(2, '0');
  const ano = agora.getFullYear();
  const mes = pad2(agora.getMonth() + 1);
  const dia = pad2(agora.getDate());
  const hora = pad2(agora.getHours());
  const min = pad2(agora.getMinutes());
  const seg = pad2(agora.getSeconds());

  const n = Math.max(0, Math.trunc(totalSessoes));
  return `mundo-utero_${ano}${mes}${dia}-${hora}${min}${seg}_${n}sessoes.${ext}`;
}
