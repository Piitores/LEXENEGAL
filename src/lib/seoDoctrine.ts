/**
 * Titre, description et articles liés d'une page de doctrine fiscale (lettre DGID).
 * Le texte intégral reste réservé : on n'utilise que des métadonnées publiques (objet, numéro, date, articles
 * du code visés par article_doctrine_links, table en lecture publique).
 *
 * RÈGLE RECOPIÉE dans api/render.js (fonction Vercel) ; src/lib/__tests__/seoDoctrineApi.test.ts vérifie la concordance.
 */
import { intituleSeoArticle, libelleSeoArticle, nomCourtTexte } from './seoArticle';

export interface LienDoctrine {
    articles?: {
        slug?: string | null; num?: string | null; num_court?: string | null; article_number?: string | null;
        display_order?: number | null; is_active?: boolean | null;
        laws_and_codes?: { slug?: string | null; title?: string | null; short_title?: string | null; category?: string | null } | null;
    } | null;
}
export interface ArticleDoctrine { url: string; numero: string; intitule: string; sigle: string; codeSlug: string; ordre: number }
export interface DoctrineSeo { numero?: string | null; date?: string | null; objet?: string | null; reference_complete?: string | null }

const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
export function dateLongue(iso?: string | null): string {
    const m = (iso || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!m) return '';
    const j = parseInt(m[3], 10);
    return `${j === 1 ? '1er' : j} ${MOIS[parseInt(m[2], 10) - 1]} ${m[1]}`;
}

/** Nom du code pour la doctrine : le sigle s'il existe (« CGI »), sinon le nom court. */
function nomCodeDoctrine(law: { title?: string | null; short_title?: string | null; category?: string | null }): string {
    const court = (law.short_title || '').trim();
    return /^[A-Z0-9]{2,8}$/.test(court) ? court : nomCourtTexte(law);
}

export function articlesDeDoctrine(liens: LienDoctrine[]): ArticleDoctrine[] {
    const vus = new Set<string>();
    const out: ArticleDoctrine[] = [];
    for (const l of liens || []) {
        const a = l.articles; const law = a?.laws_and_codes;
        if (!a || !law || !a.slug || !law.slug || a.is_active === false) continue;
        const url = `/code/${law.slug}/${a.slug}`;
        if (vus.has(url)) continue;
        vus.add(url);
        out.push({
            url, numero: libelleSeoArticle(a).replace(/^Article\s+/i, ''), intitule: intituleSeoArticle(a, law),
            sigle: nomCodeDoctrine(law), codeSlug: law.slug, ordre: a.display_order ?? 0,
        });
    }
    return out.sort((x, y) => (x.codeSlug === y.codeSlug ? x.ordre - y.ordre : x.codeSlug < y.codeSlug ? -1 : 1));
}

/** « article 256 du CGI », « articles 256 et 669 du CGI », « articles 1, 2, 3 et autres du CGI » (premier code seulement). */
function articlesEnClair(arts: ArticleDoctrine[]): string {
    if (!arts.length) return '';
    const duCode = arts.filter((a) => a.codeSlug === arts[0].codeSlug);
    const n = duCode.map((a) => a.numero);
    const prep = /^code|^[A-Z0-9]{2,8}$/i.test(duCode[0].sigle) && !/^(loi|constitution|convention)/i.test(duCode[0].sigle) ? 'du' : 'de';
    const fin = `${prep} ${duCode[0].sigle}`;
    if (n.length === 1) return `article ${n[0]} ${fin}`;
    if (n.length === 2) return `articles ${n[0]} et ${n[1]} ${fin}`;
    if (n.length === 3) return `articles ${n[0]}, ${n[1]} et ${n[2]} ${fin}`;
    return `articles ${n.slice(0, 3).join(', ')} et autres ${fin}`;
}

function objetPropre(d: DoctrineSeo): string {
    const o = (d.objet || '').replace(/\s+/g, ' ').replace(/[.\s]+$/, '').trim();
    return o ? o.charAt(0).toUpperCase() + o.slice(1) : 'Doctrine fiscale';
}
function referenceCourte(d: DoctrineSeo): string {
    const date = dateLongue(d.date);
    if (d.numero) return `n° ${d.numero}${date ? ` du ${date}` : ''}`;
    return d.reference_complete || date;
}

export function titreSeoDoctrine(d: DoctrineSeo, arts: ArticleDoctrine[]): string {
    const quoi = articlesEnClair(arts);
    const ref = `DGID ${referenceCourte(d)}`.trim();
    return quoi ? `${objetPropre(d)} : ${quoi} - ${ref} | Lexenegal` : `${objetPropre(d)} - ${ref} | Doctrine fiscale | Lexenegal`;
}

export function descriptionSeoDoctrine(d: DoctrineSeo, arts: ArticleDoctrine[]): string {
    const objet = (d.objet || '').replace(/\s+/g, ' ').replace(/[.\s]+$/, '').trim();
    const quoi = articlesEnClair(arts);
    const porte = quoi ? ` Porte sur ${quoi.startsWith('articles') ? 'les' : 'l’'}${quoi.startsWith('articles') ? ' ' : ''}${quoi}.` : '';
    return `Doctrine fiscale de la DGID (Sénégal), ${referenceCourte(d)}${objet ? ` : ${objet}` : ''}.${porte} Texte intégral réservé aux membres de Lexenegal.`;
}
