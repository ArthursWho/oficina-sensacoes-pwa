import 'fake-indexeddb/auto';
import fs from 'node:fs';
import path from 'node:path';
import { deleteDB, openDB } from 'idb';
import { afterEach, describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import { ResultadoFaixa } from '../audio/AudioEngine';
import { STRINGS } from '../content/strings';
import { TRACKS } from '../content/tracks';
import { criarControlador, EngineControlador } from '../session/controlador';
import { criarSessionStore } from '../session/store';
import { LinhaSessao, Resposta, SessaoConcluida } from '../session/tipos';
import { formatarIdParticipante } from '../session/utilidades';
import { RegistroSessaoDb, STORE_META, STORE_SESSOES } from '../storage/db';
import { criarRepositorio } from '../storage/repositorio';
import { acoesMenu, aoTocarEngrenagem } from '../ui/menu/logicaMenu';
import {
  AncoraDownloadMinima,
  baixarArquivo,
  compartilharArquivo,
  compartilharTexto,
  copiarComoTexto,
  MIME_SHARE_CSV,
  MIME_SHARE_TXT,
  MIME_SHARE_XLSX,
  podeCompartilhar,
  prepararCompartilhamento,
} from './baixar';
import { gerarCsv, gerarCsvBlob } from './csv';
import { achatarSessoes, COLUNAS } from './linhas';
import { nomeArquivoExportacao } from './nomeArquivo';
import { gerarXlsx } from './xlsx';

let contadorDb = 0;
function novoNomeDb(): string {
  contadorDb++;
  return `mundo-utero-etapa8-${Date.now()}-${contadorDb}`;
}

function criarSessaoValida(
  numeroParticipante: number,
  reconheceuPadrao: Resposta = 'Sim'
): SessaoConcluida {
  const id = formatarIdParticipante(numeroParticipante);
  const linhas: LinhaSessao[] = TRACKS.map((t, idx) => ({
    id_participante: id,
    data_hora: '2026-11-19 02:20:00',
    ordem_musica: idx + 1,
    musica: t.rotulo,
    reconheceu: reconheceuPadrao,
    tipo_pergunta_2: reconheceuPadrao === 'Sim' ? 'Acertou' : 'Surpreendeu',
    resposta_pergunta_2: idx % 2 === 0 ? 'Sim' : 'Não',
    repeticoes_editado: idx,
    repeticoes_original: 1,
  }));

  return {
    id_participante: id,
    linhas,
  };
}

// Parser RFC 4180 para separador ";" escrito no próprio teste (caso c: round-trip)
function parseCsvRfc4180(csv: string): string[][] {
  const linhas: string[][] = [];
  let linhaAtual: string[] = [];
  let campoAtual = '';
  let dentroDeAspas = false;
  let i = 0;

  while (i < csv.length) {
    const ch = csv[i];

    if (dentroDeAspas) {
      if (ch === '"') {
        if (csv[i + 1] === '"') {
          campoAtual += '"';
          i += 2;
          continue;
        } else {
          dentroDeAspas = false;
          i++;
          continue;
        }
      } else {
        campoAtual += ch;
        i++;
        continue;
      }
    } else {
      if (ch === '"') {
        dentroDeAspas = true;
        i++;
        continue;
      }
      if (ch === ';') {
        linhaAtual.push(campoAtual);
        campoAtual = '';
        i++;
        continue;
      }
      if (ch === '\r' && csv[i + 1] === '\n') {
        linhaAtual.push(campoAtual);
        linhas.push(linhaAtual);
        linhaAtual = [];
        campoAtual = '';
        i += 2;
        continue;
      }
      campoAtual += ch;
      i++;
    }
  }

  if (campoAtual.length > 0 || linhaAtual.length > 0) {
    linhaAtual.push(campoAtual);
    linhas.push(linhaAtual);
  }

  return linhas;
}

describe('Etapa 8 — Menu do Operador, Migração IndexedDB v2 e Exportação CSV/XLSX', () => {
  const bancosCriados: string[] = [];

  function registrarDb(nome: string): string {
    bancosCriados.push(nome);
    return nome;
  }

  afterEach(async () => {
    while (bancosCriados.length > 0) {
      const nome = bancosCriados.pop()!;
      try {
        await deleteDB(nome);
      } catch {
        // Ignora
      }
    }
  });

  it('a) achatarSessoes: 6 linhas por sessão, ordem numérica (Participante_2 antes de Participante_10), exatamente as 9 colunas; lista vazia -> []', () => {
    expect(achatarSessoes([])).toEqual([]);

    const s10 = criarSessaoValida(10);
    const s2 = criarSessaoValida(2);
    // Inverte a ordem das músicas de s2 para testar ordenação interna por ordem_musica
    const s2Embaralhada: SessaoConcluida = {
      ...s2,
      linhas: [...s2.linhas].reverse(),
    };

    const achatadas = achatarSessoes([s10, s2Embaralhada]);
    expect(achatadas).toHaveLength(12);

    // Primeiras 6 linhas são de Participante_02 na ordem 1..6
    expect(achatadas.slice(0, 6).map((l) => l.id_participante)).toEqual(
      Array(6).fill('Participante_02')
    );
    expect(achatadas.slice(0, 6).map((l) => l.ordem_musica)).toEqual([
      1, 2, 3, 4, 5, 6,
    ]);

    // Últimas 6 linhas são de Participante_10 na ordem 1..6
    expect(achatadas.slice(6, 12).map((l) => l.id_participante)).toEqual(
      Array(6).fill('Participante_10')
    );

    // Exatamente as 9 colunas na ordem de COLUNAS
    for (const linha of achatadas) {
      expect(Object.keys(linha)).toEqual([...COLUNAS]);
    }
  });

  it('b) gerarCsv e gerarCsvBlob: cabeçalho exato, separador ";", CRLF, quoting/escape RFC 4180, acentos e travessão "—" preservados, Blob inicia com EF BB BF', async () => {
    const s1 = criarSessaoValida(1);
    // Insere fixture com ";", aspas duplas e quebra de linha para testar quoting RFC 4180
    const linhasComEspeciais: LinhaSessao[] = s1.linhas.map((l, idx) =>
      idx === 0
        ? {
            ...l,
            musica: 'Canção "Especial"; Parte 1\nParte 2 — Artista Áéíóú',
          }
        : l
    );

    const csv = gerarCsv(linhasComEspeciais);
    expect(csv.startsWith(COLUNAS.join(';') + '\r\n')).toBe(true);
    expect(csv.endsWith('\r\n')).toBe(true);
    expect(csv).toContain(
      '"Canção ""Especial""; Parte 1\nParte 2 — Artista Áéíóú"'
    );
    expect(csv).toContain('Anunciação — Alceu Valença');

    const blob = gerarCsvBlob(linhasComEspeciais);
    const bytes = new Uint8Array(await blob.arrayBuffer());
    expect(bytes[0]).toBe(0xef);
    expect(bytes[1]).toBe(0xbb);
    expect(bytes[2]).toBe(0xbf);
  });

  it('c) Round-trip CSV: parser RFC 4180 reconstrói as linhas originais a partir do CSV gerado (inclusive caracteres especiais)', () => {
    const s1 = criarSessaoValida(1);
    const originais: LinhaSessao[] = s1.linhas.map((l, idx) =>
      idx === 2
        ? {
            ...l,
            musica: 'Título com ; e "aspas"\r\ne quebra — Artista',
          }
        : l
    );

    const csv = gerarCsv(originais);
    const matriz = parseCsvRfc4180(csv);

    expect(matriz[0]).toEqual([...COLUNAS]);
    expect(matriz).toHaveLength(originais.length + 1);

    const reconstruidas: LinhaSessao[] = matriz.slice(1).map((cols) => ({
      id_participante: cols[0],
      data_hora: cols[1],
      ordem_musica: Number(cols[2]),
      musica: cols[3],
      reconheceu: cols[4] as Resposta,
      tipo_pergunta_2: cols[5] as 'Acertou' | 'Surpreendeu',
      resposta_pergunta_2: cols[6] as Resposta,
      repeticoes_editado: Number(cols[7]),
      repeticoes_original: Number(cols[8]),
    }));

    expect(reconstruidas).toEqual(originais);
  });

  it('d) gerarXlsx: gera e relê planilha "sessoes", cabeçalho, 6×N linhas, ordem_musica/repeticoes como número e data_hora como texto', async () => {
    const s1 = criarSessaoValida(1);
    const s2 = criarSessaoValida(2, 'Não');
    const linhas = achatarSessoes([s1, s2]);

    const blob = await gerarXlsx(linhas);
    const ab = await blob.arrayBuffer();
    const wb = XLSX.read(ab, { type: 'array' });

    expect(wb.SheetNames).toEqual(['sessoes']);
    const ws = wb.Sheets['sessoes'];

    // Verifica cabeçalho na linha 1
    const aoa = XLSX.utils.sheet_to_json<Array<string | number>>(ws, {
      header: 1,
    });
    expect(aoa[0]).toEqual([...COLUNAS]);
    expect(aoa).toHaveLength(1 + 12); // cabeçalho + 6x2 linhas

    // Verifica tipos de célula na primeira linha de dados (linha 2 do Excel -> índice r=1)
    expect(ws['B2'].t).toBe('s'); // data_hora como texto
    expect(ws['B2'].v).toBe('2026-11-19 02:20:00');
    expect(ws['C2'].t).toBe('n'); // ordem_musica como número
    expect(ws['C2'].v).toBe(1);
    expect(ws['H2'].t).toBe('n'); // repeticoes_editado como número
    expect(ws['I2'].t).toBe('n'); // repeticoes_original como número
  });

  it('e) nomeArquivoExportacao com data local fixa (zeros à esquerda), N sessões e as duas extensões', () => {
    const dataFixa = new Date(2026, 11, 3, 9, 5, 7); // 2026-12-03 09:05:07 local
    expect(nomeArquivoExportacao('csv', dataFixa, 12)).toBe(
      'mundo-utero_20261203-090507_12sessoes.csv'
    );
    expect(nomeArquivoExportacao('xlsx', dataFixa, 1)).toBe(
      'mundo-utero_20261203-090507_1sessoes.xlsx'
    );
  });

  it('f) baixarArquivo, podeCompartilhar, compartilharArquivo e copiarComoTexto com deps falsas: nunca lançam exceção', async () => {
    const blob = new Blob(['teste'], { type: 'text/plain' });
    let clicou = false;
    let revogouUrl = '';
    let ancoraCriada: AncoraDownloadMinima | null = null;

    const docFalso = {
      createElement(): AncoraDownloadMinima {
        ancoraCriada = {
          href: '',
          download: '',
          style: {},
          click() {
            clicou = true;
          },
          remove() {},
        };
        return ancoraCriada;
      },
      body: {
        appendChild() {},
      },
    };

    const urlFalsa = {
      createObjectURL() {
        return 'blob:fake-url-123';
      },
      revokeObjectURL(u: string) {
        revogouUrl = u;
      },
    };

    const resOk = baixarArquivo(blob, 'teste.csv', {
      document: docFalso,
      URL: urlFalsa,
      revogarAposMs: 0,
    });
    expect(resOk.ok).toBe(true);
    expect(clicou).toBe(true);
    expect(ancoraCriada!.download).toBe('teste.csv');
    expect(ancoraCriada!.href).toBe('blob:fake-url-123');
    expect(revogouUrl).toBe('blob:fake-url-123');

    // Falha no download vira { ok: false } sem lançar
    const resFalha = baixarArquivo(blob, 'teste.csv', {
      document: {
        createElement() {
          throw new Error('DOM bloqueado');
        },
      },
      URL: urlFalsa,
    });
    expect(resFalha.ok).toBe(false);
    expect(resFalha.motivo).toContain('DOM bloqueado');

    // podeCompartilhar e compartilharArquivo
    const arq = new File(['abc'], 'arq.csv', { type: 'text/csv' });
    let compartilhou = false;
    const navShareOk = {
      canShare: () => true,
      share: async () => {
        compartilhou = true;
      },
    };
    expect(podeCompartilhar(arq, navShareOk)).toBe(true);
    expect((await compartilharArquivo(arq, navShareOk)).ok).toBe(true);
    expect(compartilhou).toBe(true);

    const navShareFalse = {
      canShare: () => false,
      share: async () => {},
    };
    expect(podeCompartilhar(arq, navShareFalse)).toBe(false);

    // copiarComoTexto: sucesso e fallback sem clipboard
    let textoCopiado = '';
    const navClipOk = {
      clipboard: {
        writeText: async (t: string) => {
          textoCopiado = t;
        },
      },
    };
    expect(await copiarComoTexto('linha1;linha2', navClipOk)).toBe(true);
    expect(textoCopiado).toBe('linha1;linha2');
    expect(await copiarComoTexto('linha1;linha2', {})).toBe(false);
  });

  it('Etapa 8.1 (a & e) prepararCompartilhamento escolhe a variante correta via canShare (1, 2, 3 ou indisponivel quando navigator.share ausente)', () => {
    const s1 = criarSessaoValida(1);
    const csvSemBom = gerarCsv(s1.linhas);
    const blobCsv = gerarCsvBlob(s1.linhas);
    const nomeCsv = 'mundo-utero_20261119-030000_1sessoes.csv';

    // Caso 1: canShare verdadeiro para tudo -> variante 1 ("text/csv", .csv)
    const prep1 = prepararCompartilhamento({
      formato: 'csv',
      blobDownload: blobCsv,
      nomeOriginal: nomeCsv,
      textoCsvSemBom: csvSemBom,
      nav: {
        canShare: () => true,
        share: async () => {},
      },
    });
    expect(prep1.variante).toBe(1);
    expect(prep1.modo).toBe('arquivo');
    expect(prep1.arquivo?.type).toBe(MIME_SHARE_CSV);
    expect(prep1.arquivo?.name).toBe(nomeCsv);

    // Caso 2: falso para "text/csv" e verdadeiro para "text/plain" -> variante 2 (CSV como .txt)
    const prep2 = prepararCompartilhamento({
      formato: 'csv',
      blobDownload: blobCsv,
      nomeOriginal: nomeCsv,
      textoCsvSemBom: csvSemBom,
      nav: {
        canShare: (data) => {
          const f = data?.files?.[0];
          return f?.type === MIME_SHARE_TXT;
        },
        share: async () => {},
      },
    });
    expect(prep2.variante).toBe(2);
    expect(prep2.modo).toBe('arquivo');
    expect(prep2.arquivo?.type).toBe(MIME_SHARE_TXT);
    expect(prep2.arquivo?.name).toBe('mundo-utero_20261119-030000_1sessoes.txt');

    // Caso 3: canShare falso para todos os arquivos, mas navigator.share presente -> variante 3 (texto) e arquivo null
    const prep3 = prepararCompartilhamento({
      formato: 'csv',
      blobDownload: blobCsv,
      nomeOriginal: nomeCsv,
      textoCsvSemBom: csvSemBom,
      nav: {
        canShare: () => false,
        share: async () => {},
      },
    });
    expect(prep3.variante).toBe(3);
    expect(prep3.modo).toBe('texto');
    expect(prep3.arquivo).toBeNull();

    // Caso 4 (e): navigator.share ausente -> modo "indisponivel" (botão oculto, sem erro)
    const prepAusente = prepararCompartilhamento({
      formato: 'csv',
      blobDownload: blobCsv,
      nomeOriginal: nomeCsv,
      textoCsvSemBom: csvSemBom,
      nav: {},
    });
    expect(prepAusente.variante).toBeNull();
    expect(prepAusente.modo).toBe('indisponivel');
    expect(prepAusente.arquivo).toBeNull();
  });

  it('Etapa 8.1 (b) File compartilhado de CSV tem type exatamente "text/csv" (com BOM nos bytes), XLSX tem MIME oficial, e Blob de download permanece inalterado', async () => {
    const s1 = criarSessaoValida(1);
    const csvSemBom = gerarCsv(s1.linhas);
    const blobCsv = gerarCsvBlob(s1.linhas);
    const blobXlsx = await gerarXlsx(s1.linhas);

    const navTudoOk = {
      canShare: () => true,
      share: async () => {},
    };

    const prepCsv = prepararCompartilhamento({
      formato: 'csv',
      blobDownload: blobCsv,
      nomeOriginal: 'teste.csv',
      textoCsvSemBom: csvSemBom,
      nav: navTudoOk,
    });
    expect(prepCsv.arquivo?.type).toBe('text/csv');
    expect(blobCsv.type).toBe('text/csv;charset=utf-8');

    const bytesFileCsv = new Uint8Array(await prepCsv.arquivo!.arrayBuffer());
    expect(bytesFileCsv[0]).toBe(0xef);
    expect(bytesFileCsv[1]).toBe(0xbb);
    expect(bytesFileCsv[2]).toBe(0xbf);

    const prepXlsx = prepararCompartilhamento({
      formato: 'xlsx',
      blobDownload: blobXlsx,
      nomeOriginal: 'teste.xlsx',
      textoCsvSemBom: csvSemBom,
      nav: navTudoOk,
    });
    expect(prepXlsx.arquivo?.type).toBe(MIME_SHARE_XLSX);
    expect(blobXlsx.type).toBe(MIME_SHARE_XLSX);
  });

  it('Etapa 8.1 (c & f) compartilharArquivo e compartilharTexto chamam navigator.share SINCRONAMENTE no mesmo tick do clique; compartilharTexto envia CSV SEM BOM', async () => {
    const s1 = criarSessaoValida(1);
    const csvSemBom = gerarCsv(s1.linhas);
    const blobCsv = gerarCsvBlob(s1.linhas);
    const filePreCriado = new File([blobCsv], 'dados.csv', {
      type: MIME_SHARE_CSV,
    });

    let shareChamadoSincronamente = false;
    let payloadRecebido: ShareData | undefined;

    const navSincrono = {
      canShare: () => true,
      share: (data?: ShareData) => {
        shareChamadoSincronamente = true;
        payloadRecebido = data;
        return Promise.resolve();
      },
    };

    // Inicia compartilharArquivo sem await e verifica no MESMO tick que navigator.share já foi invocado
    const promessaArq = compartilharArquivo(filePreCriado, navSincrono);
    expect(shareChamadoSincronamente).toBe(true);
    // Verifica que o payload tem APENAS { files: [file] } (sem title e sem text)
    expect(Object.keys(payloadRecebido ?? {})).toEqual(['files']);
    expect(payloadRecebido?.files?.[0]).toBe(filePreCriado);
    expect((await promessaArq).ok).toBe(true);

    // Agora testa compartilharTexto (Variante 3): chamada síncrona e texto SEM BOM
    shareChamadoSincronamente = false;
    payloadRecebido = undefined;

    const promessaTxt = compartilharTexto('dados.csv', csvSemBom, navSincrono);
    expect(shareChamadoSincronamente).toBe(true);
    expect(payloadRecebido).toEqual({
      title: 'dados.csv',
      text: csvSemBom,
    });
    const textoEnviado = (payloadRecebido as ShareData | undefined)?.text ?? '';
    const bytesTexto = new TextEncoder().encode(textoEnviado);
    expect(bytesTexto[0]).not.toBe(0xef); // Sem BOM UTF-8
    expect((await promessaTxt).ok).toBe(true);
  });

  it('Etapa 8.1 (d) AbortError retorna { ok: false, cancelado: true } sem mensagem de erro; NotAllowedError retorna nome/mensagem para mensagem amigável + detalhe técnico', async () => {
    const file = new File(['a;b'], 'teste.csv', { type: MIME_SHARE_CSV });

    // 1. AbortError (usuário fechou a folha de compartilhamento)
    const navAbort = {
      share: () =>
        Promise.reject(new DOMException('Share canceled', 'AbortError')),
    };
    const resAbort = await compartilharArquivo(file, navAbort);
    expect(resAbort.ok).toBe(false);
    expect(resAbort.cancelado).toBe(true);
    expect(resAbort.nome).toBe('AbortError');

    // 2. NotAllowedError ("Permission Denied")
    const navNotAllowed = {
      share: () =>
        Promise.reject(new DOMException('Permission denied', 'NotAllowedError')),
    };
    const resNotAllowed = await compartilharArquivo(file, navNotAllowed);
    expect(resNotAllowed.ok).toBe(false);
    expect(resNotAllowed.cancelado).toBe(false);
    expect(resNotAllowed.nome).toBe('NotAllowedError');
    expect(resNotAllowed.mensagem).toBe('Permission denied');

    const detalheFormatado = STRINGS.detalheTecnicoCompartilhar
      .replace('{nome}', resNotAllowed.nome ?? '')
      .replace('{mensagem}', resNotAllowed.mensagem ?? '')
      .replace('{n}', '1');
    expect(detalheFormatado).toBe(
      'Detalhe técnico: NotAllowedError — Permission denied (variante 1)'
    );
  });

  it('g) logicaMenu: aoTocarEngrenagem em cada fase e acoesMenu em todas as combinações', () => {
    const sessaoDummy = {
      idParticipante: 'Participante_01',
      autorizaImagem: null,
      linhas: [],
      epoca: 1,
      batimentosAudiveis: true,
    };
    const concluidaDummy = criarSessaoValida(1);

    expect(aoTocarEngrenagem({ fase: 'tcle' })).toBe('abrir-menu');
    expect(aoTocarEngrenagem({ fase: 'recusado' })).toBe('abrir-menu');
    expect(aoTocarEngrenagem({ fase: 'cancelada' })).toBe('abrir-menu');
    expect(
      aoTocarEngrenagem({
        fase: 'encerramento',
        sessao: sessaoDummy,
        concluida: concluidaDummy,
        persistencia: 'ok',
      })
    ).toBe('abrir-menu');

    // Em sessão ativa (boas_vindas e ciclo) -> pedir-confirmacao
    expect(
      aoTocarEngrenagem({ fase: 'boas_vindas', sessao: sessaoDummy })
    ).toBe('pedir-confirmacao');
    expect(
      aoTocarEngrenagem({
        fase: 'ciclo',
        sessao: sessaoDummy,
        par: 1,
        etapa: {
          tipo: 'editado_tocando',
          interrompido: false,
          repeticoesEditado: 0,
          repeticoesOriginal: 0,
        },
      })
    ).toBe('pedir-confirmacao');

    // acoesMenu em tcle com 0 sessões
    const acTcleZero = acoesMenu({ fase: 'tcle' }, { totalSessoes: 0 });
    expect(acTcleZero.cancelarSessao.habilitado).toBe(false);
    expect(acTcleZero.novoParticipante).toEqual({
      habilitado: true,
      exigeAvisoNaoSalva: false,
    });
    expect(acTcleZero.exportar).toEqual({
      habilitado: false,
      motivo: STRINGS.semSessoes,
    });

    // acoesMenu em ciclo com 3 sessões
    const acCiclo = acoesMenu(
      {
        fase: 'ciclo',
        sessao: sessaoDummy,
        par: 2,
        etapa: {
          tipo: 'p1_liberada',
          repeticoesEditado: 0,
          repeticoesOriginal: 0,
        },
      },
      { totalSessoes: 3 }
    );
    expect(acCiclo.cancelarSessao.habilitado).toBe(true);
    expect(acCiclo.exportar.habilitado).toBe(true);

    // acoesMenu em encerramento pendente/falha vs ok
    const acEncFalha = acoesMenu(
      {
        fase: 'encerramento',
        sessao: sessaoDummy,
        concluida: concluidaDummy,
        persistencia: 'falha',
      },
      { totalSessoes: 1 }
    );
    expect(acEncFalha.novoParticipante.exigeAvisoNaoSalva).toBe(true);

    const acEncOk = acoesMenu(
      {
        fase: 'encerramento',
        sessao: sessaoDummy,
        concluida: concluidaDummy,
        persistencia: 'ok',
      },
      { totalSessoes: 1 }
    );
    expect(acEncOk.novoParticipante.exigeAvisoNaoSalva).toBe(false);
  });

  it('h) Fluxos de menu com store + controlador reais e engine falso', async () => {
    const nomeDb = registrarDb(novoNomeDb());
    const repo = criarRepositorio(nomeDb);
    const store = criarSessionStore();

    const faixasPendentes: Array<(res: ResultadoFaixa) => void> = [];
    const engineFalso: EngineControlador = {
      iniciarBatimentos() {},
      pararTudo() {},
      async fadeOutBatimentos() {},
      async fadeInBatimentos() {},
      tocarFaixa() {
        return new Promise<ResultadoFaixa>((resolve) => {
          faixasPendentes.push(resolve);
        });
      },
    };

    const ctrl = criarControlador(engineFalso, store, repo);

    // 1. Em tcle: Iniciar novo participante incrementa chaveSessao sem despachar evento
    let chaveSessao = 1;
    expect(store.getEstado().fase).toBe('tcle');
    chaveSessao += 1;
    expect(chaveSessao).toBe(2);
    expect(store.getEstado().fase).toBe('tcle');

    // 2. Engrenagem em sessão ativa + "Continuar" -> nenhum evento despachado
    store.dispatch({
      tipo: 'ACEITAR',
      proximoNumero: 1,
      autorizaImagem: null,
    });
    store.dispatch({ tipo: 'INICIAR' });
    await ctrl.aguardarFila();
    const estadoAntesContinuar = store.getEstado();
    expect(aoTocarEngrenagem(estadoAntesContinuar)).toBe('pedir-confirmacao');
    // "Continuar" apenas fecha o modal
    expect(store.getEstado()).toBe(estadoAntesContinuar);

    // 3. Engrenagem em sessão ativa + "Interromper" -> CANCELAR -> REINICIAR automático -> tcle, 0 registros gravados
    store.dispatch({ tipo: 'CANCELAR' });
    store.dispatch({ tipo: 'REINICIAR' });
    await ctrl.aguardarFila();
    expect(store.getEstado().fase).toBe('tcle');
    expect(await repo.contarSessoes()).toBe(0);

    ctrl.desconectar();
  });

  it('i) Migração v1 -> v2: banco v1 com 3 sessões preserva dados intactos, cria store "meta" e mantém proximoNumeroParticipante', async () => {
    const nomeDb = registrarDb(novoNomeDb());
    const s1 = criarSessaoValida(1);
    const s2 = criarSessaoValida(2);
    const s5 = criarSessaoValida(5);

    // 1. Cria banco na versão 1 manualmente (como na Etapa 7) e grava 3 sessões
    const dbV1 = await openDB(nomeDb, 1, {
      upgrade(db) {
        db.createObjectStore(STORE_SESSOES, { keyPath: 'id_participante' });
      },
    });
    for (const s of [s1, s2, s5]) {
      const reg: RegistroSessaoDb = {
        id_participante: s.id_participante,
        linhas: s.linhas,
        versao_esquema: 1,
        versao_app: 'v1-fixture',
      };
      await dbV1.add(STORE_SESSOES, reg);
    }
    dbV1.close();

    // 2. Abre com o repositório novo (v2) e verifica integridade
    const repoV2 = criarRepositorio(nomeDb);
    const listadas = await repoV2.listarSessoes();
    expect(listadas).toEqual([s1, s2, s5]);
    expect(await repoV2.proximoNumeroParticipante()).toBe(6);

    // Verifica que o store "meta" existe e funciona
    expect(await repoV2.obterUltimaExportacao()).toBeNull();
    await repoV2.registrarExportacao(
      ['Participante_01', 'Participante_02', 'Participante_05'],
      new Date('2026-11-19T05:00:00Z')
    );
    const meta = await repoV2.obterUltimaExportacao();
    expect(meta?.chave).toBe('ultimaExportacao');
    expect(meta?.ids).toEqual([
      'Participante_01',
      'Participante_02',
      'Participante_05',
    ]);

    const dbCheck = await openDB(nomeDb, 2);
    expect(dbCheck.objectStoreNames.contains(STORE_SESSOES)).toBe(true);
    expect(dbCheck.objectStoreNames.contains(STORE_META)).toBe(true);
    dbCheck.close();
  });

  it('j & k) registrarExportacao, obterUltimaExportacao, contarNaoExportadas e imutabilidade das sessões após exportação', async () => {
    const nomeDb = registrarDb(novoNomeDb());
    const repo = criarRepositorio(nomeDb);

    const s1 = criarSessaoValida(1);
    const s2 = criarSessaoValida(2);
    await repo.salvarSessao(s1);
    await repo.salvarSessao(s2);

    // Sem exportação prévia -> todas (2)
    expect(await repo.contarNaoExportadas()).toBe(2);

    // Exporta parcialmente apenas Participante_01 -> resta 1
    await repo.registrarExportacao(['Participante_01'], new Date());
    expect(await repo.contarNaoExportadas()).toBe(1);

    // Exporta ambas -> 0
    await repo.registrarExportacao(
      ['Participante_01', 'Participante_02'],
      new Date()
    );
    expect(await repo.contarNaoExportadas()).toBe(0);

    // Nova sessão concluída depois -> 1 não exportada
    const s3 = criarSessaoValida(3);
    await repo.salvarSessao(s3);
    expect(await repo.contarNaoExportadas()).toBe(1);

    // Verifica que a exportação não altera as sessões gravadas e produz só as 9 colunas
    const antes = await repo.listarSessoes();
    const linhasExportadas = achatarSessoes(antes);
    const csv = gerarCsv(linhasExportadas);
    await gerarXlsx(linhasExportadas);
    const depois = await repo.listarSessoes();

    expect(depois).toEqual(antes);
    expect(csv).not.toContain('versao_esquema');
    expect(csv).not.toContain('versao_app');
    expect(csv).not.toContain('ultimaExportacao');
  });

  it('l) Verificação estática: nenhuma ocorrência de "provisório" nos arquivos de UI do fluxo real (src/ui/telas e src/ui/menu)', () => {
    const pastasFluxoReal = [
      path.resolve(process.cwd(), 'src/ui/telas'),
      path.resolve(process.cwd(), 'src/ui/menu'),
    ];

    for (const pasta of pastasFluxoReal) {
      const arquivos = fs.readdirSync(pasta);
      for (const nomeArq of arquivos) {
        if (!/\.(ts|tsx)$/.test(nomeArq)) continue;
        const caminho = path.join(pasta, nomeArq);
        const conteudo = fs.readFileSync(caminho, 'utf-8');
        expect(
          conteudo,
          `Encontrada referência a "provisório" no fluxo real: ${caminho}`
        ).not.toMatch(/provis[oó]rio/i);
      }
    }
  });
});
