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
import { lireParamsVersion } from './versionsArticle';

/** Paramètres possibles des routes d'un texte et d'un article. */
export interface ParamsTexte {
    slug?: string;
    codeSlug?: string;
    segment?: string;
    articleSlug?: string;
}

/**
 * Textes retirés par la fusion des codes 2026 (décision du propriétaire du 02/10/2026 : un seul Code
 * du travail, un seul Code de la sécurité sociale) → texte qui les remplace. Côté serveur, vercel.json
 * les redirige en 301, chemin et paramètres conservés ; même règle dans api/render.js et le MCP.
 */
export const TEXTES_FUSIONNES: Readonly<Record<string, string>> = {
    'code-travail-2026': 'code-travail',
    'code-securite-sociale-2026': 'code-securite-sociale-senegal',
};

/** Codes refondus (ils portent une concordance ancien numéro → article actuel). */
export const CODES_REFONDUS: ReadonlySet<string> = new Set(Object.values(TEXTES_FUSIONNES));

const AUCUN_RETIRE: ReadonlySet<string> = new Set();

/**
 * Slugs de TEXTES_FUSIONNES réellement retirés, c'est-à-dire absents de la base. Tant que la
 * migration de données n'est pas passée, code-travail-2026 existe encore : rien n'est retiré et les
 * adresses se comportent exactement comme avant (le 1997 reste sous /code/code-travail).
 */
export function textesRetires(slugsEnBase: Iterable<string>): ReadonlySet<string> {
    const presents = new Set(slugsEnBase);
    return new Set(Object.keys(TEXTES_FUSIONNES).filter((s) => !presents.has(s)));
}

/**
 * Slug en base du texte consulté, quelle que soit la forme de l'adresse. Un texte retiré (`retires`,
 * cf. textesRetires) est remplacé par le texte fusionné.
 */
export function slugDuTexte(p: ParamsTexte, retires: ReadonlySet<string> = AUCUN_RETIRE): string | undefined {
    const slug = p.segment ? slugDepuisSegmentCcn(p.segment) : (p.codeSlug || p.slug || undefined);
    return slug && retires.has(slug) ? (TEXTES_FUSIONNES[slug] ?? slug) : slug;
}

/**
 * Adresse publique à substituer à l'adresse consultée, ou null si celle-ci est déjà la bonne.
 * La comparaison se fait sur le chemin décodé et sans barre finale : « article-307%20bis » et
 * « article-307 bis » désignent la même page. Un texte retiré (`retires`) mène au texte fusionné :
 * /code/code-travail-2026/art-137 → /code/code-travail/art-137 (l'appelant garde ?… et #…).
 */
export function adresseCanonique(pathname: string, p: ParamsTexte, retires: ReadonlySet<string> = AUCUN_RETIRE): string | null {
    const slug = slugDuTexte(p, retires);
    if (!slug) return null;
    const attendue = p.articleSlug ? urlArticle(slug, p.articleSlug) : urlTexte(slug);
    let recue = pathname.replace(/\/+$/, '');
    try { recue = decodeURIComponent(recue); } catch { /* adresse mal encodée : comparée telle quelle */ }
    return recue === attendue ? null : attendue;
}

/** Renvoi d'article lu dans une adresse, avec la version demandée (?date=, ?ancien=). */
export interface AdresseArticle {
    codeSlug: string;
    articleSlug: string;
    date: string | null;
    ancien: string | null;
}

/**
 * Renvoi d'article dans un lien (href) : /code/<slug>/<article> ou /ccn/<segment>/<article>, avec
 * ?date= et ?ancien= (fusion des codes 2026 : la version en vigueur à la date d'une décision).
 * Sert à la prévisualisation au survol des liens déjà présents dans un contenu.
 */
export function lireAdresseArticle(href: string): AdresseArticle | null {
    const m = (href || '').match(/\/(code|ccn)\/([^/?#]+)\/([^/?#]+)/);
    if (!m) return null;
    let [, prefixe, texte, article] = m;
    try { texte = decodeURIComponent(texte); article = decodeURIComponent(article); } catch { /* tel quel */ }
    const suite = (href || '').slice((m.index ?? 0) + m[0].length);
    const query = suite.startsWith('?') ? suite.slice(1).split('#')[0] : '';
    const { date, ancien } = lireParamsVersion(query);
    return {
        codeSlug: prefixe === 'ccn' ? slugDepuisSegmentCcn(texte) : texte,
        articleSlug: article,
        date,
        ancien,
    };
}
