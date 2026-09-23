/**
 * Décisions liées à une décision : fusion des deux sens du lien
 * `decisions.decisions_similaires` (tableau de slugs).
 *  - sortant : les slugs que la décision porte elle-même ;
 *  - entrant : les décisions qui portent le slug de celle-ci.
 * Le champ fait foi (legal_edge n'en reprend qu'une partie). Les cibles
 * absentes ou masquées (is_active=false) sont écartées en amont par la requête :
 * jamais de lien mort.
 */
export interface RelatedDecision {
    id: string;
    slug: string;
    reference: string | null;
    juridiction: string | null;
    chambre: string | null;
    date_decision: string | null;
    parties_principales: string | null;
}

/** Slugs sortants propres : sans doublon, sans vide, sans la décision elle-même. */
export function outgoingSlugs(selfSlug: string, similaires: unknown): string[] {
    if (!Array.isArray(similaires)) return [];
    const out = new Set<string>();
    for (const s of similaires) {
        if (typeof s === 'string' && s.trim() && s !== selfSlug) out.add(s.trim());
    }
    return Array.from(out);
}

/** Fusionne sortants + entrants, dédoublonne par slug, trie du plus récent au plus ancien. */
export function mergeRelated(selfSlug: string, lists: RelatedDecision[][]): RelatedDecision[] {
    const bySlug = new Map<string, RelatedDecision>();
    for (const list of lists) {
        for (const d of list || []) {
            if (!d || !d.slug || d.slug === selfSlug || bySlug.has(d.slug)) continue;
            bySlug.set(d.slug, d);
        }
    }
    return Array.from(bySlug.values()).sort((a, b) =>
        (b.date_decision || '').localeCompare(a.date_decision || ''));
}
