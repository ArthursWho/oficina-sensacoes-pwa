import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { ALL_AUDIO_SRCS, BATIMENTOS_SRC, TRACKS } from './tracks';
import {
  construirTcle,
  listarPendencias,
  PENDENCIAS,
  TCLE_DOCUMENTO,
  temPendencias,
} from './tcle';

describe('src/content/tracks.ts', () => {
  it('possui exatamente 6 faixas com ordem 1..6 sem repetição e rótulos com travessão', () => {
    expect(TRACKS).toHaveLength(6);
    const ordens = TRACKS.map((t) => t.ordem);
    expect(ordens).toEqual([1, 2, 3, 4, 5, 6]);

    for (const track of TRACKS) {
      expect(track.rotulo).toBe(`${track.titulo} — ${track.artista}`);
      expect(track.srcEditado).toMatch(/^\.\/audio\/\d{2}_[a-z0-9_]+_editado\.mp3$/);
      expect(track.srcOriginal).toMatch(/^\.\/audio\/\d{2}_[a-z0-9_]+_original\.mp3$/);
    }
  });

  it('ALL_AUDIO_SRCS contém 13 itens únicos e todos existem fisicamente em public/audio/', () => {
    expect(BATIMENTOS_SRC).toBe('./audio/batimentos.mp3');
    expect(ALL_AUDIO_SRCS).toHaveLength(13);

    const unicos = new Set(ALL_AUDIO_SRCS);
    expect(unicos.size).toBe(13);

    const publicDir = path.resolve(process.cwd(), 'public');
    for (const src of ALL_AUDIO_SRCS) {
      const relativePath = src.replace(/^\.\//, '');
      const fullPath = path.join(publicDir, relativePath);
      expect(
        fs.existsSync(fullPath),
        `Arquivo ausente em public/: ${fullPath}`
      ).toBe(true);
    }
  });
});

describe('src/content/tcle.ts', () => {
  it('contém o texto literal das seções 1 a 12', () => {
    expect(TCLE_DOCUMENTO.titulo).toBe(
      'Termo de Consentimento Livre e Esclarecido (TCLE)'
    );
    expect(TCLE_DOCUMENTO.secoes).toHaveLength(12);

    const numeros = TCLE_DOCUMENTO.secoes.map((s) => s.numero);
    expect(numeros).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);

    const titulosEsperados = [
      'Convite',
      'Objetivo da oficina',
      'Como será a sua participação',
      'Dados coletados',
      'Riscos e desconfortos',
      'Benefícios',
      'Participação voluntária e liberdade de desistir',
      'Sigilo, anonimato e uso dos dados',
      'Enquadramento ético',
      'Contato',
      'Consentimento de participação',
      'Autorização para registro de fotos e vídeos (opcional)',
    ];
    expect(TCLE_DOCUMENTO.secoes.map((s) => s.titulo)).toEqual(titulosEsperados);

    // Verifica trechos literais importantes em todas as seções
    const secao9Texto = TCLE_DOCUMENTO.secoes[8].paragrafos?.[0] ?? '';
    expect(secao9Texto).toContain('Resolução CNS nº 510/2016');
    expect(secao9Texto).toContain(
      '[Confirmar o enquadramento com a professora responsável.]'
    );

    const secao10Itens = TCLE_DOCUMENTO.secoes[9].itensNumerados ?? [];
    expect(secao10Itens[0]).toBe(
      'Professor(a) responsável: [nome da professora] - [e-mail institucional]'
    );
    expect(secao10Itens[1]).toBe(
      'Representante do grupo: [nome] - [e-mail ou telefone]'
    );
  });

  it('com os valores padrão, temPendencias() é true e listarPendencias() retorna as 5 pendências', () => {
    expect(temPendencias()).toBe(true);
    const pendencias = listarPendencias();
    expect(pendencias).toHaveLength(5);
  });

  it('remove a nota da seção 9 e retorna temPendencias() = false quando todas as pendências são resolvidas', () => {
    const resolvido = {
      professoraNome: 'Profa. Dra. Exemplo',
      professoraEmail: 'exemplo@univille.br',
      representanteNome: 'Arthur Santos',
      representanteContato: 'arthur@univille.br',
      enquadramentoEticoConfirmado: true,
    };

    expect(temPendencias(resolvido)).toBe(false);
    expect(listarPendencias(resolvido)).toHaveLength(0);

    const docResolvido = construirTcle(resolvido);
    const secao9Texto = docResolvido.secoes[8].paragrafos?.[0] ?? '';
    expect(secao9Texto).not.toContain(
      '[Confirmar o enquadramento com a professora responsável.]'
    );
    expect(PENDENCIAS.enquadramentoEticoConfirmado).toBe(false);
  });
});
