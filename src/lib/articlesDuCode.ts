/**
 * Lectures des articles d'un ou plusieurs textes, TOUJOURS paginées (cf. lecturePaginee.ts :
 * PostgREST tronque en silence à 1 000 lignes).
 */
import { supabase } from './supabase';
import { lireToutesLesPages } from './lecturePaginee';

/**
 * Colonnes légères : de quoi construire l'arbre de navigation (rattachement, ordre, libellé,
 * statut, repli « legacy » sur les champs plats), sans le contenu des articles.
 */
export const COLONNES_ARBRE =
    'id, slug, node_id, display_order, num, num_court, article_number, status, is_active, tags, '
    + 'part_title, title_name, chapter_name, section_name';

/** Colonnes de l'arbre + contenu affiché (page d'un code : les articles y sont lus en entier). */
export const COLONNES_LECTURE = `${COLONNES_ARBRE}, content_html, content_raw, modifications`;

/**
 * Tous les articles d'un texte, dans l'ordre de lecture : display_order, puis id pour départager
 * (le Code de procédure pénale compte 923 articles pour 834 rangs distincts).
 */
export function chargerArticlesDuCode<T>(codeId: string, colonnes: string): Promise<T[]> {
    return lireToutesLesPages<T>((de, a) => supabase
        .from('articles')
        .select(colonnes)
        .eq('code_id', codeId)
        .order('display_order')
        .order('id')
        .range(de, a) as unknown as PromiseLike<{ data: T[] | null; error: unknown }>);
}

export interface ArticleDeRenvoi {
    id: string;
    article_number: string;
    slug: string;
    code_slug: string;
    code_name: string;
}

/**
 * Articles des seuls textes nommés (par slug), pour relier les renvois d'un document à leur
 * cible. Textes inconnus ignorés : on ne relie qu'à ce qui existe (jamais de lien mort).
 */
export async function chargerArticlesDesCodes(codeSlugs: string[]): Promise<ArticleDeRenvoi[]> {
    const slugs = Array.from(new Set(codeSlugs.filter(Boolean)));
    if (!slugs.length) return [];
    const { data: codes, error } = await supabase
        .from('laws_and_codes')
        .select('id, slug, short_title')
        .in('slug', slugs);
    if (error) throw error;
    if (!codes || !codes.length) return [];
    const parId = new Map<string, { slug: string; short_title: string | null }>(
        codes.map((c: any) => [c.id, { slug: c.slug, short_title: c.short_title }]),
    );
    const lignes = await lireToutesLesPages<{ id: string; slug: string; article_number: string; code_id: string }>(
        (de, a) => supabase
            .from('articles')
            .select('id, slug, article_number, code_id')
            .in('code_id', Array.from(parId.keys()))
            // Ordre total et déterministe ; dans un texte, l'ordre de lecture (display_order).
            // Les appelants gardent le PREMIER article de chaque numéro (indexerParNumero) : le
            // corps du code avant ses annexes (Code pénal : art. 5 du code, pas celui de l'annexe III).
            .order('code_id')
            .order('display_order')
            .order('id')
            .range(de, a) as unknown as PromiseLike<{ data: any[] | null; error: unknown }>,
    );
    return lignes.flatMap((art) => {
        const code = parId.get(art.code_id);
        if (!code) return [];
        return [{
            id: art.id,
            article_number: art.article_number,
            slug: art.slug,
            code_slug: code.slug,
            code_name: code.short_title || code.slug,
        }];
    });
}
