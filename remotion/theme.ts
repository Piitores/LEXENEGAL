// Constantes partagées de la vidéo : minutage des scènes, couleurs de la charte.
import { loadFont as loadPlayfair } from '@remotion/google-fonts/PlayfairDisplay';
import { loadFont as loadInter } from '@remotion/google-fonts/Inter';

const playfair = loadPlayfair();
const inter = loadInter();

export const FONT_DISPLAY = `${playfair.fontFamily}, Georgia, serif`;
export const FONT_UI = `${inter.fontFamily}, -apple-system, sans-serif`;
export const FONT_BODY = `Georgia, 'Times New Roman', serif`;

export const COLORS = {
  accent: '#047857',
  accentDark: '#065F46',
  accentLight: '#10B981',
  accent50: '#ECFDF5',
  text: '#111827',
  textSecondary: '#6B7280',
  border: '#E5E7EB',
  bg: '#FFFFFF',
  bgSubtle: '#F8F9FB',
  danger: '#DC2626',
  gold: '#D4AF37',
  dark: '#0B1220',
};

export const FPS = 30;

// Durées de scène en frames (hors chevauchement des transitions).
export const SCENES = {
  intro: 110,
  search: 200,
  codes: 185,
  compare: 190,
  jurisprudence: 170,
  graph: 180,
  cabinet: 200,
  pdf: 130,
  mcp: 200,
  outro: 170,
};

export const TRANSITION = 10; // coupes rapides (1/3 s)

const order = [
  SCENES.intro,
  SCENES.search,
  SCENES.codes,
  SCENES.compare,
  SCENES.jurisprudence,
  SCENES.graph,
  SCENES.cabinet,
  SCENES.pdf,
  SCENES.mcp,
  SCENES.outro,
];

// TransitionSeries : durée totale = somme des scènes − somme des chevauchements.
export const TOTAL_DURATION =
  order.reduce((a, b) => a + b, 0) - TRANSITION * (order.length - 1);

// Frame de début de chaque scène dans la timeline (chevauchements déduits).
export const SCENE_STARTS = (() => {
  const keys = Object.keys(SCENES) as Array<keyof typeof SCENES>;
  const starts = {} as Record<keyof typeof SCENES, number>;
  let cursor = 0;
  for (const k of keys) {
    starts[k] = cursor;
    cursor += SCENES[k] - TRANSITION;
  }
  return starts;
})();
