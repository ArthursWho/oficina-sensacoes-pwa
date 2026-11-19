import { LinhaSessao, SessaoConcluida } from '../session/tipos';

// As 9 colunas oficiais da exportação, na ordem exata exigida
export const COLUNAS = [
  'id_participante',
  'data_hora',
  'ordem_musica',
  'musica',
  'reconheceu',
  'tipo_pergunta_2',
  'resposta_pergunta_2',
  'repeticoes_editado',
  'repeticoes_original',
] as const;

export type ColunaExportacao = (typeof COLUNAS)[number];

function extrairNumeroParticipante(id: string): number {
  const match = /(\d+)$/.exec(id);
  if (!match) return 0;
  const num = Number.parseInt(match[1], 10);
  return Number.isNaN(num) ? 0 : num;
}

/**
 * Achata uma lista de sessões concluídas em formato longo (1 linha por música por participante),
 * ordenadas numericamente pelo número do participante e, dentro de cada sessão, por ordem_musica.
 * Retorna objetos contendo estritamente as 9 colunas de COLUNAS.
 */
export function achatarSessoes(
  sessoes: readonly SessaoConcluida[]
): LinhaSessao[] {
  if (!sessoes || sessoes.length === 0) {
    return [];
  }

  const sessoesOrdenadas = [...sessoes].sort(
    (a, b) =>
      extrairNumeroParticipante(a.id_participante) -
      extrairNumeroParticipante(b.id_participante)
  );

  const resultado: LinhaSessao[] = [];

  for (const sessao of sessoesOrdenadas) {
    const linhasOrdenadas = [...sessao.linhas].sort(
      (a, b) => a.ordem_musica - b.ordem_musica
    );

    for (const l of linhasOrdenadas) {
      resultado.push({
        id_participante: l.id_participante,
        data_hora: l.data_hora,
        ordem_musica: Math.trunc(l.ordem_musica),
        musica: l.musica,
        reconheceu: l.reconheceu,
        tipo_pergunta_2: l.tipo_pergunta_2,
        resposta_pergunta_2: l.resposta_pergunta_2,
        repeticoes_editado: Math.trunc(l.repeticoes_editado),
        repeticoes_original: Math.trunc(l.repeticoes_original),
      });
    }
  }

  return resultado;
}
