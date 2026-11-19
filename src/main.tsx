import { render } from 'preact';
import { registerSW } from 'virtual:pwa-register';
import { App } from './app';
import { audioEngine } from './audio/AudioEngine';
import { criarControlador } from './session/controlador';
import { sessionStore } from './session/store';
import './style.css';

// Instancia o controlador de efeitos uma única vez na inicialização do app
criarControlador(audioEngine, sessionStore);

// Registra o Service Worker em modo prompt (sem recarregar automaticamente durante uma sessão)
// TODO etapa 8: botão de atualização no menu do operador
registerSW({
  immediate: true,
  onNeedRefresh() {
    // TODO etapa 8: botão de atualização no menu do operador
  },
  onOfflineReady() {
    window.dispatchEvent(new CustomEvent('pwa-sw-ready'));
  },
  onRegisteredSW(_swUrl, registration) {
    if (registration) {
      window.dispatchEvent(new CustomEvent('pwa-sw-ready'));
    }
  },
});

render(<App />, document.getElementById('app')!);
