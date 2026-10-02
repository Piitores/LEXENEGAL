/**
 * LEXENEGAL - Article Link Renderer
 * 
 * Utilitaire pour transformer les citations d'articles dans le texte
 * en liens cliquables avec preview au survol.
 * Supporte 13 codes: Travail, COCC, CP, CPP, CPC, CF, CSS, CMP, AU Sûretés, AU Commercial,
 * Urbanisme (L. + R.), Construction (L. + R.), Pétrolier
 */

import React from 'react';
import ArticleHoverPreview from '../components/ArticleHoverPreview/ArticleHoverPreview';
import {
    construireIndexRenvoi, resoudreRenvoi,
    type IndexRenvoi, type LigneConcordance, type RenvoiResolu,
} from '../lib/articleRefResolver';
import { urlArticle } from '../lib/urls';
import { requeteVersion } from '../lib/versionsArticle';

/**
 * Configuration des codes avec leurs patterns de détection
 */
/*
 * `neutre` : citation capturée pour qu'aucun motif suivant (le générique du Code du travail) ne la
 * prenne, mais jamais reliée (absente des résultats de findAllArticleCitations).
 */
const CODE_CONFIG: { code: string; prefixes: string[]; patterns: RegExp[]; neutre?: boolean }[] = [
    // Urbanisme - partie législative (articles L.) et réglementaire (articles R.),
    // rangées dans deux codes distincts : le préfixe L./R. cité route vers le bon.
    // Placés AVANT le Code du travail : les chevauchements sont écartés dans l'ordre de cette
    // liste, et le motif générique du travail (« Art. L.N ») capturait « Article L.12 du Code de
    // l'urbanisme » comme L.12 du Code du travail. Numéros composés capturés (« L.12-1 », « L.5 bis »)
    // pour la même raison.
    {
        code: 'code-de-l-urbanisme',
        prefixes: ['L.'],
        patterns: [
            /Art(?:icle)?[.\s]*L[.\s]*(\d+(?:-\d+)?(?:\s?(?:bis|ter|quater)\b)?)\s+(?:du\s+)?Code\s+de\s+l['’]?\s*[Uu]rbanisme/gi,
        ]
    },
    {
        code: 'code-de-l-urbanisme-reglementaire',
        prefixes: ['R.'],
        patterns: [
            /Art(?:icle)?[.\s]*R[.\s]*(\d+(?:-\d+)?(?:\s?(?:bis|ter|quater)\b)?)\s+(?:du\s+)?Code\s+de\s+l['’]?\s*[Uu]rbanisme/gi,
        ]
    },
    // Construction - partie législative (L.) et réglementaire (R.)
    {
        code: 'code-de-la-construction',
        prefixes: ['L.'],
        patterns: [
            /Art(?:icle)?[.\s]*L[.\s]*(\d+(?:-\d+)?(?:\s?(?:bis|ter|quater)\b)?)\s+(?:du\s+)?Code\s+de\s+la\s+[Cc]onstruction/gi,
        ]
    },
    {
        code: 'code-de-la-construction-reglementaire',
        prefixes: ['R.'],
        patterns: [
            /Art(?:icle)?[.\s]*R[.\s]*(\d+(?:-\d+)?(?:\s?(?:bis|ter|quater)\b)?)\s+(?:du\s+)?Code\s+de\s+la\s+[Cc]onstruction/gi,
        ]
    },
    // Numéros « L. » d'AUTRES codes, nommés après le numéro (« article L.68 du Code électoral »,
    // « article L.12 du code de l'environnement ») : le motif générique du travail ci-dessous les
    // lisait comme des renvois au Code du travail, d'où des liens faux (relecture du 02/10/2026).
    // Capturés AVANT lui pour être neutralisés, SANS lien : le Code électoral en base est celui de
    // 2021 (loi n° 2021-35), renuméroté, alors que l'essentiel des décisions qui le citent lui sont
    // antérieures (vérifié en base : en 2019, « article L.122 » = réclamation contre la liste des
    // candidats ; L.122 de 2021 = caution). Les relier demanderait de dater la citation, comme pour
    // les codes refondus. (Apostrophe droite ou typographique : « l'environnement », « l’environnement ».)
    {
        code: 'code-electoral',
        neutre: true,
        prefixes: ['L.'],
        patterns: [
            /Art(?:icle)?[.\s]*L[.\s]*O?[.\s]*(\d+(?:-\d+)?(?:\s?(?:bis|ter|quater)\b)?)\s+du\s+Code\s+[ée]lectoral/gi,
        ]
    },
    {
        code: 'autre-code-en-l',
        neutre: true,
        prefixes: ['L.'],
        patterns: [
            /Art(?:icle)?[.\s]*L[.\s]*(\d+(?:-\d+)?(?:\s?(?:bis|ter|quater)\b)?)\s+(?:du|de\s+la|de\s+l['’]\s*|des)\s*Code\s+(?:de\s+l['’]\s*environnement|de\s+la\s+route|de\s+l['’]\s*assainissement|de\s+l['’]\s*hygi[èe]ne|de\s+la\s+sant[ée]|des\s+assurances|de\s+proc[ée]dure)/gi,
        ]
    },
    // Code du travail : numérotation « L. » du code de 1997 (fusion des codes 2026 : elle passe par
    // la concordance, cf. resoudreRenvoi). Le suffixe est capturé : « L.29-1 » était lu L.29 et
    // « L.76 bis » L.76, soit, une fois relié par sujet, le successeur d'un AUTRE article.
    {
        code: 'code-travail',
        prefixes: ['L.'],
        patterns: [
            /Art(?:icle)?[.\s]*L[.\s]*(\d+(?:-\d+)?(?:\s?(?:bis|ter|quater)\b)?)/gi,
            /L[.\s]*(\d+(?:-\d+)?(?:\s?(?:bis|ter|quater)\b)?)\s+du\s+Code\s+du\s+Travail/gi,
        ]
    },
    {
        code: 'cocc',
        prefixes: [''],
        patterns: [
            /Art(?:icle)?[.\s]*(\d+)\s+du\s+(?:COCC|Code\s+des\s+Obligations)/gi,
        ]
    },
    {
        code: 'code-penal',
        prefixes: [''],
        patterns: [
            /Art(?:icle)?[.\s]*(\d+)\s+du\s+Code\s+[Pp]énal/gi,
            /Art(?:icle)?[.\s]*(\d+)\s+C\.?P\.?(?!\s*[PpCc])/gi,
        ]
    },
    {
        code: 'code-de-procedure-penale',
        prefixes: [''],
        patterns: [
            /Art(?:icle)?[.\s]*(\d+)\s+(?:du\s+)?C\.?P\.?P\.?/gi,
            /Art(?:icle)?[.\s]*(\d+)\s+du\s+Code\s+de\s+Proc[ée]dure\s+P[ée]nale/gi,
        ]
    },
    {
        code: 'code-de-procedure-civile',
        prefixes: [''],
        patterns: [
            /Art(?:icle)?[.\s]*(\d+)\s+(?:du\s+)?C\.?P\.?C\.?/gi,
            /Art(?:icle)?[.\s]*(\d+)\s+du\s+Code\s+de\s+Proc[ée]dure\s+Civile/gi,
        ]
    },
    {
        code: 'code-de-la-famille',
        prefixes: [''],
        patterns: [
            /Art(?:icle)?[.\s]*(\d+)\s+du\s+Code\s+de\s+la\s+Famille/gi,
            /Art(?:icle)?[.\s]*(\d+)\s+C\.?F\.?(?![a-zA-Z])/gi,
        ]
    },
    {
        code: 'code-securite-sociale-senegal',
        prefixes: [''],
        patterns: [
            /Art(?:icle)?[.\s]*(\d+)\s+du\s+Code\s+de\s+la\s+S[ée]curit[ée]\s+Sociale/gi,
            /Art(?:icle)?[.\s]*(\d+)\s+C\.?S\.?S\.?/gi,
        ]
    },
    {
        code: 'code-marches-publics',
        prefixes: [''],
        patterns: [
            /Art(?:icle)?[.\s]*(\d+)\s+du\s+Code\s+des\s+March[ée]s\s+Publics/gi,
            /Art(?:icle)?[.\s]*(\d+)\s+C\.?M\.?P\.?/gi,
        ]
    },
    // OHADA Codes
    {
        code: 'ohada-suretes',
        prefixes: [''],
        patterns: [
            /Art(?:icle)?[.\s]*(\d+)\s+(?:de\s+l['’])?(?:Acte\s+Uniforme|AU)\s+(?:portant\s+)?(?:sur\s+les?\s+)?[Ss][ûu]ret[ée]s?/gi,
            /Art(?:icle)?[.\s]*(\d+)\s+AU[.\s]*S/gi,
            /Art(?:icle)?[.\s]*(\d+)\s+(?:de\s+l['’])?OHADA\s+[Ss][ûu]ret[ée]s?/gi,
        ]
    },
    {
        code: 'ohada-droit-commercial-general',
        prefixes: [''],
        patterns: [
            /Art(?:icle)?[.\s]*(\d+)\s+(?:de\s+l['’])?(?:Acte\s+Uniforme|AU)\s+(?:portant\s+sur\s+le\s+)?[Dd]roit\s+[Cc]ommercial/gi,
            /Art(?:icle)?[.\s]*(\d+)\s+AU[.\s]*D\.?C\.?G?/gi,
            /Art(?:icle)?[.\s]*(\d+)\s+(?:de\s+l['’])?AUDCG/gi,
            /Art(?:icle)?[.\s]*(\d+)\s+(?:de\s+l['’])?OHADA\s+[Cc]ommercial/gi,
        ]
    },
    // Pétrolier - numérotation à plat (pas de préfixe) ; on route vers la partie
    // législative par défaut (les deux parties partagent la même numérotation).
    {
        code: 'code-petrolier',
        prefixes: [''],
        patterns: [
            /Art(?:icle)?[.\s]*(\d+)\s+(?:du\s+)?Code\s+[Pp][ée]trolier/gi,
        ]
    },
];

// Préfixe à prépendre au numéro capturé lors de la résolution, par code.
// (Les codes L./R. exigent le préfixe pour retrouver l'article ; les autres = '' .)
export const PREFIX_BY_CODE: Record<string, string> = {
    'code-travail': 'L.',
    'code-de-l-urbanisme': 'L.',
    'code-de-l-urbanisme-reglementaire': 'R.',
    'code-de-la-construction': 'L.',
    'code-de-la-construction-reglementaire': 'R.',
};

interface ArticleInfo {
    id: string;
    article_number: string;
    slug: string;
    code_slug: string;
    code_name: string;
}

/**
 * Contexte de résolution des renvois (fusion des codes 2026, 02/10/2026).
 * - dateCitation : date de la décision, ou du texte qui contient la citation. Elle choisit la
 *   numérotation d'un code refondu (1997 ou 2026) et date l'adresse (?date=).
 * - concordances : concordance de chaque code cité (chargerConcordanceDesCodes) ; [] = aucune,
 *   null = illisible. Absente : comportement d'avant la fusion.
 */
export interface OptionsRenvoi {
    dateCitation?: string | null;
    concordances?: Record<string, LigneConcordance[] | null>;
}

interface RenderOptions extends OptionsRenvoi {
    articles: ArticleInfo[];
    codeSlug?: string;
}

export interface MatchResult {
    index: number;
    length: number;
    fullMatch: string;
    articleNum: string;
    codeSlug: string;
}

/** Slugs du Code du travail (le texte retiré code-travail-2026 compris, avant la migration). */
const TEXTES_DU_TRAVAIL: ReadonlySet<string> = new Set(['code-travail', 'code-travail-2026']);

/**
 * Le texte affiché a-t-il sa propre numérotation en « L. » (Code électoral, de l'urbanisme, de la
 * construction, de la route, de l'assainissement, de l'hygiène : vérifié en base le 02/10/2026),
 * sans être le Code du travail ? Un « article L.28 » qui n'y nomme aucun code vise alors ses propres
 * articles, et non le Code du travail (cf. findAllArticleCitations). `numeros` : article_number des
 * articles du texte affiché.
 */
export function numerotationPropreEnL(texteSlug: string | null | undefined, numeros: (string | null | undefined)[]): boolean {
    if (!texteSlug || TEXTES_DU_TRAVAIL.has(texteSlug)) return false;
    return numeros.some((n) => /^L[.\s]*O?[.\s]*(?:\d|premier)/i.test((n || '').trim()));
}

/** Options de détection, selon le texte qui contient les citations. */
export interface OptionsDetection {
    /** cf. numerotationPropreEnL : les renvois « L. » qui ne nomment pas le Code du travail sont
     *  ceux du texte lui-même, on ne les relie pas au Code du travail. */
    numerotationPropreEnL?: boolean;
}

/** La citation nomme le Code du travail (dans la correspondance, ou juste après). */
const nommeLeCodeDuTravail = (text: string, start: number, end: number): boolean =>
    /Code\s+d[eu]\s+Travail/i.test(text.slice(start, end))
    || /^\s*,?\s+du\s+Code\s+d[eu]\s+Travail/i.test(text.slice(end));

/**
 * Trouve toutes les citations d'articles dans un texte. `options` : contexte du texte qui contient
 * les citations (sans options : comportement de toujours, pour les décisions).
 */
export function findAllArticleCitations(text: string, options: OptionsDetection = {}): MatchResult[] {
    const results: MatchResult[] = [];
    const usedRanges: { start: number; end: number }[] = [];

    for (const config of CODE_CONFIG) {
        for (const pattern of config.patterns) {
            // Reset regex
            pattern.lastIndex = 0;
            let match;

            while ((match = pattern.exec(text)) !== null) {
                const start = match.index;
                const end = start + match[0].length;

                // Éviter les chevauchements
                const overlaps = usedRanges.some(
                    r => (start >= r.start && start < r.end) || (end > r.start && end <= r.end)
                );

                // Texte à numérotation propre en « L. » (Code électoral…) : son « article L.28 » est le
                // sien. Relecture du 02/10/2026 : il menait au L.28 du Code du travail.
                if (!overlaps && config.code === 'code-travail' && options.numerotationPropreEnL
                    && !nommeLeCodeDuTravail(text, start, end)) {
                    continue;
                }

                if (!overlaps) {
                    // Citation neutralisée (autre code en « L. ») : elle réserve sa place, sans lien.
                    if (!config.neutre) {
                        results.push({
                            index: match.index,
                            length: match[0].length,
                            fullMatch: match[0],
                            articleNum: match[1],
                            codeSlug: config.code
                        });
                    }
                    usedRanges.push({ start, end });
                }
            }
        }
    }

    // Trier par position
    return results.sort((a, b) => a.index - b.index);
}

/**
 * Index des renvois de chaque code. Les articles doivent arriver dans l'ordre de lecture de chaque
 * code (chargerArticlesDesCodes : code_id, display_order, id) : à numéro égal, le premier l'emporte
 * (indexerParNumero), soit le corps du code avant ses annexes. Un code refondu y ajoute son
 * ancienne numérotation (concordance).
 */
function indexerParCode(articles: ArticleInfo[], concordances?: OptionsRenvoi['concordances']): Record<string, IndexRenvoi<ArticleInfo>> {
    const parCode: Record<string, ArticleInfo[]> = {};
    for (const art of articles) {
        (parCode[art.code_slug] ||= []).push(art);
    }
    const index: Record<string, IndexRenvoi<ArticleInfo>> = {};
    for (const [code, arts] of Object.entries(parCode)) {
        // Sans contexte de concordance : [] (comportement d'avant la fusion).
        const lignes = concordances ? (code in concordances ? concordances[code] : []) : [];
        index[code] = construireIndexRenvoi(arts, lignes, code);
    }
    return index;
}

/** Cible d'une citation détectée, avec sa date de citation. */
function resoudreCitation(
    citation: MatchResult,
    index: Record<string, IndexRenvoi<ArticleInfo>>,
    dateCitation?: string | null,
): RenvoiResolu<ArticleInfo> | null {
    const prefix = PREFIX_BY_CODE[citation.codeSlug] || '';
    return resoudreRenvoi({ numero: `${prefix}${citation.articleNum}`, date: dateCitation }, index[citation.codeSlug]);
}

/** Adresse d'un renvoi résolu : celle de l'article, avec ?ancien=&date= pour une version datée. */
export function adresseRenvoi(r: RenvoiResolu<{ code_slug: string; slug: string }>): string {
    return `${urlArticle(r.article.code_slug, r.article.slug)}${requeteVersion(r.query)}`;
}

/**
 * Transforme le texte brut en éléments React avec liens vers les articles
 */
export function renderTextWithArticleLinks(
    text: string,
    options: RenderOptions
): React.ReactNode[] {
    const { articles, dateCitation, concordances } = options;

    // Index des renvois par code (numérotation actuelle, et ancienne pour un code refondu)
    const index = indexerParCode(articles, concordances);

    const citations = findAllArticleCitations(text);
    const result: React.ReactNode[] = [];
    let lastIndex = 0;
    let keyIndex = 0;

    for (const citation of citations) {
        // Texte avant la citation
        if (citation.index > lastIndex) {
            result.push(
                <span key={`text-${keyIndex++}`}>
                    {text.substring(lastIndex, citation.index)}
                </span>
            );
        }

        // Chercher l'article
        const renvoi = resoudreCitation(citation, index, dateCitation);
        const article = renvoi?.article;

        if (renvoi && article) {
            result.push(
                <ArticleHoverPreview
                    key={`article-${keyIndex++}`}
                    articleId={article.id}
                    articleNumber={article.article_number}
                    codeName={article.code_name}
                    codeSlug={article.code_slug}
                    articleSlug={article.slug}
                    date={renvoi.query.date}
                    ancien={renvoi.query.ancien}
                >
                    <a
                        href={adresseRenvoi(renvoi)}
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        {citation.fullMatch}
                    </a>
                </ArticleHoverPreview>
            );
        } else {
            result.push(
                <span key={`unknown-${keyIndex++}`} className="article-ref-unknown">
                    {citation.fullMatch}
                </span>
            );
        }

        lastIndex = citation.index + citation.length;
    }

    // Texte restant
    if (lastIndex < text.length) {
        result.push(
            <span key={`text-end-${keyIndex}`}>
                {text.substring(lastIndex)}
            </span>
        );
    }

    return result;
}

/**
 * Version simplifiée qui retourne du HTML string. `options` : date de la citation (date de la
 * décision) et concordances des codes cités, pour les codes refondus en 2026 (le troisième
 * paramètre était autrefois un slug de code par défaut, inutilisé).
 */
export function textToHtmlWithLinks(
    text: string,
    articles: ArticleInfo[],
    options: OptionsRenvoi = {}
): string {
    const index = indexerParCode(articles, options.concordances);

    const citations = findAllArticleCitations(text);

    // Construire le HTML en remplaçant de la fin vers le début
    let result = text;
    for (let i = citations.length - 1; i >= 0; i--) {
        const c = citations[i];
        const renvoi = resoudreCitation(c, index, options.dateCitation);
        const article = renvoi?.article;

        if (renvoi && article) {
            // « & » échappé dans l'attribut : ?ancien=L56&amp;date=2015-03-04
            const href = adresseRenvoi(renvoi).replace(/&/g, '&amp;');
            const link = `<a href="${href}" class="article-link" data-article-id="${article.id}" target="_blank" rel="noopener noreferrer">${c.fullMatch}</a>`;
            result = result.substring(0, c.index) + link + result.substring(c.index + c.length);
        }
    }

    return result;
}

/**
 * Compte le nombre de citations d'articles uniques dans un texte
 */
export function countArticleCitations(text: string): number {
    const citations = findAllArticleCitations(text);
    const seen = new Set(citations.map(c => `${c.codeSlug}:${c.articleNum}`));
    return seen.size;
}

/**
 * Extrait les articles cités dans un texte avec leur code
 */
export function extractCitedArticles(text: string): { code: string; article: string }[] {
    const citations = findAllArticleCitations(text);
    const seen = new Set<string>();
    const result: { code: string; article: string }[] = [];

    for (const c of citations) {
        const key = `${c.codeSlug}:${c.articleNum}`;
        if (!seen.has(key)) {
            seen.add(key);
            const prefix = PREFIX_BY_CODE[c.codeSlug] || '';
            result.push({ code: c.codeSlug, article: `${prefix}${c.articleNum}` });
        }
    }

    return result;
}
