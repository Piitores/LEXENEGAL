/**
 * LEXENEGAL - Article Link Renderer
 * 
 * Utilitaire pour transformer les citations d'articles dans le texte
 * en liens cliquables avec preview au survol
 */

import React from 'react';
import ArticleHoverPreview from '../components/ArticleHoverPreview/ArticleHoverPreview';

// Patterns de détection
const ARTICLE_PATTERNS = [
    /Art(?:icle)?\.?\s*L\.?\s*(\d+)/gi,
    /L\.?\s*(\d+)\s+du\s+Code\s+du\s+Travail/gi,
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

/**
 * Transforme le texte brut en éléments React avec liens vers les articles
 */
export function renderTextWithArticleLinks(
    text: string,
    options: RenderOptions
): React.ReactNode[] {
    const { articles, codeSlug = 'code-travail' } = options;

    // Créer un map pour recherche rapide
    const articleMap = new Map<string, ArticleInfo>();
    for (const art of articles) {
        articleMap.set(art.article_number, art);
    }

    // Regex combiné pour trouver toutes les citations
    const combinedPattern = /Art(?:icle)?\.?\s*L\.?\s*(\d+)|L\.?\s*(\d+)\s+du\s+Code\s+du\s+Travail/gi;

    const result: React.ReactNode[] = [];
    let lastIndex = 0;
    let match;
    let keyIndex = 0;

    while ((match = combinedPattern.exec(text)) !== null) {
        const articleNum = match[1] || match[2];
        const fullMatch = match[0];
        const articleKey = `L.${articleNum}`;
        const article = articleMap.get(articleKey);

        // Ajouter le texte avant le match
        if (match.index > lastIndex) {
            result.push(
                <span key={`text-${keyIndex++}`}>
                    {text.substring(lastIndex, match.index)}
                </span>
            );
        }

        if (article) {
            // Article trouvé -> créer un lien avec preview
            result.push(
                <ArticleHoverPreview
                    key={`article-${keyIndex++}`}
                    articleId={article.id}
                    articleNumber={article.article_number}
                    codeName={article.code_name || 'Code du Travail'}
                    codeSlug={article.code_slug || codeSlug}
                    articleSlug={article.slug}
                >
                    <a href={`/code/${article.code_slug || codeSlug}/${article.slug}`}>
                        {fullMatch}
                    </a>
                </ArticleHoverPreview>
            );
        } else {
            // Article non trouvé -> texte simple
            result.push(
                <span key={`unknown-${keyIndex++}`} className="article-ref-unknown">
                    {fullMatch}
                </span>
            );
        }

        lastIndex = match.index + fullMatch.length;
    }

    // Ajouter le reste du texte
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
 * Version simplifiée qui retourne du HTML string (pour SSR ou preview)
 */
export function textToHtmlWithLinks(
    text: string,
    articles: ArticleInfo[],
    codeSlug: string = 'code-travail'
): string {
    const articleMap = new Map<string, ArticleInfo>();
    for (const art of articles) {
        articleMap.set(art.article_number, art);
    }

    const combinedPattern = /Art(?:icle)?\.?\s*L\.?\s*(\d+)|L\.?\s*(\d+)\s+du\s+Code\s+du\s+Travail/gi;

    return text.replace(combinedPattern, (match, num1, num2) => {
        const articleNum = num1 || num2;
        const articleKey = `L.${articleNum}`;
        const article = articleMap.get(articleKey);

        if (article) {
            return `<a href="/code/${article.code_slug || codeSlug}/${article.slug}" class="article-link" data-article-id="${article.id}">${match}</a>`;
        }
        return match;
    });
}

/**
 * Compte le nombre de citations d'articles dans un texte
 */
export function countArticleCitations(text: string): number {
    const seen = new Set<string>();

    for (const pattern of ARTICLE_PATTERNS) {
        pattern.lastIndex = 0;
        let match;
        while ((match = pattern.exec(text)) !== null) {
            seen.add(match[1]);
        }
    }

    return seen.size;
}

/**
 * Extrait les numéros d'articles cités dans un texte
 */
export function extractCitedArticles(text: string): string[] {
    const seen = new Set<string>();

    for (const pattern of ARTICLE_PATTERNS) {
        pattern.lastIndex = 0;
        let match;
        while ((match = pattern.exec(text)) !== null) {
            seen.add(`L.${match[1]}`);
        }
    }

    return Array.from(seen).sort((a, b) => {
        const numA = parseInt(a.replace('L.', ''));
        const numB = parseInt(b.replace('L.', ''));
        return numA - numB;
    });
}
