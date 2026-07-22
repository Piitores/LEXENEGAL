/**
 * Résolveur de références d'articles cités (conservateur, "fiabilité d'abord").
 *
 * Transforme une référence textuelle ("ARTICLE 3 AUDCG", "Article L.56 du Code du travail")
 * en lien SEULEMENT si on peut la résoudre avec certitude : code reconnu (index générique
 * dérivé de laws_and_codes + alias d'acronymes) ET article présent en base.
 * Sinon → texte simple. JAMAIS de lien mort. (Charte : renvois conditionnels.)
 *
 * Logique PURE (aucune I/O) → testable unitairement.
 */

export interface ResolvedArticle {
  id: string;
  slug: string;
  article_number: string;
  code_slug: string;
  code_name: string;
}

export interface CodeRef {
  codeToken: string;     // acronyme ("AUDCG") ou nom de code ("Code du travail")
  articleNumber: string; // "3", "L.56"
}

export type CitedResolution =
  | { kind: 'link'; article: ResolvedArticle; label: string }
  | { kind: 'text'; label: string };

/** Un alias de code (acronyme → slug). SOURCE UNIQUE = vue DB `code_aliases`
 *  (elle-même dérivée de la table `ref_code`). Plus aucun dictionnaire codé en dur ici :
 *  les appelants chargent les alias depuis la base et les passent à buildCodeIndex. */
export interface CodeAlias { alias: string; code_slug: string; }

/** Normalise un token de code : majuscules, sans accents, alphanumérique only. */
export function normalizeToken(s: string): string {
  return (s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}

/** Normalise un numéro d'article pour comparaison ("Article L. 56" → "L.56", " 3 " → "3"). */
export function normalizeArticleNumber(s: string): string {
  return (s || '')
    .toUpperCase()
    .replace(/^ART(?:ICLE)?\.?/, '')
    .replace(/[\s.]+/g, ''); // insensible aux espaces ET aux points ("L. 69" = "L69" = "L.69")
}

/** Construit l'index générique token→slug à partir des codes (extensible : conventions collectives incluses dès qu'elles sont en base). */
export function buildCodeIndex(
  laws: { slug: string; title?: string | null; short_title?: string | null }[],
  aliases: CodeAlias[] = [],
): Map<string, string> {
  const idx = new Map<string, string>();
  // alias d'acronymes - SOURCE UNIQUE = vue DB `code_aliases` (dérivée de ref_code), passés par l'appelant
  for (const a of aliases) {
    if (a?.alias && a?.code_slug) idx.set(normalizeToken(a.alias), a.code_slug);
  }
  // tokens dérivés des titres / short_title
  for (const law of laws) {
    if (!law?.slug) continue;
    for (const name of [law.short_title, law.title]) {
      const t = normalizeToken(name || '');
      if (t.length >= 4 && !idx.has(t)) idx.set(t, law.slug);
    }
  }
  return idx;
}

/** Mots-vides FR à ne jamais prendre pour un acronyme de code. */
const STOPWORDS = new Set(['DU', 'DE', 'DES', 'LA', 'LE', 'LES', 'ET', 'EN', 'AUX', 'SUR', 'PAR', 'UN', 'UNE']);

/** Extrait les références (code + article) d'une chaîne. Conservateur : 2 motifs nets. */
export function parseCitedString(raw: string): CodeRef[] {
  const refs: CodeRef[] = [];
  if (!raw) return refs;

  // Motif A : "ARTICLE <num> <ACRONYME>" (acronyme tout en majuscules, ≥2 lettres)
  const reAcronym = /\bART(?:ICLE)?\.?\s+(L\.?\s?\d+[\w-]*|\d+[\w-]*)\s+([A-Z]{2,}[A-Z./]*)/g;
  let m: RegExpExecArray | null;
  while ((m = reAcronym.exec(raw)) !== null) {
    refs.push({ articleNumber: m[1].replace(/\s+/g, ''), codeToken: m[2] });
  }

  // Motif B : "Article <num> du <Nom de code>"
  const reNamed = /\bArt(?:icle)?\.?\s+(L\.?\s?\d+[\w-]*|\d+[\w-]*)\s+d[eu]\s+(?:la\s+|l['']\s*)?([^,;.()]+)/gi;
  while ((m = reNamed.exec(raw)) !== null) {
    refs.push({ articleNumber: m[1].replace(/\s+/g, ''), codeToken: m[2].trim() });
  }

  // Anti mots-vides : un acronyme ne peut pas être « DU », « DE »… (évite les faux positifs)
  return refs.filter((r) => !STOPWORDS.has(normalizeToken(r.codeToken)));
}

/**
 * Résout UNE chaîne citée. Lien seulement si EXACTEMENT une référence est extraite ET
 * résolue (code connu + article présent). Sinon → texte. (Sécurité : multi-réfs = texte.)
 */
export function resolveCitedString(
  raw: string,
  codeIndex: Map<string, string>,
  lookup: (codeSlug: string, articleNumber: string) => ResolvedArticle | null,
): CitedResolution {
  const refs = parseCitedString(raw);
  if (refs.length !== 1) return { kind: 'text', label: raw };

  const ref = refs[0];
  const codeSlug = codeIndex.get(normalizeToken(ref.codeToken));
  if (!codeSlug) return { kind: 'text', label: raw };

  const article = lookup(codeSlug, ref.articleNumber);
  if (!article) return { kind: 'text', label: raw };

  return { kind: 'link', article, label: raw };
}
