/**
 * Titre et description des pages d'articles, calqués sur la façon dont on cherche un article :
 * « article 363 du code pénal sénégalais », « article 83 de la constitution du sénégal ».
 *
 * RÈGLE RECOPIÉE dans api/render.js (fonction Vercel, qui ne peut pas importer ce module TypeScript) ;
 * src/lib/__tests__/seoArticleApi.test.ts vérifie que les deux copies répondent pareil.
 */
import { articleLabel, type ArticleLabelInput } from './articleLabel';

export interface TexteSeo {
    title?: string | null;
    short_title?: string | null;
    category?: string | null;
}

const sansAccents = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '');

// Article défini selon le premier mot de l'intitulé.
const PREPOSITIONS: Record<string, string> = {
    code: 'du', decret: 'du', traite: 'du', reglement: 'du', statut: 'du', protocole: 'du',
    constitution: 'de la', loi: 'de la', convention: 'de la', charte: 'de la', directive: 'de la',
    circulaire: 'de la', decision: 'de la', deliberation: 'de la', resolution: 'de la',
    acte: "de l'", arrete: "de l'", ordonnance: "de l'", accord: "de l'", instruction: "de l'", avenant: "de l'",
};
// Textes réglementaires : on écrit « du décret n° … », « de la loi n° … » (minuscule, accents rétablis).
const MINUSCULES: Record<string, string> = {
    loi: 'loi', decret: 'décret', arrete: 'arrêté', ordonnance: 'ordonnance', decision: 'décision',
    circulaire: 'circulaire', instruction: 'instruction', deliberation: 'délibération', resolution: 'résolution',
};
const OBJET = /\s+(?:portant|fixant|relatif|relative|modifiant|instituant|abrogeant|complétant|completant|déterminant|determinant|organisant|créant|creant|autorisant|concernant|sur|réglementant|reglementant|définissant|definissant|approuvant|prévoyant|prevoyant|ratifiant|abrogeant)\b/i;

function premierMot(nom: string): string {
    return sansAccents((nom.match(/^[A-Za-zÀ-ÿ]+/) || [''])[0]).toLowerCase();
}

/** Nom du texte à afficher : nom court, sauf s'il n'est qu'un sigle (« CGI ») ; intitulé réglementaire raccourci. */
export function nomCourtTexte(t: TexteSeo): string {
    const court = (t.short_title || '').trim();
    let nom = court && !/^[A-Z0-9]{2,8}$/.test(court) ? court : (t.title || court || '').trim();
    nom = nom.replace(/\s+/g, ' ').replace(/[.\s]+$/, '');
    const mot = premierMot(nom);
    if (MINUSCULES[mot]) {
        nom = MINUSCULES[mot] + nom.slice(nom.match(/^[A-Za-zÀ-ÿ]+/)![0].length);
        nom = nom.replace(/\bN\s*[°o]\s*/g, 'n° ').replace(/\bn\s*°\s*/g, 'n° ');
        const m = nom.match(OBJET);
        if (nom.length > 55 && m && m.index! > 8) nom = nom.slice(0, m.index).trim();
    }
    return nom;
}

/** Libellé de l'article : « Article L.107 » (jamais de point final), « Préambule », « Article premier ». */
export function libelleSeoArticle(a: ArticleLabelInput): string {
    let l = articleLabel(a).trim().replace(/\.$/, '');
    if (l && !/^(article|art\.|pr[ée]ambule|rapport|visa|expos[ée]|annexe|titre|chapitre)/i.test(l)) l = `Article ${l}`;
    return l || 'Article';
}

/** « Article 363 du Code Pénal du Sénégal » (sans le nom du site). */
export function intituleSeoArticle(a: ArticleLabelInput, t: TexteSeo): string {
    const nom = nomCourtTexte(t);
    const prep = PREPOSITIONS[premierMot(nom)];
    const geo = t.category === 'code' && premierMot(nom) === 'code' && !/s[ée]n[ée]gal|\(/i.test(nom) ? ' du Sénégal' : '';
    const lib = libelleSeoArticle(a);
    if (!prep) return `${lib} - ${nom}${geo}`;
    return prep.endsWith("'") ? `${lib} ${prep}${nom}${geo}` : `${lib} ${prep} ${nom}${geo}`;
}

export function titreSeoArticle(a: ArticleLabelInput, t: TexteSeo): string {
    return `${intituleSeoArticle(a, t)} | Lexenegal`;
}

/** Intitulé puis début du texte de l'article, 160 caractères au plus, coupé sur un mot. */
export function descriptionSeoArticle(a: ArticleLabelInput, t: TexteSeo, texte: string): string {
    const intitule = intituleSeoArticle(a, t);
    const extrait = (texte || '').replace(/\s+/g, ' ').trim();
    if (!extrait) {
        const i = intitule.charAt(0).toLowerCase() + intitule.slice(1);
        return `Texte intégral et en vigueur de l’${i}, avec la jurisprudence qui le cite.`;
    }
    const d = `${intitule} : ${extrait}`;
    if (d.length <= 160) return d;
    const coupe = d.slice(0, 159);
    return `${coupe.slice(0, coupe.lastIndexOf(' ')).replace(/[\s,;:]+$/, '')}…`;
}
