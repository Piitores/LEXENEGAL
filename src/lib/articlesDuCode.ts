/**
 * Lectures des articles d'un ou plusieurs textes, TOUJOURS paginées (cf. lecturePaginee.ts :
 * PostgREST tronque en silence à 1 000 lignes).
 */
import { supabase } from './supabase';
import { lireToutesLesPages } from './lecturePaginee';
import type { LigneConcordance } from './articleRefResolver';
import { TEXTES_FUSIONNES, textesRetires } from './routeTexte';
import { choisirVersions, type ParamsVersion, type VersionArticle } from './versionsArticle';

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

// ---------------------------------------------------------------------------
// Fusion des codes 2026 : concordance, anciennes adresses, versions datées
// ---------------------------------------------------------------------------

/** Colonnes de article_concordance lues par le site (contrat de la fusion, §1). */
export const COLONNES_CONCORDANCE =
    'ancien_numero, ancien_norm, ancien_slug, role, statut, en_vigueur_jusqu_au, numerotation_depuis, '
    + 'article_id, article:articles(id, slug, article_number, num)';

/**
 * Concordance (ancien numéro → article actuel) des textes nommés, par slug. Lecture PAGINÉE et
 * triée sur la clé primaire (code_id, ancien_norm, article_id) : PostgREST plafonne en silence à
 * 1 000 lignes, et sans ordre total deux pages peuvent sauter ou doubler des lignes.
 * Jamais d'exception : un texte sans concordance vaut [] (comportement d'avant la fusion, et cas de
 * tous les textes tant que la table est vide) ; une lecture en échec (réseau, table absente) vaut
 * null pour chaque texte demandé : l'appelant n'y fait alors aucun lien vers un code refondu
 * (construireIndexRenvoi).
 */
export async function chargerConcordanceDesCodes(codeSlugs: string[]): Promise<Record<string, LigneConcordance[] | null>> {
    const slugs = Array.from(new Set(codeSlugs.filter(Boolean)));
    const out: Record<string, LigneConcordance[] | null> = {};
    if (!slugs.length) return out;
    try {
        const { data: codes, error } = await supabase.from('laws_and_codes').select('id, slug').in('slug', slugs);
        if (error) throw error;
        const slugParId = new Map<string, string>((codes || []).map((c: any) => [c.id, c.slug]));
        for (const s of slugs) out[s] = [];
        if (!slugParId.size) return out;
        const lignes = await lireToutesLesPages<LigneConcordance & { code_id: string }>((de, a) => supabase
            .from('article_concordance')
            .select(`code_id, ${COLONNES_CONCORDANCE}`)
            .in('code_id', Array.from(slugParId.keys()))
            .order('code_id')
            .order('ancien_norm')
            .order('article_id')
            .range(de, a) as unknown as PromiseLike<{ data: any[] | null; error: unknown }>);
        for (const l of lignes) {
            const slug = slugParId.get(l.code_id);
            if (slug) (out[slug] ||= []).push(l);
        }
        return out;
    } catch (e) {
        console.error('Concordance illisible :', e);
        for (const s of slugs) out[s] = null;
        return out;
    }
}

/**
 * Lignes de concordance utiles à la page d'un article : celles qui le visent (ancien article non
 * repris, « identite » ; anciens articles qu'il reprend) et celles des anciens numéros dont il porte
 * des versions (pour « aussi repris à l'article 138 »). [] en cas d'échec : pas de bandeau.
 */
export async function chargerConcordanceArticle(codeId: string, articleId: string, anciensNorms: string[]): Promise<LigneConcordance[]> {
    // Les clés normalisées ne contiennent que [A-Z0-9-] (fn_norm_article) : sûres dans un filtre `or`.
    const norms = Array.from(new Set(anciensNorms.filter((n) => /^[A-Z0-9-]+$/.test(n))));
    const filtre = [`article_id.eq.${articleId}`, ...(norms.length ? [`ancien_norm.in.(${norms.join(',')})`] : [])].join(',');
    try {
        const { data, error } = await supabase
            .from('article_concordance')
            .select(COLONNES_CONCORDANCE)
            .eq('code_id', codeId)
            .or(filtre)
            .order('ancien_norm')
            .order('article_id');
        if (error) throw error;
        return (data || []) as unknown as LigneConcordance[];
    } catch (e) {
        console.error('Concordance de l’article illisible :', e);
        return [];
    }
}

/** Cible d'une ancienne adresse d'article (repris, éclaté ou non repris). */
export interface CibleAncienSlug {
    id: string;
    slug: string;
    article_number: string;
    /** Clé de l'ancien numéro (?ancien=), 'L56'. */
    ancienNorm: string;
}

/**
 * Ancienne adresse d'article (/code/code-travail/article-l56) : l'article qui en a repris le sujet,
 * ligne « principal » de la concordance (ou « identite » pour un ancien article non repris, qui
 * existe toujours). null si l'adresse n'est pas dans la concordance, ou si la lecture échoue.
 */
export async function chercherAncienSlug(codeId: string, ancienSlug: string): Promise<CibleAncienSlug | null> {
    try {
        const { data, error } = await supabase
            .from('article_concordance')
            .select('ancien_norm, role, article:articles(id, slug, article_number)')
            .eq('code_id', codeId)
            .eq('ancien_slug', ancienSlug)
            .in('role', ['principal', 'identite'])
            .order('role')
            .order('article_id');
        if (error || !data) return null;
        const lignes = data as any[];
        const l = lignes.find((r) => r.role === 'principal' && r.article) ?? lignes.find((r) => r.role === 'identite' && r.article);
        if (!l) return null;
        return { id: l.article.id, slug: l.article.slug, article_number: l.article.article_number, ancienNorm: l.ancien_norm };
    } catch {
        return null;
    }
}

/** Article désigné par une adresse (aperçu au survol d'un lien), avec l'ancien numéro éventuel. */
export interface ArticleAdresse {
    id: string;
    article_number: string;
    /** Renseigné quand l'adresse est un ancien slug repris par cet article (?ancien= implicite). */
    ancien: string | null;
}

/**
 * Résout (texte, article) d'une adresse en un article en base, en suivant la fusion des codes 2026 :
 * un texte retiré (code-travail-2026) mène au texte fusionné, un ancien slug (article-l56) à
 * l'article qui l'a repris. Tant que rien n'est retiré ni la concordance remplie, c'est la lecture
 * directe d'avant. null si rien ne correspond (aperçu « Contenu non disponible »).
 */
export async function resoudreAdresseArticle(codeSlug: string, articleSlug: string): Promise<ArticleAdresse | null> {
    const idTexte = async (slug: string): Promise<string | null> => {
        const { data } = await supabase.from('laws_and_codes').select('id').eq('slug', slug).maybeSingle();
        return (data as any)?.id ?? null;
    };
    let codeId = await idTexte(codeSlug);
    if (!codeId && TEXTES_FUSIONNES[codeSlug]) codeId = await idTexte(TEXTES_FUSIONNES[codeSlug]);
    if (!codeId) return null;
    const { data: art } = await supabase
        .from('articles').select('id, article_number').eq('slug', articleSlug).eq('code_id', codeId).maybeSingle();
    if (art) return { id: (art as any).id, article_number: (art as any).article_number, ancien: null };
    const cible = await chercherAncienSlug(codeId, articleSlug);
    return cible ? { id: cible.id, article_number: cible.article_number, ancien: cible.ancienNorm } : null;
}

/**
 * Version d'un article à montrer pour des paramètres d'adresse (aperçus au survol). Robuste au
 * nombre de versions courantes : plus de `.eq('is_current', true).single()`, qui échouait dès
 * qu'un article en avait zéro ou plusieurs. Sans paramètre, une seule ligne lue (la courante,
 * sinon la plus récente) ; avec ?date / ?ancien, toutes, puis choisirVersions.
 */
export async function lireVersionAffichee(
    articleId: string,
    params: Partial<ParamsVersion> | null | undefined,
    articleNumber?: string | null,
): Promise<VersionArticle | null> {
    const colonnes = 'id, content, effective_date, expiration_date, is_current, ancien_numero, version_note, lien_ancien';
    const avecParams = !!(params?.date || params?.ancien);
    let q = supabase.from('article_versions').select(colonnes).eq('article_id', articleId);
    q = avecParams
        ? q.order('effective_date', { ascending: false })
        : q.order('is_current', { ascending: false, nullsFirst: false }).order('effective_date', { ascending: false }).limit(1);
    const { data, error } = await q;
    if (error) throw error;
    const versions = (data || []) as unknown as VersionArticle[];
    return choisirVersions(versions, params, articleNumber).versions[0] ?? null;
}

let retiresEnCours: Promise<ReadonlySet<string>> | null = null;

/**
 * Textes retirés par la fusion des codes 2026 (cf. textesRetires), lus une fois par session. En cas
 * d'échec de lecture : aucun (on ne redirige pas sur une supposition), et nouvel essai au prochain appel.
 */
export function chargerTextesRetires(): Promise<ReadonlySet<string>> {
    if (!retiresEnCours) {
        retiresEnCours = (async () => {
            const { data, error } = await supabase
                .from('laws_and_codes').select('slug').in('slug', Object.keys(TEXTES_FUSIONNES));
            if (error || !data) throw error || new Error('lecture vide');
            return textesRetires((data as any[]).map((d) => d.slug));
        })().catch(() => {
            retiresEnCours = null;
            return new Set<string>();
        });
    }
    return retiresEnCours;
}
