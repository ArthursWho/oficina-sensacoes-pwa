import { Estado } from '../session/tipos';
import { WAKE_LOCK_ATIVO } from './config';

export type StatusWakeLock = 'ativo' | 'inativo' | 'indisponivel' | 'negado';

export interface EstadoWakeLock {
  status: StatusWakeLock;
  motivo?: string;
}

export interface WakeLockSentinelMinimo {
  released?: boolean;
  release(): Promise<void>;
  addEventListener?(tipo: 'release', cb: () => void): void;
  removeEventListener?(tipo: 'release', cb: () => void): void;
}

export interface NavigatorWakeLockMinimo {
  wakeLock?: {
    request(tipo: 'screen'): Promise<WakeLockSentinelMinimo>;
  };
}

export interface DocumentVisibilidadeMinimo {
  visibilityState?: DocumentVisibilityState;
  addEventListener?(tipo: 'visibilitychange', cb: () => void): void;
  removeEventListener?(tipo: 'visibilitychange', cb: () => void): void;
}

export interface StoreFaseMinimo {
  getEstado(): { fase: Estado['fase'] };
  assinar(cb: (estado: { fase: Estado['fase'] }) => void): () => void;
}

export interface ControladorWakeLock {
  obterEstado(): EstadoWakeLock;
  assinar(cb: (estado: EstadoWakeLock) => void): () => void;
  atualizar(fase?: Estado['fase'], visivel?: boolean): Promise<void>;
  encerrar(): Promise<void>;
}

/**
 * Política pura do Wake Lock: mantém a tela ligada sempre que a página estiver visível,
 * em TODAS as fases (tcle, boas_vindas, ciclo, encerramento, recusado, cancelada),
 * respeitando a flag global `ativo` (padrão `WAKE_LOCK_ATIVO`).
 */
export function deveManterTelaLigada(
  fase: Estado['fase'],
  visivel: boolean,
  ativo: boolean = WAKE_LOCK_ATIVO
): boolean {
  if (!ativo || !visivel) {
    return false;
  }
  switch (fase) {
    case 'tcle':
    case 'boas_vindas':
    case 'ciclo':
    case 'encerramento':
    case 'recusado':
    case 'cancelada':
      return true;
  }
}

/**
 * Cria um gerenciador de Screen Wake Lock com dependências injetáveis para testes.
 * Nunca duplica o sentinel e nunca lança exceção.
 */
export function criarGerenciadorWakeLock(opcoes?: {
  navigator?: NavigatorWakeLockMinimo;
  document?: DocumentVisibilidadeMinimo;
  store?: StoreFaseMinimo;
  ativo?: boolean;
}): ControladorWakeLock {
  const nav =
    opcoes?.navigator ??
    (typeof navigator !== 'undefined'
      ? (navigator as unknown as NavigatorWakeLockMinimo)
      : undefined);
  const doc =
    opcoes?.document ??
    (typeof document !== 'undefined'
      ? (document as unknown as DocumentVisibilidadeMinimo)
      : undefined);
  const store = opcoes?.store;
  const flagAtivo = opcoes?.ativo ?? WAKE_LOCK_ATIVO;

  let sentinelAtual: WakeLockSentinelMinimo | null = null;
  let requisicaoEmAndamento: Promise<void> | null = null;
  let encerrado = false;
  let faseAtual: Estado['fase'] = store ? store.getEstado().fase : 'tcle';

  const temSuporte = Boolean(
    nav?.wakeLock && typeof nav.wakeLock.request === 'function'
  );

  let estado: EstadoWakeLock = {
    status: temSuporte ? 'inativo' : 'indisponivel',
  };

  const assinantes = new Set<(e: EstadoWakeLock) => void>();

  const notificar = (novoEstado: EstadoWakeLock) => {
    estado = novoEstado;
    for (const cb of assinantes) {
      cb(estado);
    }
  };

  const estaVisivel = (): boolean => {
    if (!doc || !doc.visibilityState) return true;
    return doc.visibilityState === 'visible';
  };

  const liberarSentinelAtual = async (): Promise<void> => {
    const s = sentinelAtual;
    sentinelAtual = null;
    if (!s) {
      if (temSuporte && estado.status === 'ativo') {
        notificar({ status: 'inativo' });
      }
      return;
    }
    try {
      await s.release();
    } catch {
      // Ignora erro ao liberar
    }
    if (temSuporte) {
      notificar({ status: 'inativo' });
    }
  };

  const sincronizar = async (
    fase = faseAtual,
    visivel = estaVisivel()
  ): Promise<void> => {
    faseAtual = fase;

    if (!temSuporte) {
      notificar({ status: 'indisponivel' });
      return;
    }

    if (encerrado || !deveManterTelaLigada(fase, visivel, flagAtivo)) {
      await liberarSentinelAtual();
      return;
    }

    // Se já existe um sentinel ativo e não liberado, nunca duplica
    if (sentinelAtual && !sentinelAtual.released) {
      if (estado.status !== 'ativo') {
        notificar({ status: 'ativo' });
      }
      return;
    }

    // Se já há uma requisição concorrente em voo, aguarda ela
    if (requisicaoEmAndamento) {
      await requisicaoEmAndamento;
      return;
    }

    requisicaoEmAndamento = (async () => {
      try {
        const novoSentinel = await nav!.wakeLock!.request('screen');

        // Se durante a requisição a página ficou oculta ou foi encerrado, libera imediatamente
        if (
          encerrado ||
          !deveManterTelaLigada(faseAtual, estaVisivel(), flagAtivo)
        ) {
          try {
            await novoSentinel.release();
          } catch {
            // No-op
          }
          notificar({ status: 'inativo' });
          return;
        }

        sentinelAtual = novoSentinel;
        notificar({ status: 'ativo' });

        // Se o sistema liberar o sentinel enquanto a tela ainda deve ficar ligada, reobtém
        const onRelease = () => {
          if (sentinelAtual === novoSentinel) {
            sentinelAtual = null;
          }
          if (
            !encerrado &&
            deveManterTelaLigada(faseAtual, estaVisivel(), flagAtivo)
          ) {
            void sincronizar(faseAtual, estaVisivel());
          } else if (temSuporte) {
            notificar({ status: 'inativo' });
          }
        };

        novoSentinel.addEventListener?.('release', onRelease);
      } catch (erro) {
        sentinelAtual = null;
        const nome =
          erro &&
          typeof erro === 'object' &&
          'name' in erro &&
          typeof (erro as { name: unknown }).name === 'string'
            ? (erro as { name: string }).name
            : 'Error';
        const msg =
          erro instanceof Error
            ? erro.message
            : erro &&
              typeof erro === 'object' &&
              'message' in erro &&
              typeof (erro as { message: unknown }).message === 'string'
            ? (erro as { message: string }).message
            : String(erro);

        notificar({
          status: 'negado',
          motivo: msg ? `${nome}: ${msg}` : nome,
        });
      } finally {
        requisicaoEmAndamento = null;
      }
    })();

    await requisicaoEmAndamento;
  };

  const onVisibilityChange = () => {
    void sincronizar(faseAtual, estaVisivel());
  };

  doc?.addEventListener?.('visibilitychange', onVisibilityChange);

  const desassinarStore = store
    ? store.assinar((novoEstado) => {
        void sincronizar(novoEstado.fase, estaVisivel());
      })
    : null;

  // Solicita imediatamente ao iniciar
  void sincronizar(faseAtual, estaVisivel());

  return {
    obterEstado(): EstadoWakeLock {
      return estado;
    },
    assinar(cb: (e: EstadoWakeLock) => void): () => void {
      assinantes.add(cb);
      return () => {
        assinantes.delete(cb);
      };
    },
    async atualizar(
      fase = faseAtual,
      visivel = estaVisivel()
    ): Promise<void> {
      await sincronizar(fase, visivel);
    },
    async encerrar(): Promise<void> {
      encerrado = true;
      doc?.removeEventListener?.('visibilitychange', onVisibilityChange);
      desassinarStore?.();
      await liberarSentinelAtual();
    },
  };
}

let gerenciadorGlobal: ControladorWakeLock | null = null;

/**
 * Inicializa (ou retorna) o gerenciador singleton de Wake Lock da aplicação.
 */
export function iniciarWakeLockGlobal(
  store?: StoreFaseMinimo
): ControladorWakeLock {
  if (!gerenciadorGlobal) {
    gerenciadorGlobal = criarGerenciadorWakeLock({ store });
  }
  return gerenciadorGlobal;
}

/**
 * Obtém o estado atual do Wake Lock global para exibição na UI (#diagnostico e Menu do Operador).
 */
export function obterEstadoWakeLockGlobal(): EstadoWakeLock {
  if (!gerenciadorGlobal) {
    const suportado =
      typeof navigator !== 'undefined' && 'wakeLock' in navigator;
    return { status: suportado ? 'inativo' : 'indisponivel' };
  }
  return gerenciadorGlobal.obterEstado();
}

/**
 * Assina mudanças no estado do Wake Lock global.
 */
export function assinarWakeLockGlobal(
  cb: (estado: EstadoWakeLock) => void
): () => void {
  if (!gerenciadorGlobal) {
    return () => {};
  }
  return gerenciadorGlobal.assinar(cb);
}
