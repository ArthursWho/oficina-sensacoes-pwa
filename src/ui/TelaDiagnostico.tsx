import { useEffect, useState } from 'preact/hooks';
import { BATIMENTOS_SRC } from '../content/tracks';

type DisplayMode = 'fullscreen' | 'standalone' | 'browser';

interface AudioTestState {
  status: 'IDLE' | 'TESTING' | 'OK' | 'FALHA';
  detail: string;
}

// Detecta o modo de exibição atual via matchMedia
function getDisplayMode(): DisplayMode {
  if (window.matchMedia('(display-mode: fullscreen)').matches) {
    return 'fullscreen';
  }
  if (window.matchMedia('(display-mode: standalone)').matches) {
    return 'standalone';
  }
  return 'browser';
}

// Painel de diagnóstico da fundação PWA (acessível via hash #diagnostico)
export function TelaDiagnostico() {
  const [swActive, setSwActive] = useState<boolean>(false);
  const [swDetail, setSwDetail] = useState<string>('Verificando registro...');
  const [displayMode, setDisplayMode] = useState<DisplayMode>(getDisplayMode);
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  const [storagePersisted, setStoragePersisted] = useState<boolean | null>(null);
  const [storageDetail, setStorageDetail] = useState<string>('Verificando...');
  const [wakeLockAvailable] = useState<boolean>(() => 'wakeLock' in navigator);
  const [audioTest, setAudioTest] = useState<AudioTestState>({
    status: 'IDLE',
    detail: 'Toque no botão abaixo para testar',
  });

  useEffect(() => {
    const checkSw = async () => {
      if (!('serviceWorker' in navigator)) {
        setSwActive(false);
        setSwDetail('API Service Worker indisponível');
        return;
      }

      try {
        const reg = await navigator.serviceWorker.getRegistration();
        const activeWorker = navigator.serviceWorker.controller || reg?.active;
        if (activeWorker) {
          setSwActive(true);
          setSwDetail(
            navigator.serviceWorker.controller
              ? 'Controlando a página (controller ativo)'
              : `Registration ativa (${activeWorker.state})`
          );
        } else if (reg?.installing || reg?.waiting) {
          setSwActive(false);
          setSwDetail('Instalando / aguardando ativação...');
        } else {
          setSwActive(false);
          setSwDetail('Nenhum Service Worker ativo');
        }
      } catch {
        setSwActive(false);
        setSwDetail('Erro ao consultar Service Worker');
      }
    };

    checkSw();

    const onSwReady = () => {
      checkSw();
    };
    window.addEventListener('pwa-sw-ready', onSwReady);
    navigator.serviceWorker?.addEventListener('controllerchange', checkSw);

    const intervalId = window.setInterval(checkSw, 1500);

    const mqFullscreen = window.matchMedia('(display-mode: fullscreen)');
    const mqStandalone = window.matchMedia('(display-mode: standalone)');
    const updateDisplayMode = () => setDisplayMode(getDisplayMode());
    mqFullscreen.addEventListener('change', updateDisplayMode);
    mqStandalone.addEventListener('change', updateDisplayMode);

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const checkStoragePersist = async () => {
      if (!navigator.storage || !navigator.storage.persisted) {
        setStoragePersisted(false);
        setStorageDetail('API StorageManager indisponível');
        return;
      }
      try {
        let persisted = await navigator.storage.persisted();
        if (!persisted && navigator.storage.persist) {
          persisted = await navigator.storage.persist();
        }
        setStoragePersisted(persisted);
        setStorageDetail(
          persisted ? 'Concedido pelo navegador' : 'Não concedido (modo padrão)'
        );
      } catch {
        setStoragePersisted(false);
        setStorageDetail('Erro ao consultar persistência');
      }
    };

    checkStoragePersist();

    return () => {
      window.removeEventListener('pwa-sw-ready', onSwReady);
      navigator.serviceWorker?.removeEventListener('controllerchange', checkSw);
      window.clearInterval(intervalId);
      mqFullscreen.removeEventListener('change', updateDisplayMode);
      mqStandalone.removeEventListener('change', updateDisplayMode);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleTestAudio = async () => {
    setAudioTest({ status: 'TESTING', detail: 'Buscando áudio...' });

    try {
      const response = await fetch(BATIMENTOS_SRC);
      const contentType = response.headers.get('content-type') || '';
      if (response.ok && !contentType.includes('text/html')) {
        const buffer = await response.arrayBuffer();
        if (buffer.byteLength > 0) {
          const sizeKb = (buffer.byteLength / 1024).toFixed(1);
          setAudioTest({
            status: 'OK',
            detail: `Resposta OK (batimentos.mp3 — ${sizeKb} KB)`,
          });
          return;
        }
      }
    } catch {
      // Tratado abaixo
    }

    setAudioTest({
      status: 'FALHA',
      detail: 'arquivo ausente',
    });
  };

  const isInstalledDisplay =
    displayMode === 'fullscreen' || displayMode === 'standalone';

  return (
    <main class="diag-container">
      <h1 class="diag-title">O Mundo a Partir do Útero</h1>
      <p class="diag-subtitle">Etapa 1: verificação da fundação PWA (#diagnostico)</p>

      <ul class="diag-list">
        <li class="diag-item">
          <div>
            <span class="diag-label">a) Service Worker ativo</span>
            <span class="diag-detail">{swDetail}</span>
          </div>
          <span class={`diag-status ${swActive ? 'status-ok' : 'status-fail'}`}>
            {swActive ? 'OK' : 'FALHA'}
          </span>
        </li>

        <li class="diag-item">
          <div>
            <span class="diag-label">b) Modo de exibição atual</span>
            <span class="diag-detail">display-mode: {displayMode}</span>
          </div>
          <span
            class={`diag-status ${
              isInstalledDisplay ? 'status-ok' : 'status-pending'
            }`}
          >
            {isInstalledDisplay
              ? `OK (${displayMode})`
              : `FALHA (${displayMode})`}
          </span>
        </li>

        <li class="diag-item">
          <div>
            <span class="diag-label">c) Status da conexão</span>
            <span class="diag-detail">
              navigator.onLine: {isOnline ? 'true (Online)' : 'false (Offline)'}
            </span>
          </div>
          <span class="diag-status status-ok">
            {isOnline ? 'OK (ONLINE)' : 'OK (OFFLINE)'}
          </span>
        </li>

        <li class="diag-item">
          <div>
            <span class="diag-label">d) Armazenamento persistente</span>
            <span class="diag-detail">{storageDetail}</span>
          </div>
          <span
            class={`diag-status ${
              storagePersisted === null
                ? 'status-pending'
                : storagePersisted
                ? 'status-ok'
                : 'status-fail'
            }`}
          >
            {storagePersisted === null
              ? '...'
              : storagePersisted
              ? 'OK'
              : 'FALHA'}
          </span>
        </li>

        <li class="diag-item">
          <div>
            <span class="diag-label">e) Wake Lock API disponível</span>
            <span class="diag-detail">
              {'wakeLock' in navigator
                ? 'Suportado pelo navegador'
                : 'Não suportado'}
            </span>
          </div>
          <span
            class={`diag-status ${
              wakeLockAvailable ? 'status-ok' : 'status-fail'
            }`}
          >
            {wakeLockAvailable ? 'OK' : 'FALHA'}
          </span>
        </li>

        <li class="diag-item">
          <div>
            <span class="diag-label">f) Teste de cache do áudio</span>
            <span class="diag-detail">{audioTest.detail}</span>
          </div>
          <span
            class={`diag-status ${
              audioTest.status === 'OK'
                ? 'status-ok'
                : audioTest.status === 'FALHA'
                ? 'status-fail'
                : 'status-pending'
            }`}
          >
            {audioTest.status === 'IDLE'
              ? 'AGUARDANDO'
              : audioTest.status === 'TESTING'
              ? 'TESTANDO...'
              : audioTest.status}
          </span>
        </li>
      </ul>

      <button
        type="button"
        class="diag-button"
        onClick={handleTestAudio}
        disabled={audioTest.status === 'TESTING'}
      >
        Testar áudio em cache
      </button>

      <footer class="diag-footer">
        <span>
          Versão do build: <strong>{__BUILD_VERSION__}</strong>
        </span>
        <a href="#" class="diag-link">
          ← Abrir Fluxo Principal do App (Tela 1 — TCLE)
        </a>
        <a href="#componentes" class="diag-link">
          Abrir Galeria de Componentes (#componentes) →
        </a>
        <a href="#audio-lab" class="diag-link">
          Abrir Laboratório de Áudio (#audio-lab) →
        </a>
        <a href="#sessao-lab" class="diag-link">
          Abrir Laboratório da Sessão (#sessao-lab) →
        </a>
        <a href="#armazenamento-lab" class="diag-link">
          Abrir Laboratório de Armazenamento (#armazenamento-lab) →
        </a>
        <a href="#compartilhar-lab" class="diag-link">
          Abrir Laboratório de Compartilhamento (#compartilhar-lab) →
        </a>
      </footer>
    </main>
  );
}
