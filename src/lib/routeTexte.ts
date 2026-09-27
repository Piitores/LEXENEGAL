/**
 * routeTexte - lecture des adresses d'un texte côté client (routes React).
 *
 * Toutes les adresses publiques viennent de src/lib/urls.ts (règle unique). Ce module fait le
 * chemin inverse : à partir des paramètres d'une route (/code/:slug, /ccn/:segment,
 * /convention/:slug…) il retrouve le slug en base, et dit si l'adresse consultée est la forme
 * publique ou une ancienne forme à remplacer (/code/ccn-banques, /convention/ccn-banques,
 * /ccn/ccn-banques → /ccn/banques).
 *
 * Côté serveur, les anciennes formes sont redirigées en 301 par vercel.json ; ce module couvre
 * la navigation INTERNE de l'application (un lien client ne repasse pas par Vercel).
 */
import { slugDepuisSegmentCcn, urlArticle, urlTexte } from './urls';

/** Paramètres possibles des routes d'un texte et d'un article. */
export interface ParamsTexte {
    slug?: string;
    codeSlug?: string;
    segment?: string;
    articleSlug?: string;
}

/** Slug en base du texte consulté, quelle que soit la forme de l'adresse. */
export function slugDuTexte(p: ParamsTexte): string | undefined {
    if (p.segment) return slugDepuisSegmentCcn(p.segment);
    return p.codeSlug || p.slug || undefined;
}

/**
 * Adresse publique à substituer à l'adresse consultée, ou null si celle-ci est déjà la bonne.
 * La comparaison se fait sur le chemin décodé et sans barre finale : « article-307%20bis » et
 * « article-307 bis » désignent la même page.
 */
export function adresseCanonique(pathname: string, p: ParamsTexte): string | null {
    const slug = slugDuTexte(p);
    if (!slug) return null;
    const attendue = p.articleSlug ? urlArticle(slug, p.articleSlug) : urlTexte(slug);
    let recue = pathname.replace(/\/+$/, '');
    try { recue = decodeURIComponent(recue); } catch { /* adresse mal encodée : comparée telle quelle */ }
    return recue === attendue ? null : attendue;
}

/**
 * Renvoi d'article dans un lien (href) : /code/<slug>/<article> ou /ccn/<segment>/<article>.
 * Sert à la prévisualisation au survol des liens déjà présents dans un contenu.
 */
export function lireAdresseArticle(href: string): { codeSlug: string; articleSlug: string } | null {
    const m = (href || '').match(/\/(code|ccn)\/([^/?#]+)\/([^/?#]+)/);
    if (!m) return null;
    let [, prefixe, texte, article] = m;
    try { texte = decodeURIComponent(texte); article = decodeURIComponent(article); } catch { /* tel quel */ }
    return {
        codeSlug: prefixe === 'ccn' ? slugDepuisSegmentCcn(texte) : texte,
        articleSlug: article,
    };
}
