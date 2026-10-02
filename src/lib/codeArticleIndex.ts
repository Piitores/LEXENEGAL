import { supabase } from './supabase';
import { construireIndexRenvoi, type IndexRenvoi, type LigneConcordance } from './articleRefResolver';
import { lireToutesLesPages } from './lecturePaginee';
import { COLONNES_CONCORDANCE } from './articlesDuCode';

/**
 * Index paresseux des renvois d'UN code (numéro d'article -> { slug, nom du code }), mis en cache
 * au niveau module (chargé au plus une fois par session et par code).
 *
 * Sert à résoudre les citations détectées par linkify dans le corps des articles
 * (LinkedLegalContent) sans précharger les ~17 000 articles : on ne charge l'index
 * d'un code que s'il est effectivement cité sur la page consultée.
 *
 * Fusion des codes 2026 (02/10/2026) : l'index porte aussi l'ancienne numérotation d'un code
 * refondu (concordance), à résoudre par resoudreRenvoi avec la date de la citation. Concordance
 * vide : index d'avant la fusion, à l'identique.
 */

export interface IndexedArticle {
    id: string;
    slug: string;
    article_number: string;
    codeName: string;
}

const cache = new Map<string, Promise<IndexRenvoi<IndexedArticle>>>();

export function getCodeArticleIndex(codeSlug: string): Promise<IndexRenvoi<IndexedArticle>> {
    let p = cache.get(codeSlug);
    if (!p) {
        p = (async () => {
            const { data: code } = await supabase
                .from('laws_and_codes')
                .select('id, short_title, title')
                .eq('slug', codeSlug)
                .maybeSingle();
            if (!code) return construireIndexRenvoi<IndexedArticle>([], []);
            // Lecture paginée : au-delà de 1 000 articles, PostgREST tronque en silence et
            // les renvois vers la fin du code restaient du texte brut. Ordre de lecture
            // (display_order, puis id : ordre total pour la pagination), car à numéro égal le
            // premier article lu l'emporte : le corps du code avant ses annexes.
            let arts: { id: string; article_number: string; slug: string }[] = [];
            try {
                arts = await lireToutesLesPages((de, a) => supabase
                    .from('articles')
                    .select('id, article_number, slug')
                    .eq('code_id', code.id)
                    .order('display_order')
                    .order('id')
                    .range(de, a));
            } catch {
                // index indisponible : les renvois restent en texte (jamais de lien faux)
                cache.delete(codeSlug);
            }
            // Concordance du code (vide pour tout code non refondu). Illisible : null, et pour un
            // code refondu aucun lien plutôt qu'un lien faux (construireIndexRenvoi) ; nouvel
            // essai au prochain chargement de page.
            let lignes: LigneConcordance[] | null = [];
            try {
                lignes = await lireToutesLesPages<LigneConcordance>((de, a) => supabase
                    .from('article_concordance')
                    .select(COLONNES_CONCORDANCE)
                    .eq('code_id', code.id)
                    .order('ancien_norm')
                    .order('article_id')
                    .range(de, a) as unknown as PromiseLike<{ data: LigneConcordance[] | null; error: unknown }>);
            } catch {
                lignes = null;
                cache.delete(codeSlug);
            }
            const codeName = (code as any).short_title || (code as any).title || '';
            const indexes = arts.map((a) => ({ id: a.id, slug: a.slug, article_number: a.article_number, codeName }));
            return construireIndexRenvoi(indexes, lignes, codeSlug);
        })();
        cache.set(codeSlug, p);
    }
    return p;
}
