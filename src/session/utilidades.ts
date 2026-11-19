import { TRACKS } from '../content/tracks';
import { TOTAL_PARES } from './config';
import { LinhaSessao, SessaoConcluida } from './tipos';

const CHAVES_ESPERADAS_LINHA: readonly (keyof LinhaSessao)[] = [
  'id_participante',
  'data_hora',
  'ordem_musica',
  'musica',
  'reconheceu',
  'tipo_pergunta_2',
  'resposta_pergunta_2',
  'repeticoes_editado',
  'repeticoes_original',
];

/**
 * Formata o número sequencial do participante com padding mínimo de 2 dígitos.
 * Ex.: 1 -> "Participante_01", 99 -> "Participante_99", 100 -> "Participante_100".
 */
export function formatarIdParticipante(n: number): string {
  const inteiro = Math.max(1, Math.trunc(n));
  return `Participante_${String(inteiro).padStart(2, '0')}`;
}

/**
 * Formata um objeto Date como "YYYY-MM-DD HH:mm:ss" no fuso horário LOCAL do dispositivo.
 */
export function formatarDataHora(d: Date): string {
  const pad2 = (v: number) => String(v).padStart(2, '0');
  const ano = d.getFullYear();
  const mes = pad2(d.getMonth() + 1);
  const dia = pad2(d.getDate());
  const hora = pad2(d.getHours());
  const min = pad2(d.getMinutes());
  const seg = pad2(d.getSeconds());
  return `${ano}-${mes}-${dia} ${hora}:${min}:${seg}`;
}

/**
 * Valida estruturalmente uma SessaoConcluida antes ou depois da persistência.
 */
export function validarSessao(s: SessaoConcluida): {
  ok: boolean;
  erros: string[];
} {
  const erros: string[] = [];

  const chavesObjeto = Object.keys(s);
  if (
    chavesObjeto.length !== 2 ||
    !chavesObjeto.includes('id_participante') ||
    !chavesObjeto.includes('linhas')
  ) {
    erros.push('SessaoConcluida possui chaves inválidas ou extras.');
  }

  if (!s.id_participante || typeof s.id_participante !== 'string') {
    erros.push('id_participante ausente ou inválido na sessão.');
  }

  if (!Array.isArray(s.linhas) || s.linhas.length !== TOTAL_PARES) {
    erros.push(
      `A sessão deve conter exatamente ${TOTAL_PARES} linhas (encontrado: ${
        Array.isArray(s.linhas) ? s.linhas.length : 0
      }).`
    );
    return { ok: false, erros };
  }

  s.linhas.forEach((linha, idx) => {
    const ordemEsperada = idx + 1;
    const trackEsperada = TRACKS[idx];

    const chavesLinha = Object.keys(linha);
    const chavesExtras = chavesLinha.filter(
      (k) => !CHAVES_ESPERADAS_LINHA.includes(k as keyof LinhaSessao)
    );
    const chavesFaltantes = CHAVES_ESPERADAS_LINHA.filter(
      (k) => !chavesLinha.includes(k)
    );

    if (chavesExtras.length > 0) {
      erros.push(
        `Linha ${ordemEsperada}: chaves extras não permitidas (${chavesExtras.join(', ')}).`
      );
    }
    if (chavesFaltantes.length > 0) {
      erros.push(
        `Linha ${ordemEsperada}: chaves obrigatórias ausentes (${chavesFaltantes.join(', ')}).`
      );
    }

    if (linha.id_participante !== s.id_participante) {
      erros.push(
        `Linha ${ordemEsperada}: id_participante (${linha.id_participante}) difere da sessão (${s.id_participante}).`
      );
    }

    if (linha.ordem_musica !== ordemEsperada) {
      erros.push(
        `Linha ${ordemEsperada}: ordem_musica esperada ${ordemEsperada}, encontrada ${linha.ordem_musica}.`
      );
    }

    if (!trackEsperada || linha.musica !== trackEsperada.rotulo) {
      erros.push(
        `Linha ${ordemEsperada}: rótulo de música inválido ("${linha.musica}", esperado "${trackEsperada?.rotulo}").`
      );
    }

    if (linha.reconheceu !== 'Sim' && linha.reconheceu !== 'Não') {
      erros.push(`Linha ${ordemEsperada}: valor inválido para reconheceu.`);
    }

    const tipoP2Esperado =
      linha.reconheceu === 'Sim' ? 'Acertou' : 'Surpreendeu';
    if (linha.tipo_pergunta_2 !== tipoP2Esperado) {
      erros.push(
        `Linha ${ordemEsperada}: tipo_pergunta_2 ("${linha.tipo_pergunta_2}") incoerente com reconheceu ("${linha.reconheceu}").`
      );
    }

    if (
      linha.resposta_pergunta_2 !== 'Sim' &&
      linha.resposta_pergunta_2 !== 'Não'
    ) {
      erros.push(
        `Linha ${ordemEsperada}: valor inválido para resposta_pergunta_2.`
      );
    }

    if (
      !Number.isInteger(linha.repeticoes_editado) ||
      linha.repeticoes_editado < 0
    ) {
      erros.push(
        `Linha ${ordemEsperada}: repeticoes_editado deve ser inteiro >= 0.`
      );
    }

    if (
      !Number.isInteger(linha.repeticoes_original) ||
      linha.repeticoes_original < 0
    ) {
      erros.push(
        `Linha ${ordemEsperada}: repeticoes_original deve ser inteiro >= 0.`
      );
    }
  });

  return {
    ok: erros.length === 0,
    erros,
  };
}
