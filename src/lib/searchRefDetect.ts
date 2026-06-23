/**
 * Détection de références STRUCTURÉES dans une requête de recherche (logique pure, testée).
 * - Article : « article 24 AUDCG » → { codeSlug, articleNumber } (réutilise le parseur de liens).
 * - Décision : « arrêt 34 du 14 janvier 2005 » → { number?, dateISO? } (numéro + date FR).
 * But : remonter une carte « meilleur résultat » en tête, SANS occulter la liste FTS.
 */
import { parseCitedString, normalizeToken } from './articleRefResolver';

export interface ArticleRefDetected {
  codeSlug: string;
  articleNumber: string;
}

export interface DecisionRefDetected {
  number?: string;
  dateISO?: string;
}

const MONTHS_FR: Record<string, string> = {
  janvier: '01', fevrier: '02', mars: '03', avril: '04', mai: '05', juin: '06',
  juillet: '07', aout: '08', septembre: '09', octobre: '10', novembre: '11', decembre: '12',
};

function monthToNum(name: string): string | undefined {
  const key = normalizeToken(name).toLowerCase(); // enlève accents → "fevrier", "aout", "decembre"
  return MONTHS_FR[key];
}

/** Détecte une référence d'article résolue à un code connu (sinon null). */
export function detectArticleRef(query: string, codeIndex: Map<string, string>): ArticleRefDetected | null {
  // Requête souvent en minuscules → on uppercase (le parseur attend « ARTICLE » + acronyme majuscule).
  const refs = parseCitedString((query || '').toUpperCase());
  if (refs.length !== 1) return null;
  const codeSlug = codeIndex.get(normalizeToken(refs[0].codeToken));
  if (!codeSlug) return null;
  return { codeSlug, articleNumber: refs[0].articleNumber };
}

/**
 * Détecte une référence de décision : exige un mot-clé (arrêt/décision/…) + au moins
 * un numéro OU une date. Conservateur (sinon null).
 */
export function detectDecisionRef(query: string): DecisionRefDetected | null {
  const q = (query || '').trim();
  if (!/\b(arr[êe]ts?|d[ée]cisions?|jugements?|ordonnances?|pourvois?)\b/i.test(q)) return null;

  // Numéro : "arrêt 34", "n° 34", "n°34", "décision 12/E/2024"
  let number: string | undefined;
  const numKw = q.match(/\b(?:arr[êe]t|d[ée]cision|jugement|ordonnance|pourvoi)\s+(?:n[°o]\.?\s*)?([0-9]+(?:[\/.\-][0-9A-Za-z]+)*)/i);
  const numAbs = q.match(/\bn[°o]\.?\s*([0-9]+(?:[\/.\-][0-9A-Za-z]+)*)/i);
  if (numKw) number = numKw[1];
  else if (numAbs) number = numAbs[1];

  // Date : "14 janvier 2005" ou "14/01/2005"
  let dateISO: string | undefined;
  const dmText = q.match(/\b([0-3]?\d)\s+([A-Za-zÀ-ÿ]+)\s+((?:19|20)\d{2})\b/);
  if (dmText) {
    const mm = monthToNum(dmText[2]);
    if (mm) dateISO = `${dmText[3]}-${mm}-${dmText[1].padStart(2, '0')}`;
  }
  if (!dateISO) {
    const dn = q.match(/\b([0-3]?\d)[\/.\-]([01]?\d)[\/.\-]((?:19|20)\d{2})\b/);
    if (dn) dateISO = `${dn[3]}-${dn[2].padStart(2, '0')}-${dn[1].padStart(2, '0')}`;
  }

  if (!number && !dateISO) return null;
  return { number, dateISO };
}
