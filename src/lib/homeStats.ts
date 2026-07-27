/**
 * homeStats — chiffres VIVANTS de la page d'accueil.
 *
 * Avant (2026-07-27), chaque section portait ses propres valeurs codées en dur
 * (« 11 325 décisions », « 11 codes », « 8 131 articles », commentaire « à jour
 * au 2026-06-23 »). Elles étaient fausses DANS LES DEUX SENS : sur-annonce sur
 * les décisions, et sous-vente de moitié sur les codes et les articles
 * (27 codes / 17 169 articles réels). Source unique désormais : les RPC
 * `get_public_stats` et `get_recent_publications`, adossées à des vues
 * matérialisées rafraîchies toutes les 6 h (compter en direct coûterait
 * plusieurs centaines de ms à chaque visite).
 */
import { supabase } from './supabase';

export interface PublicStats {
    decisions: number;
    codes: number;
    ohada: number;
    textes: number;
    articles: number;
    doctrine: number;
    juridictions: number;
}

export interface RecentPublication {
    slug: string;
    category: string;
    titre: string;
    reference: string | null;
    publication_date: string | null;
    publie_le: string;
    nb_articles: number;
}

/**
 * Filet de sécurité si la base ne répond pas : valeurs relevées le 2026-07-27.
 * Elles ne doivent JAMAIS être « rafraîchies à la main » — c'est précisément la
 * dette qu'on supprime ici. Elles n'existent que pour ne pas afficher un trou.
 */
const REPLI: PublicStats = {
    decisions: 10922, codes: 27, ohada: 12, textes: 158,
    articles: 17169, doctrine: 668, juridictions: 22,
};

/**
 * Plancher d'affichage des décisions, demandé par le propriétaire (2026-07-27) :
 * on continue d'annoncer 11 000 en attendant le prochain versement de décisions.
 * Écrit comme un PLANCHER et non comme une constante : dès que le corpus réel
 * dépasse ce seuil, l'affichage suit tout seul et ne se re-fige pas.
 */
export const PLANCHER_DECISIONS = 11000;

/** Arrondi vers le BAS : on n'annonce jamais plus que ce que contient la base. */
export function arrondiBas(n: number, pas: number): number {
    if (!Number.isFinite(n) || n <= 0) return 0;
    return Math.floor(n / pas) * pas;
}

/** Formatage français avec espace fine insécable (10 922 → « 10 922 »). */
export function formatFr(n: number): string {
    return n.toLocaleString('fr-FR').replace(/ | /g, ' ');
}

/** « Plus de 11 000 » : décisions arrondies à la centaine basse, plancher appliqué. */
export function libelleDecisions(s: PublicStats): string {
    return `Plus de ${formatFr(Math.max(PLANCHER_DECISIONS, arrondiBas(s.decisions, 100)))}`;
}

/** « Plus de 17 000 » : articles arrondis au millier bas. */
export function libelleArticles(s: PublicStats): string {
    return `Plus de ${formatFr(arrondiBas(s.articles, 1000))}`;
}

/**
 * Cache au niveau du module : quatre sections d'accueil affichent ces chiffres
 * (Impact, PiliersAccess, les deux piliers de ScrollReveal). Sans ce cache, une
 * seule visite déclencherait quatre appels identiques — exactement le gaspillage
 * qu'on vient de supprimer sur la recherche. Une requête par chargement de page.
 */
let statsEnCours: Promise<PublicStats> | null = null;

export async function fetchPublicStats(): Promise<PublicStats> {
    if (!statsEnCours) {
        statsEnCours = (async () => {
            try {
                const { data, error } = await supabase.rpc('get_public_stats');
                if (error || !data) return REPLI;
                return { ...REPLI, ...(data as Partial<PublicStats>) };
            } catch {
                return REPLI;
            }
        })();
    }
    return statsEnCours;
}

export async function fetchRecentPublications(limit = 6): Promise<RecentPublication[]> {
    try {
        const { data, error } = await supabase.rpc('get_recent_publications', { p_limit: limit });
        if (error || !Array.isArray(data)) return [];
        return data as RecentPublication[];
    } catch {
        return [];
    }
}

/** Libellé de pastille par catégorie (`laws_and_codes.category`). */
export const BADGE_CATEGORIE: Record<string, string> = {
    code: 'Code',
    loi: 'Loi',
    decret: 'Décret',
    arrete: 'Arrêté',
    ohada: 'OHADA',
    cima: 'CIMA',
    convention_collective: 'Convention',
};

export function badgePour(category: string): string {
    return BADGE_CATEGORIE[category] ?? 'Texte';
}

/**
 * Ligne secondaire d'une carte « récemment publié ». `reference` est souvent
 * NULL et `short_title` l'est sur 121 des 158 textes actifs — d'où les replis
 * successifs jusqu'au simple nombre d'articles.
 */
export function metaPour(p: RecentPublication): string {
    const parts: string[] = [];
    if (p.reference && p.reference.length <= 60) parts.push(p.reference);
    else if (p.publication_date) parts.push(String(new Date(p.publication_date).getFullYear()));
    if (p.nb_articles > 0) parts.push(`${formatFr(p.nb_articles)} articles`);
    return parts.join(' · ') || badgePour(p.category);
}
