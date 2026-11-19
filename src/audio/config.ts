// Configurações globais da engine de áudio (Web Audio API)

// Volume geral da experiência (0.0 a 1.0)
export const VOLUME_MESTRE = 0.8;

// Nível relativo dos batimentos cardíacos em relação ao volume mestre (0.0 a 1.0)
export const NIVEL_BATIMENTOS = 0.5;

// Nível relativo das faixas musicais em relação ao volume mestre (0.0 a 1.0)
export const NIVEL_MUSICA = 0.9;

// Duração padrão dos fades de entrada e saída dos batimentos em milissegundos
export const FADE_BATIMENTOS_MS = 500;

// Duração do fade-in inicial dos batimentos ao aceitar o TCLE (em milissegundos)
export const FADE_IN_INICIAL_MS = 1000;

// Se true, usa loopStart/loopEnd descartando o silêncio inicial e final do buffer de batimentos
export const LOOP_BATIMENTOS_APARADO = true;

// Limiar em decibéis (dBFS) abaixo do qual as amostras de borda são consideradas silêncio
export const LIMIAR_SILENCIO_DB = -60;

// Nível relativo dos efeitos sonoros sutis de interface em relação ao volume mestre
export const NIVEL_EFEITOS_UI = 0.12;

export interface DescritorTomUi {
  frequenciasHz: number[];
  duracaoMs: number;
  ataqueMs: number;
  decaimentoMs: number;
  nivel: number;
}

// Som grave/médio suave de confirmação ("Aceito participar" e "Iniciar" na Tela 2) — <= 180 ms
export const SOM_CONFIRMAR: DescritorTomUi = {
  frequenciasHz: [220, 330],
  duracaoMs: 160,
  ataqueMs: 25,
  decaimentoMs: 135,
  nivel: NIVEL_EFEITOS_UI,
};

// Som grave/médio suave quando uma pergunta é liberada na Tela 3 — <= 180 ms
export const SOM_LIBERADO: DescritorTomUi = {
  frequenciasHz: [261.63, 392.0],
  duracaoMs: 150,
  ataqueMs: 20,
  decaimentoMs: 130,
  nivel: NIVEL_EFEITOS_UI,
};

