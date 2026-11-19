// Consulta e solicitação de armazenamento persistente (StorageManager API)

export interface ResultadoPersistenciaStorage {
  suportado: boolean;
  persistido: boolean;
}

export interface EstadoArmazenamentoDispositivo {
  suportado: boolean;
  persistido: boolean;
  usoMB?: number;
  quotaMB?: number;
}

/**
 * Solicita armazenamento persistente ao navegador (se ainda não estiver persistido).
 * Nunca lança exceção.
 */
export async function pedirArmazenamentoPersistente(): Promise<ResultadoPersistenciaStorage> {
  try {
    if (
      typeof navigator === 'undefined' ||
      !navigator.storage ||
      typeof navigator.storage.persisted !== 'function'
    ) {
      return { suportado: false, persistido: false };
    }

    let persistido = await navigator.storage.persisted();
    if (!persistido && typeof navigator.storage.persist === 'function') {
      persistido = await navigator.storage.persist();
    }

    return {
      suportado: true,
      persistido: Boolean(persistido),
    };
  } catch {
    return { suportado: false, persistido: false };
  }
}

/**
 * Retorna o estado atual do armazenamento persistente e estimativa de uso/quota em MB.
 * Nunca lança exceção.
 */
export async function estadoArmazenamento(): Promise<EstadoArmazenamentoDispositivo> {
  try {
    if (
      typeof navigator === 'undefined' ||
      !navigator.storage ||
      typeof navigator.storage.persisted !== 'function'
    ) {
      return { suportado: false, persistido: false };
    }

    const persistido = Boolean(await navigator.storage.persisted());
    let usoMB: number | undefined;
    let quotaMB: number | undefined;

    if (typeof navigator.storage.estimate === 'function') {
      try {
        const est = await navigator.storage.estimate();
        if (typeof est.usage === 'number') {
          usoMB = Number((est.usage / (1024 * 1024)).toFixed(2));
        }
        if (typeof est.quota === 'number') {
          quotaMB = Number((est.quota / (1024 * 1024)).toFixed(2));
        }
      } catch {
        // Ignora falha parcial no estimate()
      }
    }

    return {
      suportado: true,
      persistido,
      ...(usoMB !== undefined ? { usoMB } : {}),
      ...(quotaMB !== undefined ? { quotaMB } : {}),
    };
  } catch {
    return { suportado: false, persistido: false };
  }
}
