import { supabase } from './supabase';
import { normalizeArticleNumber } from './articleRefResolver';

/**
 * Index paresseux { numéro d'article normalisé -> { slug, nom du code } } pour UN code,
 * mis en cache au niveau module (chargé au plus une fois par session et par code).
 *
 * Sert à résoudre les citations détectées par linkify dans le corps des articles
 * (LinkedLegalContent) sans précharger les ~17 000 articles : on ne charge l'index
 * d'un code que s'il est effectivement cité sur la page consultée.
 */

export interface IndexedArticle {
    slug: string;
    codeName: string;
}

const cache = new Map<string, Promise<Map<string, IndexedArticle>>>();

export function getCodeArticleIndex(codeSlug: string): Promise<Map<string, IndexedArticle>> {
    let p = cache.get(codeSlug);
    if (!p) {
        p = (async () => {
            const map = new Map<string, IndexedArticle>();
            const { data: code } = await supabase
                .from('laws_and_codes')
                .select('id, short_title, title')
                .eq('slug', codeSlug)
                .maybeSingle();
            if (code) {
                const { data: arts } = await supabase
                    .from('articles')
                    .select('article_number, slug')
                    .eq('code_id', code.id);
                const codeName = (code as any).short_title || (code as any).title || '';
                for (const a of arts || []) {
                    map.set(normalizeArticleNumber(a.article_number), { slug: a.slug, codeName });
                }
            }
            return map;
        })();
        cache.set(codeSlug, p);
    }
    return p;
}
