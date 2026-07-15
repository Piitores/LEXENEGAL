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
  intro: 170,
  search: 300,
  codes: 270,
  compare: 270,
  jurisprudence: 270,
  graph: 270,
  doctrine: 180,
  cabinet: 300,
  pdf: 210,
  mcp: 300,
  outro: 280,
};

export const TRANSITION = 15; // fondu croisé 0,5 s

const order = [
  SCENES.intro,
  SCENES.search,
  SCENES.codes,
  SCENES.compare,
  SCENES.jurisprudence,
  SCENES.graph,
  SCENES.doctrine,
  SCENES.cabinet,
  SCENES.pdf,
  SCENES.mcp,
  SCENES.outro,
];

// TransitionSeries : durée totale = somme des scènes − somme des chevauchements.
export const TOTAL_DURATION =
  order.reduce((a, b) => a + b, 0) - TRANSITION * (order.length - 1);
