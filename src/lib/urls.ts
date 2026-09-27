/**
 * urls - LA règle unique des adresses publiques des textes et de leurs articles.
 *
 * Décision du propriétaire (27/09/2026) : les conventions collectives vivent sous /ccn/, avec une
 * adresse parlante : /ccn/banques, /ccn/banques/art-12 (et non /code/ccn-banques, ni /convention/…).
 * Le slug en base ne change pas (ccn-banques) : seule l'adresse retire le préfixe « ccn- ». La
 * convention interprofessionnelle (ccni-2019) garde son slug entier : /ccn/ccni-2019.
 * Les anciennes adresses (/code/ccn-*, /convention/*) sont redirigées en 301 (vercel.json).
 *
 * Règle portée par le préfixe du slug (toutes les conventions en base commencent par « ccn- » ou
 * « ccni- ») : une nouvelle convention doit suivre cette convention de nommage.
 * La même règle est dupliquée, à l'identique, dans api/render.js, api/sitemap.js et le serveur MCP
 * (lexenegal-mcp/src/links.ts) : la modifier ici impose de la modifier là-bas.
 */

/** Le texte est-il une convention collective ? (d'après son slug) */
export function estConvention(slug: string | null | undefined): boolean {
  return /^ccni?-/.test(slug ?? '');
}

/** Segment d'adresse d'une convention : « ccn-banques » → « banques » ; « ccni-2019 » inchangé. */
export function segmentConvention(slug: string): string {
  return slug.startsWith('ccn-') ? slug.slice(4) : slug;
}

/** Slug en base à partir du segment d'une adresse /ccn/… (inverse de segmentConvention). */
export function slugDepuisSegmentCcn(segment: string): string {
  return /^ccni?-/.test(segment) ? segment : `ccn-${segment}`;
}

/** Adresse publique d'un texte (sommaire). */
export function urlTexte(slug: string): string {
  return estConvention(slug) ? `/ccn/${segmentConvention(slug)}` : `/code/${slug}`;
}

/** Adresse publique d'un article. */
export function urlArticle(codeSlug: string, articleSlug: string): string {
  return `${urlTexte(codeSlug)}/${articleSlug}`;
}
