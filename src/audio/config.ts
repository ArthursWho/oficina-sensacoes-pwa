// Configurações globais da engine de áudio (Web Audio API)

// Volume geral da experiência (0.0 a 1.0)
export const VOLUME_MESTRE = 0.8;

// Nível relativo dos batimentos cardíacos em relação ao volume mestre (0.0 a 1.0)
export const NIVEL_BATIMENTOS = 0.5;

// Nível relativo das faixas musicais em relação ao volume mestre (0.0 a 1.0)
export const NIVEL_MUSICA = 0.9;

// Duração padrão dos fades de entrada e saída dos batimentos em milissegundos
export const FADE_BATIMENTOS_MS = 500;

// Se true, usa loopStart/loopEnd descartando o silêncio inicial e final do buffer de batimentos
export const LOOP_BATIMENTOS_APARADO = true;

// Limiar em decibéis (dBFS) abaixo do qual as amostras de borda são consideradas silêncio
export const LIMIAR_SILENCIO_DB = -60;
