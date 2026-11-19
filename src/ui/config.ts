// Configurações de desempenho do VisualOrganico v2

export type ModoVisualConfig = 'auto' | 'completo' | 'leve';

// Padrão "auto": mede o FPS por ~2 s na montagem inicial e escolhe "leve" se a média for < 30 fps
export const VISUAL_MODO: ModoVisualConfig = 'auto';
