import 'fake-indexeddb/auto';
import { deleteDB } from 'idb';
import { afterEach, describe, expect, it } from 'vitest';
import { ResultadoFaixa } from '../audio/AudioEngine';
import { resolverRotaLaboratorio } from '../app';
import { TRACKS } from '../content/tracks';
import { nomeArquivoExportacao } from '../export/nomeArquivo';
import { TOTAL_PARES } from '../session/config';
import { criarControlador, EngineControlador } from '../session/controlador';
import { criarSessionStore } from '../session/store';
import { Estado, LinhaSessao, SessaoConcluida } from '../session/tipos';
import { formatarIdParticipante } from '../session/utilidades';
import { proximoNumeroParticipante } from '../storage/contador';
import {
  bannerModoEnsaio,
  definirModoEnsaio,
  obterModoEnsaio,
  podeAlternarEnsaio,
  resetarModoEnsaioParaTestes,
} from '../storage/ensaio';
import {
  NOME_BANCO_DESENVOLVIMENTO,
  NOME_BANCO_ENSAIO,
  NOME_BANCO_PRODUCAO,
  nomeBancoAtivo,
} from '../storage/nomesBanco';
import {
  criarProxyRepositorioAtivo,
  criarRepositorio,
} from '../storage/repositorio';
import { executarCheckRelease } from '../../scripts/check-release';
import {
  compararChecksumsAudio,
  MP3_ESPERADOS,
  verificarAusenciaLaboratorios,
  verificarIndexHtmlProducao,
  verificarManifest,
  verificarPrecacheSw,
  verificarTextosProvisoriosEPendentes,
  verificarUrlsExternas,
} from '../../scripts/verificar-dist.mjs';
import {
  DIRETIVAS_CSP_PRODUCAO,
  formatarVersaoBuild,
  gerarCspProducao,
} from './segurancaBuild';

function criarSessaoValida(numeroParticipante: number): SessaoConcluida {
  const id = formatarIdParticipante(numeroParticipante);
  const linhas: LinhaSessao[] = TRACKS.map((t, idx) => ({
    id_participante: id,
    data_hora: '2026-11-19 04:00:00',
    ordem_musica: idx + 1,
    musica: t.rotulo,
    reconheceu: 'Sim',
    tipo_pergunta_2: 'Acertou',
    resposta_pergunta_2: 'Sim',
    repeticoes_editado: 0,
    repeticoes_original: 0,
  }));

  return {
    id_participante: id,
    linhas,
  };
}

describe('Etapa 10 — Endurecimento para Produção, Modo de Ensaio e Verificação de Release', () => {
  const bancosParaLimpar = [
    NOME_BANCO_PRODUCAO,
    NOME_BANCO_ENSAIO,
    NOME_BANCO_DESENVOLVIMENTO,
  ];

  afterEach(async () => {
    resetarModoEnsaioParaTestes();
    for (const nome of bancosParaLimpar) {
      try {
        await deleteDB(nome);
      } catch {
        // Ignora
      }
    }
  });

  it('a) nomeBancoAtivo para todas as combinações e teste "âncora" do nome de produção', () => {
    expect(
      NOME_BANCO_PRODUCAO,
      'O nome do banco de produção não pode mudar depois do início da coleta'
    ).toBe('mundo-utero-coleta');

    expect(nomeBancoAtivo('producao', false)).toBe('mundo-utero-coleta');
    expect(nomeBancoAtivo('producao', true)).toBe('mundo-utero-ensaio');
    expect(nomeBancoAtivo('desenvolvimento', false)).toBe('mundo-utero-dev');
    expect(nomeBancoAtivo('desenvolvimento', true)).toBe('mundo-utero-ensaio');
  });

  it('b & c) Modo de ensaio e Proxy de repositório: estado inicial desligado, podeAlternarEnsaio só em tcle, grava em banco separado sem afetar produção e exporta com prefixo ENSAIO_', async () => {
    // Estado inicial sempre desligado
    expect(obterModoEnsaio()).toBe(false);

    // podeAlternarEnsaio só é verdadeiro na fase "tcle"
    expect(podeAlternarEnsaio({ fase: 'tcle' })).toBe(true);
    expect(podeAlternarEnsaio({ fase: 'recusado' })).toBe(false);
    expect(podeAlternarEnsaio({ fase: 'cancelada' })).toBe(false);
    expect(
      podeAlternarEnsaio({
        fase: 'boas_vindas',
        sessao: {
          idParticipante: 'Participante_01',
          autorizaImagem: null,
          linhas: [],
          epoca: 0,
          batimentosAudiveis: true,
        },
      })
    ).toBe(false);

    // Tentativa de ligar fora de tcle é bloqueada
    expect(definirModoEnsaio(true, { fase: 'recusado' })).toBe(false);
    expect(obterModoEnsaio()).toBe(false);

    // Proxy configurado em modo "producao"
    const proxy = criarProxyRepositorioAtivo(
      () => 'producao',
      () => obterModoEnsaio()
    );
    const repoProducao = criarRepositorio(NOME_BANCO_PRODUCAO);
    const repoEnsaio = criarRepositorio(NOME_BANCO_ENSAIO);

    // 1. Em produção (ensaio desligado): grava 1 sessão no banco de produção
    expect(proxy.nomeBancoVigente()).toBe('mundo-utero-coleta');
    await proxy.salvarSessao(criarSessaoValida(1));
    expect(await repoProducao.contarSessoes()).toBe(1);
    expect(await repoEnsaio.contarSessoes()).toBe(0);
    expect(await proximoNumeroParticipante(proxy)).toBe(2);

    // 2. Liga modo de ensaio na fase tcle -> contador do ensaio começa em 1 e grava em "mundo-utero-ensaio"
    expect(definirModoEnsaio(true, { fase: 'tcle' })).toBe(true);
    expect(proxy.nomeBancoVigente()).toBe('mundo-utero-ensaio');
    expect(await proximoNumeroParticipante(proxy)).toBe(1);

    // Roda uma sessão pelo controlador usando o proxy
    const store = criarSessionStore();
    const faixas: Array<(r: ResultadoFaixa) => void> = [];
    const engineFalso: EngineControlador = {
      iniciarBatimentos() {},
      pararTudo() {},
      async fadeOutBatimentos() {},
      async fadeInBatimentos() {},
      tocarFaixa() {
        return new Promise<ResultadoFaixa>((r) => faixas.push(r));
      },
    };
    const ctrl = criarControlador(engineFalso, store, proxy);

    store.dispatch({
      tipo: 'ACEITAR',
      proximoNumero: await proximoNumeroParticipante(proxy),
      autorizaImagem: null,
    });
    store.dispatch({ tipo: 'INICIAR' });
    await ctrl.aguardarFila();

    for (let par = 1; par <= TOTAL_PARES; par++) {
      faixas.shift()!('fim');
      await Promise.resolve();
      store.dispatch({ tipo: 'RESPONDER_P1', resposta: 'Sim' });
      await ctrl.aguardarFila();
      faixas.shift()!('fim');
      await Promise.resolve();
      await ctrl.aguardarFila();
      store.dispatch({
        tipo: 'RESPONDER_P2',
        resposta: 'Sim',
        agora: '2026-11-19 04:05:00',
      });
      await ctrl.aguardarFila();
      if (par < TOTAL_PARES) {
        store.dispatch({ tipo: 'TRANSICAO_FIM' });
        await ctrl.aguardarFila();
      }
    }

    // Aguarda gravação no banco de ensaio
    await new Promise((r) => setTimeout(r, 30));
    expect(await repoEnsaio.contarSessoes()).toBe(1);
    expect(await repoProducao.contarSessoes()).toBe(1); // Produção intacto!

    // Exportação em modo de ensaio recebe prefixo ENSAIO_
    const dataFixa = new Date(2026, 10, 19, 4, 5, 0);
    expect(
      nomeArquivoExportacao('csv', dataFixa, 1, { ensaio: obterModoEnsaio() })
    ).toBe('ENSAIO_mundo-utero_20261119-040500_1sessoes.csv');

    // 3. Volta ao TCLE e desliga o ensaio -> banco de produção continua intacto com próximo número = 2
    store.dispatch({ tipo: 'REINICIAR', forcar: true });
    expect(definirModoEnsaio(false, store.getEstado())).toBe(true);
    expect(proxy.nomeBancoVigente()).toBe('mundo-utero-coleta');
    expect(await proxy.contarSessoes()).toBe(1);
    expect(await proximoNumeroParticipante(proxy)).toBe(2);

    ctrl.desconectar();
  });

  it('d) Banner de ensaio: modelo de visão exibe a faixa em todas as fases quando ligado e em nenhuma quando desligado', () => {
    const estados: Estado[] = [
      { fase: 'tcle' },
      { fase: 'recusado' },
      { fase: 'cancelada' },
    ];

    for (const st of estados) {
      expect(bannerModoEnsaio(st, false)).toBeNull();
      expect(bannerModoEnsaio(st, true)).toBe(
        'MODO DE ENSAIO — os dados não entram na coleta'
      );
    }
  });

  it('e) Rotas de laboratório: em produção o roteador ignora todos os hashes; em desenvolvimento funcionam', () => {
    const hashes = [
      '#diagnostico',
      '#componentes',
      '#audio-lab',
      '#sessao-lab',
      '#armazenamento-lab',
      '#compartilhar-lab',
    ];

    for (const h of hashes) {
      expect(resolverRotaLaboratorio(h, 'producao')).toBeNull();
      expect(resolverRotaLaboratorio(h, 'desenvolvimento')).toBe(h.slice(1));
    }
    expect(resolverRotaLaboratorio('#outro', 'desenvolvimento')).toBeNull();
  });

  it('f) Funções puras de verificar-dist com fixtures: pré-cache, ausência de laboratórios, CSP/meta/robots, URLs externas, manifest e colchetes do TCLE tolerados', () => {
    // 1. Pré-cache completo vs incompleto
    const swValido = [
      ...MP3_ESPERADOS.map((u) => `{url:"${u}",revision:"1"}`),
      '{url:"index.html",revision:"1"}',
      '{url:"manifest.webmanifest",revision:"1"}',
      '{url:"icons/icon-192.png",revision:"1"}',
      '{url:"icons/icon-512.png",revision:"1"}',
      '{url:"icons/icon-512-maskable.png",revision:"1"}',
      '{url:"assets/xlsx-AbC123.js",revision:null}',
    ].join(',');
    expect(verificarPrecacheSw(swValido).ok).toBe(true);
    expect(verificarPrecacheSw('{url:"index.html"}').ok).toBe(false);

    // 2. Presença/ausência de laboratórios no dist
    expect(
      verificarAusenciaLaboratorios([
        { arquivo: 'assets/index.js', conteudo: 'console.log("app puro")' },
      ]).ok
    ).toBe(true);
    expect(
      verificarAusenciaLaboratorios([
        { arquivo: 'assets/index.js', conteudo: 'rota #audio-lab ativa' },
      ]).ok
    ).toBe(false);

    // 3. index.html com CSP, meta robots e app-version
    const htmlOk = `
      <meta http-equiv="Content-Security-Policy" content="${gerarCspProducao()}" />
      <meta name="robots" content="noindex,nofollow" />
      <meta name="app-version" content="1.0.0+abc1234" />
    `;
    expect(verificarIndexHtmlProducao(htmlOk).ok).toBe(true);
    expect(verificarIndexHtmlProducao('<html></html>').ok).toBe(false);
    expect(
      verificarIndexHtmlProducao(htmlOk + " script-src 'unsafe-eval'").ok
    ).toBe(false);

    // 4. URLs externas: permite W3C e rejeita domínio arbitrário
    expect(
      verificarUrlsExternas([
        {
          arquivo: 'index.js',
          conteudo: 'xmlns="http://www.w3.org/2000/svg"',
        },
      ]).ok
    ).toBe(true);
    expect(
      verificarUrlsExternas([
        {
          arquivo: 'index.js',
          conteudo: 'fetch("https://analytics.exemplo.com/track")',
        },
      ]).ok
    ).toBe(false);

    // 5. Manifest
    expect(
      verificarManifest({
        name: 'O Mundo a Partir do Útero',
        short_name: 'Útero',
        display_override: ['fullscreen', 'standalone'],
        icons: [
          { sizes: '192x192', purpose: 'any' },
          { sizes: '512x512', purpose: 'any' },
          { sizes: '512x512', purpose: 'maskable' },
        ],
      }).ok
    ).toBe(true);
    expect(verificarManifest({ name: 'Incompleto' }).ok).toBe(false);

    // 6. Colchetes do TCLE em src/content/tcle.ts são tolerados; "(provisório)" em src/ui/ falha
    expect(
      verificarTextosProvisoriosEPendentes([
        {
          caminhoRelativo: 'src/content/tcle.ts',
          conteudo: 'professoraNome: "[nome da professora]"',
        },
        {
          caminhoRelativo: 'src/ui/telas/TelaTcle.tsx',
          conteudo: '<button>Aceito participar</button>',
        },
      ]).ok
    ).toBe(true);

    expect(
      verificarTextosProvisoriosEPendentes([
        {
          caminhoRelativo: 'src/ui/telas/TelaEncerramento.tsx',
          conteudo: '<button>Reiniciar (provisório)</button>',
        },
      ]).ok
    ).toBe(false);
  });

  it('g) Checksums: detecta arquivo alterado, ausente e extra', () => {
    const baseTxt = 'aaaa  a.mp3\nbbbb  b.mp3\n';

    // Igual -> ok
    expect(
      compararChecksumsAudio(
        [
          { nome: 'a.mp3', hash: 'aaaa' },
          { nome: 'b.mp3', hash: 'bbbb' },
        ],
        baseTxt
      ).ok
    ).toBe(true);

    // Alterado -> falha
    expect(
      compararChecksumsAudio(
        [
          { nome: 'a.mp3', hash: 'xxxx' },
          { nome: 'b.mp3', hash: 'bbbb' },
        ],
        baseTxt
      ).ok
    ).toBe(false);

    // Ausente -> falha
    expect(
      compararChecksumsAudio([{ nome: 'a.mp3', hash: 'aaaa' }], baseTxt).ok
    ).toBe(false);

    // Extra -> falha
    expect(
      compararChecksumsAudio(
        [
          { nome: 'a.mp3', hash: 'aaaa' },
          { nome: 'b.mp3', hash: 'bbbb' },
          { nome: 'extra.mp3', hash: 'cccc' },
        ],
        baseTxt
      ).ok
    ).toBe(false);
  });

  it('h) Gerador da CSP: contém todas as diretivas exigidas e nenhuma ocorrência de unsafe-eval', () => {
    const csp = gerarCspProducao();
    for (const dir of DIRETIVAS_CSP_PRODUCAO) {
      expect(csp).toContain(dir);
    }
    expect(csp).not.toContain('unsafe-eval');
  });

  it('i) check:release sai com código 0 e imprime o aviso quando há pendências do TCLE, e imprime "sem pendências" quando não há', () => {
    const comPendencias = executarCheckRelease();
    expect(comPendencias.exitCode).toBe(0);
    expect(comPendencias.possuiPendencias).toBe(true);
    expect(comPendencias.pendencias).toHaveLength(5);
    expect(comPendencias.mensagem).toContain(
      'ATENÇÃO: o TCLE ainda contém campos pendentes'
    );

    const semPendencias = executarCheckRelease({
      professoraNome: 'Profa. Mariana',
      professoraEmail: 'mariana@univille.br',
      representanteNome: 'Arthur Santos',
      representanteContato: 'arthur@univille.br',
      enquadramentoEticoConfirmado: true,
    });
    expect(semPendencias.exitCode).toBe(0);
    expect(semPendencias.possuiPendencias).toBe(false);
    expect(semPendencias.mensagem).toContain('sem pendências');
  });

  it('j) Formato da constante de versão "x.y.z+sha" e do fallback "sem-git"', () => {
    expect(formatarVersaoBuild('1.0.0', '514ff5c99')).toBe('1.0.0+514ff5c');
    expect(formatarVersaoBuild('1.0.0', null)).toBe('1.0.0+sem-git');
    expect(formatarVersaoBuild('1.0.0', 'invalido!')).toBe('1.0.0+sem-git');
  });
});
