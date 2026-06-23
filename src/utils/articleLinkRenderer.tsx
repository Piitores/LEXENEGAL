/**
 * LEXENEGAL - Article Link Renderer
 * 
 * Utilitaire pour transformer les citations d'articles dans le texte
 * en liens cliquables avec preview au survol.
 * Supporte 10 codes: Travail, COCC, CP, CPP, CPC, CF, CSS, CMP, AU Sûretés, AU Commercial
 */

import React from 'react';
import ArticleHoverPreview from '../components/ArticleHoverPreview/ArticleHoverPreview';
import { normalizeArticleNumber } from '../lib/articleRefResolver';

/**
 * Configuration des codes avec leurs patterns de détection
 */
const CODE_CONFIG: { code: string; prefixes: string[]; patterns: RegExp[] }[] = [
    {
        code: 'code-travail',
        prefixes: ['L.'],
        patterns: [
            /Art(?:icle)?[.\s]*L[.\s]*(\d+)/gi,
            /L[.\s]*(\d+)\s+du\s+Code\s+du\s+Travail/gi,
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
        code: 'code-procedure-penale',
        prefixes: [''],
        patterns: [
            /Art(?:icle)?[.\s]*(\d+)\s+(?:du\s+)?C\.?P\.?P\.?/gi,
            /Art(?:icle)?[.\s]*(\d+)\s+du\s+Code\s+de\s+Proc[ée]dure\s+P[ée]nale/gi,
        ]
    },
    {
        code: 'code-procedure-civile',
        prefixes: [''],
        patterns: [
            /Art(?:icle)?[.\s]*(\d+)\s+(?:du\s+)?C\.?P\.?C\.?/gi,
            /Art(?:icle)?[.\s]*(\d+)\s+du\s+Code\s+de\s+Proc[ée]dure\s+Civile/gi,
        ]
    },
    {
        code: 'code-famille',
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
            /Art(?:icle)?[.\s]*(\d+)\s+(?:de\s+l[''])?(?:Acte\s+Uniforme|AU)\s+(?:portant\s+)?(?:sur\s+les?\s+)?[Ss][ûu]ret[ée]s?/gi,
            /Art(?:icle)?[.\s]*(\d+)\s+AU[.\s]*S/gi,
            /Art(?:icle)?[.\s]*(\d+)\s+(?:de\s+l[''])?OHADA\s+[Ss][ûu]ret[ée]s?/gi,
        ]
    },
    {
        code: 'ohada-droit-commercial-general',
        prefixes: [''],
        patterns: [
            /Art(?:icle)?[.\s]*(\d+)\s+(?:de\s+l[''])?(?:Acte\s+Uniforme|AU)\s+(?:portant\s+sur\s+le\s+)?[Dd]roit\s+[Cc]ommercial/gi,
            /Art(?:icle)?[.\s]*(\d+)\s+AU[.\s]*D\.?C\.?G?/gi,
            /Art(?:icle)?[.\s]*(\d+)\s+(?:de\s+l[''])?AUDCG/gi,
            /Art(?:icle)?[.\s]*(\d+)\s+(?:de\s+l[''])?OHADA\s+[Cc]ommercial/gi,
        ]
    },
];

interface ArticleInfo {
    id: string;
    article_number: string;
    slug: string;
    code_slug: string;
    code_name: string;
}

interface RenderOptions {
    articles: ArticleInfo[];
    codeSlug?: string;
}

interface MatchResult {
    index: number;
    length: number;
    fullMatch: string;
    articleNum: string;
    codeSlug: string;
}

/**
 * Trouve toutes les citations d'articles dans un texte
 */
function findAllArticleCitations(text: string): MatchResult[] {
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

                if (!overlaps) {
                    results.push({
                        index: match.index,
                        length: match[0].length,
                        fullMatch: match[0],
                        articleNum: match[1],
                        codeSlug: config.code
                    });
                    usedRanges.push({ start, end });
                }
            }
        }
    }

    // Trier par position
    return results.sort((a, b) => a.index - b.index);
}

/**
 * Transforme le texte brut en éléments React avec liens vers les articles
 */
export function renderTextWithArticleLinks(
    text: string,
    options: RenderOptions
): React.ReactNode[] {
    const { articles } = options;

    // Créer des maps pour recherche rapide par code
    const articleMaps: Record<string, Map<string, ArticleInfo>> = {};
    for (const art of articles) {
        if (!articleMaps[art.code_slug]) {
            articleMaps[art.code_slug] = new Map();
        }
        articleMaps[art.code_slug].set(normalizeArticleNumber(art.article_number), art);
    }

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
        const codeMap = articleMaps[citation.codeSlug];
        const prefix = citation.codeSlug === 'code-travail' ? 'L.' : '';
        const articleKey = normalizeArticleNumber(`${prefix}${citation.articleNum}`);
        const article = codeMap?.get(articleKey);

        if (article) {
            result.push(
                <ArticleHoverPreview
                    key={`article-${keyIndex++}`}
                    articleId={article.id}
                    articleNumber={article.article_number}
                    codeName={article.code_name}
                    codeSlug={article.code_slug}
                    articleSlug={article.slug}
                >
                    <a
                        href={`/code/${article.code_slug}/${article.slug}`}
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
 * Version simplifiée qui retourne du HTML string
 */
export function textToHtmlWithLinks(
    text: string,
    articles: ArticleInfo[],
    _codeSlug: string = 'code-travail'
): string {
    const articleMaps: Record<string, Map<string, ArticleInfo>> = {};
    for (const art of articles) {
        if (!articleMaps[art.code_slug]) {
            articleMaps[art.code_slug] = new Map();
        }
        articleMaps[art.code_slug].set(normalizeArticleNumber(art.article_number), art);
    }

    const citations = findAllArticleCitations(text);

    // Construire le HTML en remplaçant de la fin vers le début
    let result = text;
    for (let i = citations.length - 1; i >= 0; i--) {
        const c = citations[i];
        const codeMap = articleMaps[c.codeSlug];
        const prefix = c.codeSlug === 'code-travail' ? 'L.' : '';
        const articleKey = normalizeArticleNumber(`${prefix}${c.articleNum}`);
        const article = codeMap?.get(articleKey);

        if (article) {
            const link = `<a href="/code/${article.code_slug}/${article.slug}" class="article-link" data-article-id="${article.id}" target="_blank" rel="noopener noreferrer">${c.fullMatch}</a>`;
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
            const prefix = c.codeSlug === 'code-travail' ? 'L.' : '';
            result.push({ code: c.codeSlug, article: `${prefix}${c.articleNum}` });
        }
    }

    return result;
}
