/**
 * INTITULÉ D'ARTICLE - repérage dans `content_html`.
 *
 * La table `articles` n'a pas de colonne `intitule` (arbitrage du propriétaire, 06/09/2026) :
 * l'intitulé d'un article (« Protection des témoins en matière de discrimination ») est stocké
 * EN TÊTE du contenu, dans un paragraphe marqué par une classe. Trois générations d'outils de
 * publication ont produit trois classes, toutes vérifiées en base le 02/10/2026 :
 *   - `alinea intitule-article`              (Codes du travail et de la sécurité sociale 2026,
 *                                             Marine marchande, Investissements, conventions…)
 *   - `article-intitule` + `<strong>`        (Famille, COCC, Minier, la plupart des conventions…)
 *   - `article-rubrique` + `<strong>`        (CGI)
 * Dans les trois cas le paragraphe est TOUJOURS le premier du contenu (0 exception en base).
 *
 * ⚠️ Les mêmes trois classes sont mises en forme dans `styles/legal-content.css` et dans le CSS
 * critique du rendu serveur (`index.html`, `#ssr-keep`) : toute nouvelle classe s'ajoute aux
 * trois endroits.
 */
export const CLASSES_INTITULE = ['intitule-article', 'article-intitule', 'article-rubrique'] as const;

const RE_PREMIER_PARAGRAPHE = /^\s*<p\s+class="([^"]*)"\s*>([\s\S]*?)<\/p>/;

/** Sépare l'intitulé (HTML interne du paragraphe) du reste du contenu. */
export function separerIntitule(html: string | null | undefined): { intitule: string | null; corps: string } {
    const source = html || '';
    const m = RE_PREMIER_PARAGRAPHE.exec(source);
    if (m && m[1].split(/\s+/).some((c) => (CLASSES_INTITULE as readonly string[]).includes(c))) {
        return { intitule: m[2], corps: source.slice(m[0].length) };
    }
    return { intitule: null, corps: source };
}

/**
 * Aperçu d'un article pour les bulles de renvoi : l'intitulé À PART, le texte ensuite, tronqué.
 * Sans cette séparation l'aperçu collait l'intitulé à la première phrase
 * (« Interdiction de la discrimination La discrimination est interdite… »).
 * `versTexte` convertit un fragment HTML en texte lisible (DOM côté navigateur).
 */
export function apercuArticle(
    html: string | null | undefined,
    versTexte: (fragment: string) => string,
    max = 300,
): { intitule: string | null; texte: string } {
    const { intitule, corps } = separerIntitule(html);
    const propre = (s: string) => versTexte(s).replace(/\s+/g, ' ').trim();
    const titre = intitule !== null ? propre(intitule) || null : null;
    const texte = propre(corps);
    return { intitule: titre, texte: texte.length > max ? texte.slice(0, max) + '…' : texte };
}

/**
 * Texte suivi d'un article pour une DESCRIPTION (balise meta, aperçu de partage) : l'intitulé
 * PONCTUÉ, puis le corps. Sans le point, Google et les cartes de partage lisaient
 * « Article 2 du Code du travail : Champ d'application Le présent Code s'applique… ».
 * ⚠️ Recopiée dans api/render.js (`texteSeoArticle`), fonction Vercel qui ne peut pas importer
 * ce module : `seoArticleApi.test.ts` vérifie que les deux copies rendent la même chose.
 */
export function texteAvecIntitule(html: string | null | undefined, versTexte: (fragment: string) => string): string {
    const { intitule, corps } = separerIntitule(html);
    const propre = (s: string) => versTexte(s).replace(/\s+/g, ' ').trim();
    const texte = propre(corps);
    const titre = intitule !== null ? propre(intitule) : '';
    if (!titre) return texte;
    return `${titre}${/[.:;!?…]$/.test(titre) ? '' : '.'} ${texte}`.trim();
}
