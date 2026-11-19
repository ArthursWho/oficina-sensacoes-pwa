import { render } from 'preact';
import { registerSW } from 'virtual:pwa-register';
import { App } from './app';
import { audioEngine } from './audio/AudioEngine';
import { criarControlador } from './session/controlador';
import { sessionStore } from './session/store';
import { pedirArmazenamentoPersistente } from './storage/persistente';
import {
  configurarAtualizadorPwa,
  marcarAtualizacaoDisponivel,
} from './ui/menu/pwaUpdate';
import './style.css';

// Instancia o controlador de efeitos uma única vez na inicialização do app
criarControlador(audioEngine, sessionStore);

// Solicita armazenamento persistente uma vez na inicialização do app
void pedirArmazenamentoPersistente().then((res) => {
  console.info('[Armazenamento Persistente]', res);
});

// Registra o Service Worker em modo prompt (sem recarregar automaticamente durante uma sessão)
const updateSW = registerSW({
  immediate: true,
  onNeedRefresh() {
    marcarAtualizacaoDisponivel();
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

configurarAtualizadorPwa(updateSW, false);

render(<App />, document.getElementById('app')!);
