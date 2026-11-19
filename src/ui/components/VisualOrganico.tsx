import { useEffect, useState } from 'preact/hooks';
import { IntensidadeVisual } from '../../session/visao';
import { ModoVisualConfig, VISUAL_MODO } from '../config';

export type ModoVisualEfetivo = 'completo' | 'leve';

export interface VisualOrganicoProps {
  intensidade: IntensidadeVisual;
  par?: number;
}

export interface ParticulaOrganica {
  id: number;
  xPct: number;
  yPct: number;
  tamanhoPx: number;
  duracaoS: number;
  atrasoS: number;
  deslocamentoXPx: number;
  deslocamentoYPx: number;
  opacidadeMax: number;
}

export interface TintaParCss {
  parLimitado: number;
  calor: number;
  escalaNucleo: number;
  opacidadeAmbar: number;
  opacidadeVinho: number;
  varsCss: Record<string, string>;
}

/**
 * Escolhe o modo visual efetivo ("completo" ou "leve") a partir da configuração e do FPS médio medido.
 * Em "auto", se `fpsMedio < 30`, retorna "leve"; caso contrário retorna "completo".
 */
export function escolherModoVisual(
  modoConfig: ModoVisualConfig,
  fpsMedio: number
): ModoVisualEfetivo {
  if (modoConfig === 'completo') return 'completo';
  if (modoConfig === 'leve') return 'leve';
  return fpsMedio < 30 ? 'leve' : 'completo';
}

/**
 * Calcula variáveis CSS monotônicas que esquentam sutilmente a tonalidade do par 1 ao 6.
 * Valores de `par` fora de 1..6 são limitados ao intervalo [1, 6].
 */
export function tintaPorPar(par: number = 1): TintaParCss {
  const parInt = Number.isFinite(par) ? Math.trunc(par) : 1;
  const parLimitado = Math.max(1, Math.min(6, parInt));
  // Progresso monotônico de 0.0 (par 1) a 1.0 (par 6)
  const t = (parLimitado - 1) / 5;

  const calor = Number(t.toFixed(3));
  const escalaNucleo = Number((1 + t * 0.12).toFixed(3));
  const opacidadeAmbar = Number((0.22 + t * 0.2).toFixed(3));
  const opacidadeVinho = Number((0.3 + t * 0.12).toFixed(3));

  return {
    parLimitado,
    calor,
    escalaNucleo,
    opacidadeAmbar,
    opacidadeVinho,
    varsCss: {
      '--vo-calor': String(calor),
      '--vo-escala-nucleo': String(escalaNucleo),
      '--vo-opacidade-ambar': String(opacidadeAmbar),
      '--vo-opacidade-vinho': String(opacidadeVinho),
    },
  };
}

/**
 * Gera uma lista determinística de 12 partículas (sem Math.random em tempo de render).
 * Chamadas sucessivas retornam exatamente os mesmos valores.
 */
export function obterParticulasDeterministicas(): readonly ParticulaOrganica[] {
  return PARTICULAS_FIXAS;
}

// 12 partículas com coordenadas e durações pseudoaleatórias fixas (Mulberry32 pré-computado)
const PARTICULAS_FIXAS: readonly ParticulaOrganica[] = Object.freeze([
  { id: 1, xPct: 18, yPct: 24, tamanhoPx: 6, duracaoS: 16.5, atrasoS: -2.1, deslocamentoXPx: 18, deslocamentoYPx: -24, opacidadeMax: 0.32 },
  { id: 2, xPct: 76, yPct: 20, tamanhoPx: 8, duracaoS: 19.2, atrasoS: -7.4, deslocamentoXPx: -22, deslocamentoYPx: -18, opacidadeMax: 0.28 },
  { id: 3, xPct: 28, yPct: 72, tamanhoPx: 5, duracaoS: 15.0, atrasoS: -4.8, deslocamentoXPx: 15, deslocamentoYPx: -28, opacidadeMax: 0.35 },
  { id: 4, xPct: 68, yPct: 74, tamanhoPx: 7, duracaoS: 21.0, atrasoS: -11.2, deslocamentoXPx: -16, deslocamentoYPx: -22, opacidadeMax: 0.3 },
  { id: 5, xPct: 44, yPct: 16, tamanhoPx: 6, duracaoS: 17.8, atrasoS: -5.5, deslocamentoXPx: 12, deslocamentoYPx: 20, opacidadeMax: 0.25 },
  { id: 6, xPct: 84, yPct: 52, tamanhoPx: 5, duracaoS: 14.6, atrasoS: -9.0, deslocamentoXPx: -20, deslocamentoYPx: -14, opacidadeMax: 0.34 },
  { id: 7, xPct: 14, yPct: 56, tamanhoPx: 7, duracaoS: 20.4, atrasoS: -13.1, deslocamentoXPx: 22, deslocamentoYPx: -16, opacidadeMax: 0.29 },
  { id: 8, xPct: 54, yPct: 82, tamanhoPx: 6, duracaoS: 18.0, atrasoS: -3.3, deslocamentoXPx: -14, deslocamentoYPx: -26, opacidadeMax: 0.33 },
  { id: 9, xPct: 36, yPct: 38, tamanhoPx: 8, duracaoS: 22.0, atrasoS: -15.6, deslocamentoXPx: 16, deslocamentoYPx: -18, opacidadeMax: 0.27 },
  { id: 10, xPct: 62, yPct: 42, tamanhoPx: 5, duracaoS: 15.8, atrasoS: -6.7, deslocamentoXPx: -18, deslocamentoYPx: 16, opacidadeMax: 0.31 },
  { id: 11, xPct: 24, yPct: 86, tamanhoPx: 6, duracaoS: 19.6, atrasoS: -10.4, deslocamentoXPx: 20, deslocamentoYPx: -22, opacidadeMax: 0.26 },
  { id: 12, xPct: 78, yPct: 84, tamanhoPx: 7, duracaoS: 17.2, atrasoS: -1.5, deslocamentoXPx: -15, deslocamentoYPx: -25, opacidadeMax: 0.3 },
]);

export interface DiagnosticoVisual {
  modoConfig: ModoVisualConfig;
  modoEscolhido: ModoVisualEfetivo;
  fpsMedido: number | null;
}

let modoSessaoCache: ModoVisualEfetivo | null = null;
let fpsMedidoCache: number | null = null;
let medicaoEmAndamento = false;
const assinantesDiagVisual = new Set<(d: DiagnosticoVisual) => void>();

function notificarDiagVisual(): void {
  const atual = obterDiagnosticoVisual();
  for (const cb of assinantesDiagVisual) {
    cb(atual);
  }
}

/**
 * Retorna o diagnóstico atual do modo visual e o FPS medido na sessão do app.
 */
export function obterDiagnosticoVisual(): DiagnosticoVisual {
  return {
    modoConfig: VISUAL_MODO,
    modoEscolhido:
      modoSessaoCache ??
      (VISUAL_MODO === 'leve' ? 'leve' : 'completo'),
    fpsMedido: fpsMedidoCache,
  };
}

/**
 * Assina atualizações da medição de FPS e modo visual escolhido.
 */
export function assinarDiagnosticoVisual(
  cb: (d: DiagnosticoVisual) => void
): () => void {
  assinantesDiagVisual.add(cb);
  return () => {
    assinantesDiagVisual.delete(cb);
  };
}

function iniciarMedicaoFpsUmaVez(): void {
  if (
    modoSessaoCache !== null ||
    medicaoEmAndamento ||
    typeof window === 'undefined' ||
    typeof window.requestAnimationFrame !== 'function'
  ) {
    return;
  }

  if (VISUAL_MODO !== 'auto') {
    modoSessaoCache = escolherModoVisual(VISUAL_MODO, 60);
    notificarDiagVisual();
    return;
  }

  medicaoEmAndamento = true;
  let quadros = 0;
  let inicio = 0;

  const step = (timestamp: number) => {
    if (inicio === 0) {
      inicio = timestamp;
    }
    quadros++;
    const decorrido = timestamp - inicio;
    if (decorrido < 2000) {
      window.requestAnimationFrame(step);
    } else {
      const fps = Math.round((quadros * 1000) / Math.max(1, decorrido));
      fpsMedidoCache = fps;
      modoSessaoCache = escolherModoVisual(VISUAL_MODO, fps);
      medicaoEmAndamento = false;
      notificarDiagVisual();
    }
  };

  window.requestAnimationFrame(step);
}

// VisualOrganico v2 — Container em tela cheia atrás do conteúdo com vinheta, 3 formas líquidas, núcleo "lub-dub" e partículas determinísticas
export function VisualOrganico({
  intensidade,
  par = 1,
}: VisualOrganicoProps) {
  const [diag, setDiag] = useState<DiagnosticoVisual>(() =>
    obterDiagnosticoVisual()
  );
  const [paginaOculta, setPaginaOculta] = useState<boolean>(() =>
    typeof document !== 'undefined'
      ? document.visibilityState === 'hidden'
      : false
  );

  useEffect(() => {
    const desassinar = assinarDiagnosticoVisual(setDiag);
    iniciarMedicaoFpsUmaVez();

    const onVis = () => {
      setPaginaOculta(document.visibilityState === 'hidden');
    };
    document.addEventListener('visibilitychange', onVis);

    return () => {
      desassinar();
      document.removeEventListener('visibilitychange', onVis);
    };
  }, []);

  const tinta = tintaPorPar(par);
  const modoLeve = diag.modoEscolhido === 'leve';
  const classes = [
    'ui-visual-organico',
    `ui-visual-organico--${intensidade}`,
    modoLeve ? 'ui-visual-organico--leve' : 'ui-visual-organico--completo',
    paginaOculta ? 'ui-visual-organico--pausado' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div class={classes} style={tinta.varsCss} aria-hidden="true">
      {/* Vinheta escura nas bordas */}
      <div class="ui-visual-organico__vinheta" />

      {/* Camadas líquidas com ciclos de 14 a 22 s defasados */}
      <div class="ui-visual-organico__palco">
        <div class="ui-visual-organico__camada ui-visual-organico__camada--externa" />
        <div class="ui-visual-organico__camada ui-visual-organico__camada--media" />
        {!modoLeve && (
          <div class="ui-visual-organico__camada ui-visual-organico__camada--interna" />
        )}
        <div class="ui-visual-organico__camada ui-visual-organico__camada--nucleo" />
      </div>

      {/* Partículas âmbar sutis à deriva (omitidas no modo leve) */}
      {!modoLeve && (
        <div class="ui-visual-organico__particulas">
          {PARTICULAS_FIXAS.map((p) => (
            <span
              key={p.id}
              class="ui-visual-organico__particula"
              style={{
                left: `${p.xPct}%`,
                top: `${p.yPct}%`,
                width: `${p.tamanhoPx}px`,
                height: `${p.tamanhoPx}px`,
                animationDuration: `${p.duracaoS}s`,
                animationDelay: `${p.atrasoS}s`,
                '--p-dx': `${p.deslocamentoXPx}px`,
                '--p-dy': `${p.deslocamentoYPx}px`,
                '--p-op': String(p.opacidadeMax),
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
