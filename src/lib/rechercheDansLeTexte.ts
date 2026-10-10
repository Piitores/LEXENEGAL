/**
 * Recherche interne d'un texte (filtre « Rechercher un article… » de la page d'un code).
 *
 * Deux règles :
 *  1. on cherche dans le texte AFFICHÉ au lecteur, c'est-à-dire content_html débarrassé de ses
 *     balises. content_raw diverge du texte affiché sur une partie du corpus (corrections
 *     portées sur content_html seulement) : y chercher faisait trouver des mots absents de la
 *     page, et manquer des mots présents ;
 *  2. la comparaison ignore les accents, la casse et la forme de l'apostrophe : « preavis »
 *     trouve « préavis », « l'employeur » trouve « l’employeur ».
 */

// Balises de bloc : leur disparition doit laisser un blanc (« </p><p> » sépare deux mots).
// Les balises en ligne (<em>, <sup>…) disparaissent sans blanc : « 1<sup>er</sup> » → « 1er ».
const BALISE_BLOC = /<\/?(?:p|div|br|li|ul|ol|tr|td|th|table|thead|tbody|h[1-6]|section|article|blockquote|hr)\b[^>]*>/gi;
const BALISE = /<[^>]*>/g;

const ENTITES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

function decoderEntites(s: string): string {
    return s.replace(/&(#x[0-9a-f]+|#[0-9]+|[a-z]+);/gi, (tout, e: string) => {
        if (e[0] === '#') {
            const code = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
            return Number.isFinite(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : tout;
        }
        return ENTITES[e.toLowerCase()] ?? tout;
    });
}

/** Texte lisible d'un contenu HTML, tel que le lecteur le voit. */
export function texteAffiche(html: string | null | undefined): string {
    if (!html) return '';
    return decoderEntites(html.replace(BALISE_BLOC, ' ').replace(BALISE, ''))
        .replace(/\s+/g, ' ')
        .trim();
}

/** Forme de comparaison : sans accents, en minuscules, apostrophes et blancs uniformisés. */
export function normaliserPourRecherche(s: string | null | undefined): string {
    return (s || '')
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase()
        .replace(/œ/g, 'oe').replace(/æ/g, 'ae')
        .replace(/[‘’ʼ`´]/g, "'")
        .replace(/\s+/g, ' ')
        .trim();
}

export interface ArticleCherchable {
    article_number?: string | null;
    num?: string | null;
    num_court?: string | null;
    chapter_name?: string | null;
    title_name?: string | null;
    content_html?: string | null;
    content_raw?: string | null;
}

/**
 * Texte dans lequel on cherche un article, déjà normalisé : son numéro, ses intitulés et son
 * contenu affiché (content_html si présent ; content_raw seulement quand c'est lui qui est
 * affiché, faute de content_html).
 */
export function texteCherchable(a: ArticleCherchable): string {
    const corps = a.content_html ? texteAffiche(a.content_html) : (a.content_raw || '');
    return normaliserPourRecherche([a.num, a.num_court, a.article_number, a.chapter_name, a.title_name, corps]
        .filter(Boolean).join(' • '));
}

/** La requête (déjà saisie par le lecteur) figure-t-elle dans ce texte cherchable ? */
export function correspond(cherchable: string, requete: string): boolean {
    const q = normaliserPourRecherche(requete);
    return q.length > 0 && cherchable.includes(q);
}

/** Forme de comparaison d'UN caractère (même règles que normaliserPourRecherche). */
function normaliserCaractere(c: string): string {
    if (/\s/.test(c)) return ' ';
    return c.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
        .replace(/œ/g, 'oe').replace(/æ/g, 'ae').replace(/[‘’ʼ`´]/g, "'");
}

/**
 * Extrait du texte affiché autour de la 1re occurrence de la requête, pour la liste des résultats
 * (« … porte sur du bétail ; … »), comme Légifrance. null si la requête n'est que dans le numéro
 * ou les intitulés (rien à montrer dans le corps).
 */
export function extraitAutour(html: string | null | undefined, requete: string, rayon = 90):
    { avant: string; trouve: string; apres: string } | null {
    const texte = texteAffiche(html);
    const q = normaliserPourRecherche(requete);
    if (!texte || !q) return null;
    // Texte normalisé + correspondance position normalisée → position d'origine.
    let norm = '';
    const origine: number[] = [];
    for (let i = 0; i < texte.length; i++) {
        for (const c of normaliserCaractere(texte[i])) { norm += c; origine.push(i); }
    }
    const k = norm.indexOf(q);
    if (k < 0) return null;
    const debut = origine[k];
    const fin = origine[k + q.length - 1] + 1;
    let d = Math.max(0, debut - rayon);
    let f = Math.min(texte.length, fin + rayon);
    // Couper sur un blanc pour ne pas trancher un mot.
    if (d > 0) { const b = texte.indexOf(' ', d); if (b > -1 && b < debut) d = b + 1; }
    if (f < texte.length) { const b = texte.lastIndexOf(' ', f); if (b > fin) f = b; }
    return {
        avant: (d > 0 ? '… ' : '') + texte.slice(d, debut),
        trouve: texte.slice(debut, fin),
        apres: texte.slice(fin, f) + (f < texte.length ? ' …' : ''),
    };
}
