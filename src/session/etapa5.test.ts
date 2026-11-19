import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { FADE_IN_INICIAL_MS } from '../audio/config';
import {
  garantirPreload,
  obterEstadoPreparoAudio,
  resetarPreparoAudioParaTestes,
} from '../audio/preparo';
import { ALL_AUDIO_SRCS } from '../content/tracks';
import { criarControlador, EngineControlador } from './controlador';
import { criarSessionStore } from './store';
import { montarEventoAceitar, podeAceitar } from '../ui/telas/TelaTcle';

function listarArquivosTsRecursivo(dir: string): string[] {
  const resultado: string[] = [];
  for (const entrada of fs.readdirSync(dir, { withFileTypes: true })) {
    const caminho = path.join(dir, entrada.name);
    if (entrada.isDirectory()) {
      resultado.push(...listarArquivosTsRecursivo(caminho));
    } else if (/\.(ts|tsx)$/.test(entrada.name) && !entrada.name.endsWith('.test.ts')) {
      resultado.push(caminho);
    }
  }
  return resultado;
}

describe('Etapa 5 — Telas 1 e 2, Controlador de Efeitos e Preparo de Áudio', () => {
  it('a) podeAceitar: casos com/sem consentimento, com/sem nome obrigatório e com processando = true', () => {
    // Sem consentimento -> sempre false
    expect(
      podeAceitar({
        consentiu: false,
        nome: 'Maria',
        nomeObrigatorio: false,
        processando: false,
      })
    ).toBe(false);

    // Com consentimento e nome não obrigatório -> true mesmo com nome vazio
    expect(
      podeAceitar({
        consentiu: true,
        nome: '',
        nomeObrigatorio: false,
        processando: false,
      })
    ).toBe(true);

    // Com consentimento e nome obrigatório -> false se nome vazio ou só espaços, true se preenchido
    expect(
      podeAceitar({
        consentiu: true,
        nome: '   ',
        nomeObrigatorio: true,
        processando: false,
      })
    ).toBe(false);

    expect(
      podeAceitar({
        consentiu: true,
        nome: 'Arthur',
        nomeObrigatorio: true,
        processando: false,
      })
    ).toBe(true);

    // Com processando = true -> sempre false (anti toque duplo)
    expect(
      podeAceitar({
        consentiu: true,
        nome: 'Arthur',
        nomeObrigatorio: false,
        processando: true,
      })
    ).toBe(false);
  });

  it('b) montarEventoAceitar: o evento resultante não contém nenhuma chave de nome e carrega autorizaImagem e proximoNumero corretos', () => {
    const ev1 = montarEventoAceitar(3, 'autoriza');
    expect(ev1).toEqual({
      tipo: 'ACEITAR',
      proximoNumero: 3,
      autorizaImagem: 'autoriza',
    });
    expect(Object.keys(ev1)).toEqual([
      'tipo',
      'proximoNumero',
      'autorizaImagem',
    ]);
    expect(JSON.stringify(ev1)).not.toContain('nome');

    const ev2 = montarEventoAceitar(12, null);
    expect(ev2).toEqual({
      tipo: 'ACEITAR',
      proximoNumero: 12,
      autorizaImagem: null,
    });
  });

  it('c) Controlador com engine falso: iniciarBatimentos usa FADE_IN_INICIAL_MS, pararTudo, fadeOut/fadeIn aguardados em ordem, erro isolado e avisos para efeitos futuros', async () => {
    const passos: string[] = [];

    const engineFalso: EngineControlador = {
      iniciarBatimentos(opcoes) {
        passos.push(`iniciarBatimentos:${opcoes?.fadeInMs}`);
      },
      pararTudo() {
        passos.push('pararTudo');
      },
      async fadeOutBatimentos() {
        passos.push('fadeOut:inicio');
        await new Promise((r) => setTimeout(r, 25));
        passos.push('fadeOut:fim');
      },
      async fadeInBatimentos() {
        passos.push('fadeIn:inicio');
        await new Promise((r) => setTimeout(r, 15));
        passos.push('fadeIn:fim');
      },
    };

    const store = criarSessionStore();
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const ctrl = criarControlador(engineFalso, store);

    // 1. ACEITAR -> emite iniciarBatimentos com FADE_IN_INICIAL_MS (1000)
    store.dispatch({
      tipo: 'ACEITAR',
      proximoNumero: 1,
      autorizaImagem: null,
    });
    await ctrl.aguardarFila();
    expect(passos).toEqual([`iniciarBatimentos:${FADE_IN_INICIAL_MS}`]);

    // 2. INICIAR -> emite [fadeOutBatimentos, tocarFaixa]. fadeOut deve terminar ANTES do erro/aviso de tocarFaixa
    errorSpy.mockImplementation((msg: unknown) => {
      if (String(msg).includes('tocarFaixa indisponível')) {
        passos.push('warn:efeito');
      }
    });
    store.dispatch({ tipo: 'INICIAR' });
    await ctrl.aguardarFila();
    expect(passos).toEqual([
      `iniciarBatimentos:${FADE_IN_INICIAL_MS}`,
      'fadeOut:inicio',
      'fadeOut:fim',
      'warn:efeito',
    ]);

    // 3. Um efeito que lança erro não impede os efeitos seguintes
    const engineComErro: EngineControlador = {
      ...engineFalso,
      fadeOutBatimentos: async () => {
        passos.push('fadeOut:erro');
        throw new Error('Falha simulada no fadeOut');
      },
    };
    ctrl.desconectar();
    const store2 = criarSessionStore();
    const ctrl2 = criarControlador(engineComErro, store2);

    store2.dispatch({
      tipo: 'ACEITAR',
      proximoNumero: 2,
      autorizaImagem: null,
    });
    store2.dispatch({ tipo: 'INICIAR' }); // emite fadeOutBatimentos (que falha) seguido de tocarFaixa (que gera warn)
    store2.dispatch({ tipo: 'CANCELAR' }); // emite pararTudo
    await ctrl2.aguardarFila();

    expect(errorSpy).toHaveBeenCalled();
    expect(passos[passos.length - 1]).toBe('pararTudo');

    warnSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it('d) garantirPreload chama engine.preload uma única vez mesmo com várias chamadas simultâneas', async () => {
    resetarPreparoAudioParaTestes();
    let chamadas = 0;

    const enginePreloadFalso = {
      async preload(srcs: readonly string[]) {
        chamadas++;
        await new Promise((r) => setTimeout(r, 20));
        return {
          ok: [...srcs],
          falhas: [],
          msPorArquivo: {},
          tempoTotalMs: 20,
        };
      },
    };

    expect(obterEstadoPreparoAudio()).toBe('carregando');

    const [r1, r2, r3] = await Promise.all([
      garantirPreload(enginePreloadFalso),
      garantirPreload(enginePreloadFalso),
      garantirPreload(enginePreloadFalso),
    ]);

    expect(chamadas).toBe(1);
    expect(r1.ok).toHaveLength(ALL_AUDIO_SRCS.length);
    expect(r1).toBe(r2);
    expect(r2).toBe(r3);
    expect(obterEstadoPreparoAudio()).toBe('pronto');
  });

  it('e) Integração leve (store + controlador + engine falso): ACEITAR -> boas_vindas + iniciarBatimentos; RECUSAR -> recusado + zero efeitos; REINICIAR -> tcle', async () => {
    const chamadasEngine: string[] = [];
    const engineFalso: EngineControlador = {
      iniciarBatimentos() {
        chamadasEngine.push('iniciarBatimentos');
      },
      pararTudo() {
        chamadasEngine.push('pararTudo');
      },
      async fadeOutBatimentos() {
        chamadasEngine.push('fadeOutBatimentos');
      },
      async fadeInBatimentos() {
        chamadasEngine.push('fadeInBatimentos');
      },
    };

    const store = criarSessionStore();
    const ctrl = criarControlador(engineFalso, store);

    // Fluxo 1: RECUSAR e REINICIAR
    store.dispatch({ tipo: 'RECUSAR' });
    await ctrl.aguardarFila();
    expect(store.getEstado()).toEqual({ fase: 'recusado' });
    expect(chamadasEngine).toEqual([]);

    store.dispatch({ tipo: 'REINICIAR' });
    await ctrl.aguardarFila();
    expect(store.getEstado()).toEqual({ fase: 'tcle' });
    expect(chamadasEngine).toEqual([]);

    // Fluxo 2: ACEITAR -> boas_vindas e iniciarBatimentos executado
    store.dispatch(montarEventoAceitar(1, 'nao-autoriza'));
    await ctrl.aguardarFila();
    expect(store.getEstado().fase).toBe('boas_vindas');
    expect(chamadasEngine).toEqual(['iniciarBatimentos']);

    // REINICIAR a partir de boas_vindas -> para tudo e volta a tcle
    store.dispatch({ tipo: 'REINICIAR' });
    await ctrl.aguardarFila();
    expect(store.getEstado()).toEqual({ fase: 'tcle' });
    expect(chamadasEngine).toEqual(['iniciarBatimentos', 'pararTudo']);
  });

  it('f) Verificação estática: nenhum arquivo em src/ usa localStorage ou sessionStorage', () => {
    const srcDir = path.resolve(process.cwd(), 'src');
    const arquivos = listarArquivosTsRecursivo(srcDir);
    expect(arquivos.length).toBeGreaterThan(0);

    for (const arq of arquivos) {
      const conteudo = fs.readFileSync(arq, 'utf-8');
      // Remove comentários de linha e de bloco antes de inspecionar
      const semComentarios = conteudo
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/\/\/.*/g, '');

      expect(
        semComentarios,
        `Uso proibido de localStorage em ${arq}`
      ).not.toMatch(/\blocalStorage\b/);
      expect(
        semComentarios,
        `Uso proibido de sessionStorage em ${arq}`
      ).not.toMatch(/\bsessionStorage\b/);
    }
  });
});
