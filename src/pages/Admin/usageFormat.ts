// Fonctions pures de l'onglet Usage de l'admin (connecteur MCP + API REST) :
// libellés en français simple, dates fr-FR, préparation des barres du graphique.
// Aucune dépendance à React ni à Supabase -> testées dans src/lib/__tests__.

/** Statut d'une clé d'API, tel que renvoyé par `admin_usage_stats()`. */
export type StatutCle = 'active' | 'expiree' | 'revoquee';

/** Libellé et classe de badge (report-status--*) de chaque statut. */
export const STATUT_CLE: Record<StatutCle, { libelle: string; classe: string }> = {
    active: { libelle: 'Active', classe: 'report-status--resolved' },
    expiree: { libelle: 'Expirée', classe: 'report-status--expired' },
    revoquee: { libelle: 'Révoquée', classe: 'report-status--pending' },
};

/**
 * Statut réel d'une clé : une clé révoquée l'emporte sur tout ; une clé encore
 * active mais dont la date d'expiration est passée est refusée par l'API, elle
 * est donc « expirée » et non « active ».
 */
export function statutCle(isActive: boolean, expiresAt: string | null, now: Date = new Date()): StatutCle {
    if (!isActive) return 'revoquee';
    if (expiresAt) {
        const t = Date.parse(expiresAt);
        if (!isNaN(t) && t < now.getTime()) return 'expiree';
    }
    return 'active';
}

// Les 12 outils du serveur MCP, dans les mots du propriétaire.
const LIBELLES_OUTILS: Record<string, string> = {
    search_legislation: 'Recherche de textes',
    search_jurisprudence: 'Recherche de jurisprudence',
    search_doctrine: 'Recherche de doctrine',
    get_article: "Lecture d'un article",
    get_decision: "Lecture d'une décision",
    resolve_citation: "Résolution d'une référence",
    list_citing_decisions: 'Décisions citant un article',
    list_cited_legislation: 'Textes visés par une décision',
    list_article_doctrine: 'Doctrine sur un article',
    list_article_annotations: "Annotations d'un article",
    list_doctrine_articles: 'Articles commentés par une doctrine',
    submit_feedback: "Signalement d'erreur",
};

/** Libellé français d'un outil MCP ; un outil inconnu garde son nom brut. */
export function libelleOutil(outil: string): string {
    return LIBELLES_OUTILS[outil] ?? outil;
}

/**
 * Nom lisible du logiciel client. `client` vient de `clientInfo.name` (déclaré
 * par le logiciel à l'ouverture de la connexion) ou, à défaut, du user-agent :
 * on cherche donc un indice dans le texte plutôt qu'une égalité stricte.
 */
export function libelleClient(client: string): string {
    const c = (client || '').toLowerCase();
    if (c.includes('claude')) return 'Claude';
    if (c.includes('openai') || c.includes('chatgpt')) return 'ChatGPT';
    if (c.includes('cursor')) return 'Cursor';
    if (c.includes('vscode') || c.includes('visual studio')) return 'VS Code';
    if (c.includes('mcp-remote')) return 'Passerelle mcp-remote';
    return client;
}

const LIBELLES_DOMAINES: Record<string, string> = {
    articles: 'Textes',
    decisions: 'Jurisprudence',
    doctrine: 'Doctrine',
};

/** Domaine d'une recherche (champ `surface`) : articles -> Textes, etc. */
export function libelleDomaine(surface: string): string {
    return LIBELLES_DOMAINES[surface] ?? surface;
}

/** « 1 recherche », « 5 recherches » ; 0 prend le singulier, comme en français. */
export function accord(n: number, singulier: string, pluriel: string): string {
    return `${n.toLocaleString('fr-FR')} ${n > 1 ? pluriel : singulier}`;
}

function dateValide(iso: string | null | undefined): Date | null {
    if (!iso) return null;
    const d = new Date(iso);
    return isNaN(d.getTime()) ? null : d;
}

/** Date au format JJ/MM/AAAA, ou `repli` si absente ou illisible. */
export function formatDateFr(iso: string | null | undefined, repli = '-'): string {
    const d = dateValide(iso);
    return d ? d.toLocaleDateString('fr-FR') : repli;
}

/** Date et heure au format JJ/MM/AAAA HH:MM, ou `repli`. */
export function formatDateHeureFr(iso: string | null | undefined, repli = '-'): string {
    const d = dateValide(iso);
    return d
        ? d.toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
        : repli;
}

/**
 * Ancienneté lisible d'une date : « aujourd'hui », « hier », « il y a 3 jours ».
 * Compte en jours calendaires (heure locale), pas en tranches de 24 h.
 */
export function ilYA(iso: string | null | undefined, now: Date = new Date()): string {
    const d = dateValide(iso);
    if (!d) return '';
    const jour = (x: Date) => Date.UTC(x.getFullYear(), x.getMonth(), x.getDate());
    const n = Math.round((jour(now) - jour(d)) / 86_400_000);
    if (n <= 0) return "aujourd'hui";
    if (n === 1) return 'hier';
    return `il y a ${n} jours`;
}

/**
 * Lundi d'une semaine (« 2026-06-08 ») -> « 08/06 », ou « 08/06/2026 ».
 * Lu comme texte, pas comme Date : une date sans heure est prise pour minuit
 * UTC et reculerait d'un jour à l'ouest de Greenwich.
 */
export function formatSemaine(semaine: string, avecAnnee = false): string {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(semaine || '');
    if (!m) return semaine;
    return avecAnnee ? `${m[3]}/${m[2]}/${m[1]}` : `${m[3]}/${m[2]}`;
}

/**
 * Côté MCP, les autres appels et les conversations ne sont connus que depuis
 * `suiviDepuis` (premier enregistrement `mcp_usage` ; null = pas encore suivi).
 * Une semaine (lundi « 2026-06-08 », semaines UTC comme en base) est suivie si
 * le suivi a commencé avant sa fin : la semaine du démarrage est partielle.
 */
export function semaineSuivie(semaine: string, suiviDepuis: string | null): boolean {
    if (!suiviDepuis) return false;
    const debut = Date.parse((semaine || '').slice(0, 10));
    const depuis = Date.parse(suiviDepuis);
    if (isNaN(debut) || isNaN(depuis)) return false;
    return depuis < debut + 7 * 86_400_000;
}

/** Une semaine de `by_week` (MCP ou API) ; `sessions` n'existe que côté MCP. */
export interface SemaineUsage { week: string; searches: number; other_calls: number; sessions?: number; }

/** Une barre empilée prête à dessiner. `hauteur` est en % de la plus haute. */
export interface Barre {
    semaine: string;
    libelle: string;
    recherches: number;
    autres: number;
    total: number;
    hauteur: number;
    /** Libellé gardé sur mobile (un sur deux, toujours la semaine la plus récente). */
    libelleMobile: boolean;
}

const positif = (n: unknown) => Math.max(0, Number(n) || 0);

/** Barres du graphique hebdomadaire : recherches + autres appels, hauteur relative au maximum (au moins 1). */
export function preparerBarres(semaines: SemaineUsage[]): Barre[] {
    const lignes = (semaines || []).map(s => ({ s, recherches: positif(s.searches), autres: positif(s.other_calls) }));
    const max = Math.max(1, ...lignes.map(l => l.recherches + l.autres));
    return lignes.map(({ s, recherches, autres }, i) => {
        const total = recherches + autres;
        return {
            semaine: s.week,
            libelle: formatSemaine(s.week),
            recherches,
            autres,
            total,
            hauteur: (total / max) * 100,
            libelleMobile: (lignes.length - 1 - i) % 2 === 0,
        };
    });
}
