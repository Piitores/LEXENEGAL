/**
 * recherche - logique PURE de la page /search et de l'aperçu de l'accueil (testée à part,
 * cf. __tests__/recherche.test.ts). Aucune lecture réseau ici : les composants appellent la
 * base, ce module décide quoi afficher et quels filtres envoyer.
 *
 * Lots B et C de l'audit de la recherche (27/09/2026) :
 *  - bases de textes (sélecteur de l'onglet « Codes & articles ») ;
 *  - pastilles de matière à plusieurs valeurs (arbitrage : « Pénale » inclut « Criminelle ») ;
 *  - case « Non renseignée » pour les décisions sans matière (lot C5) ;
 *  - chambre rattachée à sa juridiction (couples « Juridiction::Chambre ») ;
 *  - total réel des décisions (count_decisions_fts, borné) et message de fin de liste ;
 *  - carte « Meilleur résultat » (abrogation signalée) et aperçu de l'accueil, liens par la
 *    règle unique (urls.ts).
 */
import { articleLabel } from './articleLabel';
import { urlArticle, urlTexte } from './urls';

// ---------------------------------------------------------------------------
// Texte sans accents (filtres locaux : doctrine, etc.)
// ---------------------------------------------------------------------------

/** Minuscules sans accents : « Créance » → « creance ». */
export function sansAccents(s: string | null | undefined): string {
    return (s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

/** Un des champs contient-il la saisie, sans tenir compte des accents ni de la casse ? */
export function contientSansAccents(champs: Array<string | null | undefined>, saisie: string): boolean {
    const q = sansAccents(saisie).trim();
    if (!q) return true;
    return champs.some((c) => sansAccents(c).includes(q));
}

// ---------------------------------------------------------------------------
// Bases de textes (onglet « Codes & articles »)
// ---------------------------------------------------------------------------

export type BaseTextes = 'tous' | 'codes' | 'loda' | 'communautaire' | 'conventions';

/**
 * Même mappage que lexenegal-mcp/src/bases.ts (BASE_CATEGORIES) : une catégorie de
 * `laws_and_codes.category` absente d'ici reste trouvable sans filtre, mais disparaît dès
 * qu'on restreint la base. Les deux copies doivent rester identiques.
 */
export const BASES_TEXTES: ReadonlyArray<{ cle: BaseTextes; libelle: string; titre: string; categories: string[] | null }> = [
    { cle: 'tous', libelle: 'Tous', titre: 'Tous les textes', categories: null },
    { cle: 'codes', libelle: 'Codes', titre: 'Codes', categories: ['code'] },
    { cle: 'loda', libelle: 'LODA', titre: 'Lois, décrets et arrêtés', categories: ['loi', 'decret', 'arrete'] },
    { cle: 'communautaire', libelle: 'Communautaire', titre: 'OHADA et CIMA', categories: ['ohada', 'cima'] },
    { cle: 'conventions', libelle: 'Conventions', titre: 'Conventions collectives', categories: ['convention_collective'] },
];

/** Catégories à transmettre pour une base (`null` = pas de filtre). */
export function categoriesDeBase(base: BaseTextes): string[] | null {
    return BASES_TEXTES.find((b) => b.cle === base)?.categories ?? null;
}

// ---------------------------------------------------------------------------
// Matières : pastilles et regroupements
// ---------------------------------------------------------------------------

/**
 * Regroupements arbitrés par le propriétaire (27/09/2026) : « Pénale » inclut « Criminelle ».
 * Clé = libellé affiché ; valeurs = `matiere_principale` réellement envoyées au filtre.
 */
export const REGROUPEMENTS_MATIERE: Record<string, string[]> = {
    'Pénale': ['Pénale', 'Criminelle'],
};

/**
 * Valeur de filtre des décisions SANS matière (lot C5 : 1 323 décisions actives au 27/09/2026,
 * que la vue des facettes ignore). Les RPC de décisions (search_decisions_fts, search_decisions_hybrid,
 * count_decisions_fts) la comprennent ; en parcours sans requête, elle devient
 * `matiere_principale is null` (filtreOuMatieres).
 */
export const MATIERE_NON_RENSEIGNEE = '(non renseignée)';

/** Libellé affiché d'une matière : « Non renseignée » plutôt que la valeur technique. */
export function libelleMatiere(v: string): string {
    return v === MATIERE_NON_RENSEIGNEE ? 'Non renseignée' : libelleFacette(v);
}

/**
 * Matières cochées → expression `.or()` PostgREST, pour le parcours sans requête (lecture
 * directe de la table) : `.in()` ne connaît pas « (non renseignée) », qui devient `is.null`.
 */
export function filtreOuMatieres(valeurs: string[]): string {
    const nommees = valeurs.filter((v) => v !== MATIERE_NON_RENSEIGNEE);
    const parts: string[] = [];
    if (nommees.length) parts.push(`matiere_principale.in.(${nommees.map(valeurPostgrest).join(',')})`);
    if (valeurs.includes(MATIERE_NON_RENSEIGNEE)) parts.push('matiere_principale.is.null');
    return parts.join(',');
}

export interface PastilleMatiere {
    libelle: string;
    /** `null` = « Tous » (aucun filtre de matière). */
    valeurs: string[] | null;
}

const pastille = (libelle: string): PastilleMatiere => ({ libelle, valeurs: REGROUPEMENTS_MATIERE[libelle] ?? [libelle] });

export const PASTILLES_MATIERE: PastilleMatiere[] = [
    { libelle: 'Tous', valeurs: null },
    pastille('Civile'),
    pastille('Sociale'),
    pastille('Pénale'),
    pastille('Commerciale'),
    pastille('Administrative'),
];

/** Toutes les valeurs d'un groupe sont-elles cochées ? (`null` : aucune matière cochée) */
export function valeursActives(valeurs: string[] | null, selection: string[]): boolean {
    if (valeurs === null) return selection.length === 0;
    return valeurs.length > 0 && valeurs.every((v) => selection.includes(v));
}

/** Coche ou décoche un groupe de valeurs d'un bloc (jamais à moitié). */
export function basculerValeurs(valeurs: string[] | null, selection: string[]): string[] {
    if (valeurs === null) return [];
    if (valeursActives(valeurs, selection)) return selection.filter((m) => !valeurs.includes(m));
    return [...selection, ...valeurs.filter((v) => !selection.includes(v))];
}

/**
 * Puces des matières cochées, dans l'ordre de la sélection : un groupe entièrement coché
 * (« Pénale » = Pénale + Criminelle) donne UNE puce ; le reste, une puce par valeur.
 */
export function pucesMatiere(selection: string[]): Array<{ libelle: string; valeurs: string[] }> {
    const vues = new Set<string>();
    const out: Array<{ libelle: string; valeurs: string[] }> = [];
    for (const v of selection) {
        if (vues.has(v)) continue;
        const groupe = Object.entries(REGROUPEMENTS_MATIERE).find(([, vals]) => vals.includes(v) && vals.every((x) => selection.includes(x)));
        if (groupe) {
            out.push({ libelle: groupe[0], valeurs: groupe[1] });
            groupe[1].forEach((x) => vues.add(x));
        } else {
            out.push({ libelle: v, valeurs: [v] });
            vues.add(v);
        }
    }
    return out;
}

/**
 * Liste des matières du panneau de filtres, regroupements appliqués : « Criminelle » n'apparaît
 * plus seule, son compte est ajouté à « Pénale » (qui la coche avec elle). Tri par nombre de
 * décisions, « Non renseignée » toujours en dernier.
 */
export function matieresRegroupees(comptes: Record<string, number>): Array<{ libelle: string; valeurs: string[]; n: number }> {
    const membres = new Set<string>();
    Object.entries(REGROUPEMENTS_MATIERE).forEach(([tete, vals]) => vals.forEach((v) => { if (v !== tete) membres.add(v); }));
    const out: Array<{ libelle: string; valeurs: string[]; n: number }> = [];
    Object.entries(comptes).forEach(([matiere, n]) => {
        if (membres.has(matiere)) return;
        const valeurs = REGROUPEMENTS_MATIERE[matiere] ?? [matiere];
        out.push({ libelle: matiere, valeurs, n: valeurs.reduce((s, v) => s + (comptes[v] ?? 0), 0) });
    });
    // Un membre dont la tête de groupe est absente des facettes reste proposé seul.
    Object.entries(REGROUPEMENTS_MATIERE).forEach(([tete, vals]) => {
        if (comptes[tete] !== undefined) return;
        vals.filter((v) => v !== tete && comptes[v] !== undefined).forEach((v) => out.push({ libelle: v, valeurs: [v], n: comptes[v] }));
    });
    const enDernier = (m: { libelle: string }) => (m.libelle === MATIERE_NON_RENSEIGNEE ? 1 : 0);
    return out.sort((a, b) => enDernier(a) - enDernier(b) || b.n - a.n);
}

// ---------------------------------------------------------------------------
// Juridictions et chambres
// ---------------------------------------------------------------------------

/** Ligne de `get_decision_facets().juridictions`. */
export interface LigneFacetteJuridiction {
    juridiction: string | null;
    chambre: string | null;
    n: number;
}

export interface GroupeJuridictions {
    total: number;
    /** Juridictions réelles du groupe (libellé exact en base → nombre de décisions). */
    subJuridictions: Record<string, number>;
    /** Chambre → nombre de décisions du groupe et juridictions réelles du groupe qui l'ont. */
    chambres: Record<string, { n: number; juridictions: string[] }>;
}

/**
 * Groupe d'affichage d'une juridiction. Arbitrage du 27/09/2026 : « Cour suprême » regroupe
 * la Cour suprême, l'ex-Cour de cassation et l'ex-Conseil d'État (réforme de 2008).
 */
export function groupeDeJuridiction(j: string | null | undefined): string {
    if (!j) return 'Autres';
    const lower = j.toLowerCase().replace(/’/g, "'");
    if (lower.includes('ccja') || lower.includes('commune de justice')) return 'CCJA';
    if (lower.includes('conseil constitutionnel')) return 'Conseil Constitutionnel';
    if (lower.includes("cour d'appel") || lower.includes('cour d appel')) return "Cour d'Appel";
    if (lower.includes('tribunal') || lower.includes('tribunaux') || lower.includes('high court')) return 'Tribunaux';
    if (lower.includes('cour de cassation') || lower.includes('cour suprême') || lower.includes('cour supreme')
        || lower.includes("conseil d'état") || lower.includes('conseil d etat') || lower.includes("conseil d'etat")
        || lower === 'la cour') return 'Cour Suprême';
    return 'Autres';
}

/** Arbre des facettes : groupe → juridictions réelles et chambres (rattachées à leurs juridictions). */
export function construireArbreJuridictions(lignes: LigneFacetteJuridiction[]): Record<string, GroupeJuridictions> {
    const arbre: Record<string, GroupeJuridictions> = {};
    for (const row of lignes || []) {
        const n = row.n || 0;
        const j = row.juridiction || 'Non spécifié';
        const groupe = groupeDeJuridiction(j);
        const g = (arbre[groupe] ??= { total: 0, subJuridictions: {}, chambres: {} });
        g.total += n;
        if (j !== groupe) g.subJuridictions[j] = (g.subJuridictions[j] || 0) + n;
        if (row.chambre) {
            const c = (g.chambres[row.chambre] ??= { n: 0, juridictions: [] });
            c.n += n;
            if (row.juridiction && !c.juridictions.includes(row.juridiction)) c.juridictions.push(row.juridiction);
        }
    }
    return arbre;
}

/** Séparateur du couple juridiction/chambre, le même que celui des RPC de décisions. */
export const SEP_CHAMBRE = '::';

/** Clé de sélection d'une chambre DANS un groupe (deux groupes ne partagent plus la case). */
export function cleChambre(groupe: string, chambre: string): string {
    return `${groupe}${SEP_CHAMBRE}${chambre}`;
}

export function lireCleChambre(cle: string): { groupe: string; chambre: string } {
    const i = cle.indexOf(SEP_CHAMBRE);
    return i < 0 ? { groupe: '', chambre: cle } : { groupe: cle.slice(0, i), chambre: cle.slice(i + SEP_CHAMBRE.length) };
}

/**
 * Filtre de chambre envoyé aux RPC : pour chaque chambre cochée sous un groupe, les couples
 * « Juridiction réelle::Chambre » des juridictions de CE groupe qui ont cette chambre.
 * Ex. « Première chambre » sous CCJA → « Cour commune de justice et d'arbitrage (CCJA)::Première chambre »
 * (29 décisions), et non toutes les « Première chambre » de la base (755).
 */
export function filtreChambres(selection: string[], arbre: Record<string, GroupeJuridictions> | undefined): string[] | null {
    if (!selection.length || !arbre) return null;
    const couples = new Set<string>();
    for (const cle of selection) {
        const { groupe, chambre } = lireCleChambre(cle);
        (arbre[groupe]?.chambres[chambre]?.juridictions ?? []).forEach((j) => couples.add(`${j}${SEP_CHAMBRE}${chambre}`));
    }
    return couples.size ? Array.from(couples) : null;
}

/** Filtre de juridiction : un groupe coché vaut toutes ses juridictions réelles. */
export function filtreJuridictions(selection: string[], arbre: Record<string, GroupeJuridictions> | undefined): string[] | null {
    if (!selection.length) return null;
    const out = new Set<string>();
    for (const j of selection) {
        out.add(j);
        Object.keys(arbre?.[j]?.subJuridictions ?? {}).forEach((s) => out.add(s));
    }
    return Array.from(out);
}

/** Valeur entre guillemets pour un filtre logique PostgREST (`or=(...)`). */
function valeurPostgrest(v: string): string {
    return `"${v.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

/**
 * Couples « Juridiction::Chambre » → expression `.or()` PostgREST, pour le parcours sans requête
 * (lecture directe de la table, sans RPC).
 */
export function filtreOuChambres(couples: string[]): string {
    return couples
        .map((c) => {
            const i = c.indexOf(SEP_CHAMBRE);
            if (i < 0) return `chambre.eq.${valeurPostgrest(c)}`;
            return `and(juridiction.eq.${valeurPostgrest(c.slice(0, i))},chambre.eq.${valeurPostgrest(c.slice(i + SEP_CHAMBRE.length))})`;
        })
        .join(',');
}

/** Libellé lisible d'une valeur de facette (tirets simples, pas de soulignés). */
export function libelleFacette(s: string): string {
    return (s || '').replace(/_/g, ' ').replace(/\s*[\u2013\u2014]\s*/g, ' - ');
}

// ---------------------------------------------------------------------------
// Total des décisions
// ---------------------------------------------------------------------------

/** Plafond du comptage (count_decisions_fts : un résultat égal au plafond veut dire « au moins »). */
export const PLAFOND_TOTAL_DECISIONS = 1000;

export interface TotalAffiche {
    n: number;
    /** `true` : « plus de n ». */
    plus: boolean;
}

/**
 * Total affiché des décisions.
 * - `total` : count_decisions_fts (décisions qui contiennent les mots), `null` s'il a échoué ;
 * - `charges` : décisions réellement listées ; `encore` : la base a renvoyé une ligne de plus.
 * La liste hybride peut ajouter des décisions proches par le sens qui ne contiennent pas les
 * mots : si elle dépasse le compte, on affiche ce qui est listé (jamais moins que la liste).
 */
export function totalDecisions(p: { total: number | null; plafond: number; charges: number; encore: boolean }): TotalAffiche {
    if (p.total === null) return { n: p.charges, plus: p.encore };
    if (p.total >= p.plafond) return { n: Math.max(p.plafond, p.charges), plus: true };
    if (p.charges > p.total) return { n: p.charges, plus: p.encore };
    return { n: p.total, plus: false };
}

const nombreFr = (n: number) => n.toLocaleString('fr-FR');

export function formatTotal(t: TotalAffiche): string {
    return t.plus ? `plus de ${nombreFr(t.n)}` : nombreFr(t.n);
}

/** Version courte pour les pastilles d'onglet : « 1 000+ ». */
export function formatTotalCourt(t: TotalAffiche): string {
    return t.plus ? `${nombreFr(t.n)}+` : nombreFr(t.n);
}

export function ajouterAuTotal(t: TotalAffiche, k: number): TotalAffiche {
    return { n: t.n + k, plus: t.plus };
}

/**
 * En tri par pertinence, la liste fusionnée (mots + sens) s'arrête vers 300 décisions. Quand
 * sa fin est atteinte alors que le total réel est plus grand, renvoie le total à annoncer
 * (« 1 680 », « plus de 1 000 ») pour inviter à trier par date ; sinon `null`.
 */
export function totalAParcourir(p: { tri: string; total: number | null; plafond: number; charges: number; encore: boolean }): string | null {
    if (p.tri !== 'relevance' || p.encore || p.total === null || p.charges === 0) return null;
    if (p.total <= p.charges) return null;
    return p.total >= p.plafond ? `plus de ${nombreFr(p.plafond)}` : nombreFr(p.total);
}

// ---------------------------------------------------------------------------
// Carte « Meilleur résultat » (resolve_citation)
// ---------------------------------------------------------------------------

/**
 * `estAbroge` n'est pas renvoyé par resolve_citation : il est posé ensuite par
 * completerMeilleurResultat, à partir de lectures complémentaires (lecturesMeilleurResultat).
 */
export type MeilleurResultat =
    | { kind: 'article'; titre: string; meta: string; href: string; codeSlug: string; articleId: string | null; estAbroge?: boolean }
    | { kind: 'texte'; titre: string; href: string; codeSlug: string; estAbroge?: boolean }
    | { kind: 'choix'; titre: string; codeSlug: string; options: OptionChoix[] }
    | { kind: 'decision'; titre: string; meta: string; href: string };

export interface OptionChoix {
    libelle: string;
    href: string;
    articleId: string | null;
    estAbroge?: boolean;
}

/** Nombre maximal d'options affichées pour une référence ambiguë. */
export const MAX_OPTIONS_CHOIX = 5;

/**
 * Réponse de resolve_citation → carte à afficher (ou `null`). Liens construits par la règle
 * unique (urls.ts) : une convention collective part vers /ccn/…, jamais vers /code/ccn-….
 * « non publié » et intention « concept » → pas de carte (la liste gère).
 */
export function carteMeilleurResultat(data: any): MeilleurResultat | null {
    if (!data || data.intent !== 'authority') return null;
    const r = data.result;
    if (!r) return null;
    if (data.kind === 'norme' && r.status === 'ok' && r.code_slug && r.article_slug) {
        return {
            kind: 'article',
            titre: articleLabel({ article_number: r.article_number }),
            meta: r.code_title || r.code_slug,
            href: urlArticle(r.code_slug, r.article_slug),
            codeSlug: r.code_slug,
            articleId: r.article_id ?? null,
        };
    }
    if (data.kind === 'norme' && r.status === 'desambiguisation' && r.code_slug && Array.isArray(r.options)) {
        const options: OptionChoix[] = r.options
            .filter((o: any) => o && o.article_slug)
            .slice(0, MAX_OPTIONS_CHOIX)
            .map((o: any) => ({
                libelle: articleLabel({ article_number: o.article_number }),
                href: urlArticle(r.code_slug, o.article_slug),
                articleId: o.article_id ?? null,
            }));
        if (!options.length) return null;
        // resolve_article ne renvoie JAMAIS code_title pour une référence ambiguë (seulement
        // code_slug) : le titre est lu à part (lecturesMeilleurResultat), vide en attendant.
        return { kind: 'choix', titre: r.code_title || '', codeSlug: r.code_slug, options };
    }
    if (data.kind === 'texte' && r.status === 'ok' && r.code_slug) {
        return { kind: 'texte', titre: r.code_title || r.code_slug, href: urlTexte(r.code_slug), codeSlug: r.code_slug };
    }
    if (data.kind === 'decision' && r.status === 'ok' && r.match?.slug) {
        const m = r.match;
        const date = m.date_decision && !isNaN(Date.parse(m.date_decision)) ? new Date(m.date_decision).toLocaleDateString('fr-FR') : '';
        return {
            kind: 'decision',
            titre: m.reference || 'Décision',
            meta: [m.juridiction, m.chambre, date].filter(Boolean).join(' · '),
            href: `/decision/${m.slug}`,
        };
    }
    return null;
}

/**
 * Lectures qui complètent la carte : le texte (titre court, abrogation en entier) et le statut
 * des articles proposés. Rien pour une décision.
 */
export function lecturesMeilleurResultat(c: MeilleurResultat | null): { codeSlug: string | null; articleIds: string[] } {
    if (!c || c.kind === 'decision') return { codeSlug: null, articleIds: [] };
    if (c.kind === 'article') return { codeSlug: c.codeSlug, articleIds: c.articleId ? [c.articleId] : [] };
    if (c.kind === 'choix') return { codeSlug: c.codeSlug, articleIds: c.options.map((o) => o.articleId).filter((id): id is string => !!id) };
    return { codeSlug: c.codeSlug, articleIds: [] };
}

export interface InfosMeilleurResultat {
    /** Titre du texte, comme resolve_article : `short_title`, sinon `title`. */
    titreTexte: string | null;
    /** Texte abrogé en entier (`laws_and_codes.abrogated_by_slug`). */
    texteAbroge: boolean;
    /** Ids des articles au statut « abrogé ». */
    articlesAbroges: string[];
}

/**
 * Pose l'abrogation sur la carte, avec la même règle que la liste, l'aperçu de l'accueil et la
 * base (fn_poids_vigueur) : article au statut « abrogé » OU texte abrogé en entier. Arbitrage du
 * 27/09 : les abrogés restent trouvables mais toujours signalés, y compris en tête.
 * Référence ambiguë : le titre du texte, que resolve_article ne renvoie pas, est complété.
 */
export function completerMeilleurResultat(c: MeilleurResultat, infos: InfosMeilleurResultat): MeilleurResultat {
    const abroge = (id: string | null) => infos.texteAbroge || (!!id && infos.articlesAbroges.includes(id));
    switch (c.kind) {
        case 'article':
            return { ...c, estAbroge: abroge(c.articleId) };
        case 'texte':
            return { ...c, estAbroge: infos.texteAbroge };
        case 'choix':
            return {
                ...c,
                titre: c.titre || infos.titreTexte || '',
                options: c.options.map((o) => ({ ...o, estAbroge: abroge(o.articleId) })),
            };
        default:
            return c;
    }
}

// ---------------------------------------------------------------------------
// Aperçu de l'accueil (search_apercu)
// ---------------------------------------------------------------------------

export interface ResultatApercu {
    type: 'texte' | 'decision' | 'article';
    id: string;
    title: string;
    subtitle: string;
    href: string;
    /** Texte ou article abrogé : signalé dans l'aperçu comme sur /search. */
    estAbroge?: boolean;
}

/**
 * Réponse de search_apercu → lignes de l'aperçu. Le texte nommé dans la saisie (« code
 * pénal », « AUSCGIE ») vient en premier, puis les décisions, puis les articles.
 */
export function resultatsApercu(data: any): ResultatApercu[] {
    const out: ResultatApercu[] = [];
    if (!data) return out;
    const t = data.texte;
    if (t && t.code_slug) {
        out.push({
            type: 'texte',
            id: t.code_slug,
            title: t.code_title || t.code_slug,
            subtitle: 'Texte complet',
            href: urlTexte(t.code_slug),
            estAbroge: !!t.est_abroge,
        });
    }
    for (const d of Array.isArray(data.decisions) ? data.decisions : []) {
        if (!d?.slug) continue;
        const annee = d.date_decision && !isNaN(Date.parse(d.date_decision)) ? String(new Date(d.date_decision).getFullYear()) : '';
        out.push({
            type: 'decision',
            id: d.id || d.slug,
            title: d.reference || 'Décision',
            subtitle: [d.chambre || d.juridiction || 'Juridiction', annee].filter(Boolean).join(' · '),
            href: `/decision/${d.slug}`,
        });
    }
    // Sans code connu, pas de lien : jamais de renvoi par défaut vers un code.
    for (const a of Array.isArray(data.articles) ? data.articles : []) {
        if (!a?.code_slug || !a?.article_slug) continue;
        out.push({
            type: 'article',
            id: a.id || `${a.code_slug}/${a.article_slug}`,
            title: articleLabel({ article_number: a.article_number }),
            subtitle: a.code_title || 'Code',
            href: urlArticle(a.code_slug, a.article_slug),
            estAbroge: !!a.est_abroge,
        });
    }
    return out;
}

// ---------------------------------------------------------------------------
// Requête dans l'adresse
// ---------------------------------------------------------------------------

/**
 * Chaîne de recherche (`?…`) avec `q` mis à jour, les autres paramètres conservés.
 * Requête vide → `q` retiré.
 */
export function rechercheAvecRequete(search: string, q: string): string {
    const params = new URLSearchParams(search);
    const t = q.trim();
    if (t) params.set('q', t); else params.delete('q');
    const s = params.toString();
    return s ? `?${s}` : '';
}
