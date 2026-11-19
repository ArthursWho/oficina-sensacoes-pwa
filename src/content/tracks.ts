// Catálogo de faixas de áudio do experimento "O Mundo a Partir do Útero"

export interface Track {
  ordem: 1 | 2 | 3 | 4 | 5 | 6;
  slug: string;
  titulo: string;
  artista: string;
  rotulo: string;
  srcEditado: string;
  srcOriginal: string;
}

export const BATIMENTOS_SRC = './audio/batimentos.mp3' as const;

export const TRACKS: readonly Track[] = [
  {
    ordem: 1,
    slug: '01_cheia_de_manias',
    titulo: 'Cheia de Manias',
    artista: 'Raça Negra',
    rotulo: 'Cheia de Manias — Raça Negra',
    srcEditado: './audio/01_cheia_de_manias_editado.mp3',
    srcOriginal: './audio/01_cheia_de_manias_original.mp3',
  },
  {
    ordem: 2,
    slug: '02_three_little_birds',
    titulo: 'Three Little Birds',
    artista: 'Bob Marley & The Wailers',
    rotulo: 'Three Little Birds — Bob Marley & The Wailers',
    srcEditado: './audio/02_three_little_birds_editado.mp3',
    srcOriginal: './audio/02_three_little_birds_original.mp3',
  },
  {
    ordem: 3,
    slug: '03_anunciacao',
    titulo: 'Anunciação',
    artista: 'Alceu Valença',
    rotulo: 'Anunciação — Alceu Valença',
    srcEditado: './audio/03_anunciacao_editado.mp3',
    srcOriginal: './audio/03_anunciacao_original.mp3',
  },
  {
    ordem: 4,
    slug: '04_evidencias',
    titulo: 'Evidências',
    artista: 'Chitãozinho & Xororó',
    rotulo: 'Evidências — Chitãozinho & Xororó',
    srcEditado: './audio/04_evidencias_editado.mp3',
    srcOriginal: './audio/04_evidencias_original.mp3',
  },
  {
    ordem: 5,
    slug: '05_take_on_me',
    titulo: 'Take On Me',
    artista: 'a-ha',
    rotulo: 'Take On Me — a-ha',
    srcEditado: './audio/05_take_on_me_editado.mp3',
    srcOriginal: './audio/05_take_on_me_original.mp3',
  },
  {
    ordem: 6,
    slug: '06_thriller',
    titulo: 'Thriller',
    artista: 'Michael Jackson',
    rotulo: 'Thriller — Michael Jackson',
    srcEditado: './audio/06_thriller_editado.mp3',
    srcOriginal: './audio/06_thriller_original.mp3',
  },
] as const;

// Lista completa com os 13 caminhos de áudio para pré-carga e validação
export const ALL_AUDIO_SRCS: readonly string[] = [
  BATIMENTOS_SRC,
  ...TRACKS.flatMap((t) => [t.srcEditado, t.srcOriginal]),
];
