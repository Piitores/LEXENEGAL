import React, { useEffect, useRef, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { articleLabel } from '../../lib/articleLabel';
import { isAutomatedAgent } from '../../lib/botDetect';
import { urlArticle } from '../../lib/urls';
import {
    BASES_TEXTES, categoriesDeBase, type BaseTextes,
    PASTILLES_MATIERE, valeursActives, basculerValeurs, matieresRegroupees, pucesMatiere,
    MATIERE_NON_RENSEIGNEE, libelleMatiere, filtreOuMatieres,
    construireArbreJuridictions, cleChambre, lireCleChambre, filtreChambres, filtreJuridictions,
    filtreOuChambres, libelleFacette, type GroupeJuridictions,
    PLAFOND_TOTAL_DECISIONS, totalDecisions, formatTotal, formatTotalCourt, ajouterAuTotal, totalAParcourir,
    type TotalAffiche, carteMeilleurResultat, lecturesMeilleurResultat, completerMeilleurResultat,
    type MeilleurResultat, rechercheAvecRequete,
} from '../../lib/recherche';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion';
import './SearchPage.css';


// Retire les balises HTML pour l'aperçu d'un article
const stripHtml = (html: string) =>
    (html || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

// --- TYPES ---
interface Decision {
    id: string;
    reference: string;
    date_decision: string;
    matiere_principale: string;
    juridiction: string;
    chambre: string;
    resume: string;
    slug: string;
    mots_cles: string[];
}

interface ArticleHit {
    id: string;
    article_number: string;
    slug: string;
    code_slug: string;
    code_title: string;
    content: string;
    // Abrogation : NON renvoyée par les RPC de recherche (search_articles /
    // search_articles_hybrid), qui s'en servent seulement pour classer les abrogés après
    // (× 0,6). On la lit à part, à partir des ids déjà obtenus, avec la même règle que la
    // base (fn_poids_vigueur, search_apercu) : article au statut « abrogé » OU texte
    // abrogé en entier (laws_and_codes.abrogated_by_slug, ex. Code du travail de 1997).
    est_abroge?: boolean;
}

/** Bilan d'un pilier de la recherche fédérée, pour le journal (`search_events`). */
interface BilanPilier {
    n: number;
    mode: 'hybrid' | 'fts' | null;
    ok: boolean;
    /** Instant (performance.now) où le pilier a fini : la latence journalisée n'inclut pas les suggestions. */
    fin?: number;
}
const BILAN_VIDE: BilanPilier = { n: 0, mode: null, ok: true };

interface DoctrineHit {
    id: string;
    reference_complete: string;
    objet: string | null;
    annee: number | null;
    date: string | null;
    /** Lu à part sur `doctrine` (les RPC ne le renvoient pas) : lien vers la fiche. */
    slug?: string | null;
}

interface Facettes {
    matiere_principale?: Record<string, number>;
    juridictionTree?: Record<string, GroupeJuridictions>;
}

/** Total réel des décisions et son plafond (Infinity : compte exact, sans plafond). */
interface TotalReel {
    n: number;
    plafond: number;
}

const TAILLE_PAGE = 20;

const versDecision = (d: any): Decision => ({
    id: d.id,
    reference: d.reference || 'Décision',
    date_decision: d.date_decision,
    matiere_principale: d.matiere_principale,
    juridiction: d.juridiction,
    chambre: d.chambre,
    resume: d.resume,
    slug: d.slug || d.id,
    mots_cles: d.mots_cles || []
});

/** « Voir les 348 résultats », « Voir plus de 1 000 résultats ». */
const libelleVoirResultats = (t: TotalAffiche): string => {
    const n = t.n.toLocaleString('fr-FR');
    if (t.plus) return `Voir plus de ${n} résultats`;
    if (t.n === 0) return 'Voir les résultats';
    if (t.n === 1) return 'Voir le résultat';
    return `Voir les ${n} résultats`;
};

/** « Voir les 348 → », « Voir plus de 1 000 → » (lien d'une section de l'onglet Tout). */
const libelleVoirSection = (t: TotalAffiche): string =>
    t.plus ? `Voir plus de ${t.n.toLocaleString('fr-FR')} →` : `Voir les ${t.n.toLocaleString('fr-FR')} →`;

const SearchPage: React.FC = () => {
    const [searchParams] = useSearchParams();
    const location = useLocation();
    const queryParam = searchParams.get('q') || '';
    const [query, setQuery] = useState(queryParam);

    const [results, setResults] = useState<Decision[]>([]);
    // Total RÉEL des décisions (count_decisions_fts, borné ; compte exact en parcours sans
    // requête). `null` : inconnu (comptage en échec). Remplace l'ancienne estimation
    // « offset + 21 » (audit du 27/09 : « Jurisprudence 21 » quel que soit le total).
    const [totalReel, setTotalReel] = useState<TotalReel | null>(null);
    // La base a-t-elle renvoyé une ligne de plus que la page ? Seule source de « Voir plus ».
    const [encore, setEncore] = useState(false);

    // Onglet actif + résultats "Codes & articles"
    const [activeTab, setActiveTab] = useState<'tout' | 'decisions' | 'articles' | 'doctrine'>('tout');
    const [articleResults, setArticleResults] = useState<ArticleHit[]>([]);
    const [articlesLoading, setArticlesLoading] = useState(false);
    // Onglet « Codes & articles » : base de textes (mêmes catégories que le MCP) et
    // interrupteur « En vigueur uniquement » (arbitrage du 27/09 : les abrogés restent
    // cherchables, signalés et classés après ; l'interrupteur les masque).
    const [base, setBase] = useState<BaseTextes>('tous');
    const [enVigueur, setEnVigueur] = useState(false);
    const baseRef = useRef<BaseTextes>(base);
    baseRef.current = base;
    const [doctrineResults, setDoctrineResults] = useState<DoctrineHit[]>([]);
    const [doctrineLoading, setDoctrineLoading] = useState(false);
    // Garde contre les réponses périmées : chaque recherche prend un numéro ; seule la plus
    // récente a le droit d'afficher. Un compteur par pilier, car un changement de filtre ne
    // relance que les décisions et un changement de base que les articles.
    const rechercheSeqRef = useRef(0);
    const articlesSeqRef = useRef(0);
    const doctrineSeqRef = useRef(0);
    // L'utilisateur a-t-il choisi un onglet manuellement ? (sinon on choisit pour lui selon la requête)
    const userPickedTab = useRef(false);
    // Analytics : dernier terme déjà loggé (évite de logger 2× la même requête).
    const loggedQueryRef = useRef<string>('');
    // Requête actuellement affichée : une recherche terminée n'est journalisée que si
    // l'utilisateur ne l'a pas remplacée entre-temps (pas de bribes de frappe dans le journal).
    const latestQueryRef = useRef<string>('');
    // Mode effectif de la dernière recherche par pilier ('hybrid' via edge function, sinon 'fts' fallback).
    const doctrineModeRef = useRef<'hybrid' | 'fts'>('fts');
    const articleModeRef = useRef<'hybrid' | 'fts'>('fts');
    const decisionsModeRef = useRef<'hybrid' | 'fts'>('fts');
    const [suggestions, setSuggestions] = useState<Decision[]>([]);
    const [facets, setFacets] = useState<Facettes>({});
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [offset, setOffset] = useState(0);

    // Détection de références structurées → carte « meilleur résultat »
    const [bestMatch, setBestMatch] = useState<MeilleurResultat | null>(null);

    const navigate = useNavigate();

    // --- ACCORDION STATE ---
    const [openSections, setOpenSections] = useState<Record<string, boolean>>({
        date: true,
        juridiction: true,
        themes: true
    });

    const [expandedJuridictions, setExpandedJuridictions] = useState<Record<string, boolean>>({});

    const toggleSection = (section: string) => {
        setOpenSections(prev => ({ ...prev, [section]: !prev[section] }));
    };

    const toggleJuridiction = (juri: string) => {
        setExpandedJuridictions(prev => ({ ...prev, [juri]: !prev[juri] }));
    };

    // Panneau de filtres replié par défaut (mobile ET desktop, style Lexis 360)
    const [filtersOpen, setFiltersOpen] = useState(false);

    // Panneau ouvert : fermeture à Échap, focus déplacé dans le panneau puis
    // restauré au déclencheur ; sur mobile (bottom sheet plein écran) le fond
    // (résultats + navbar) est rendu inerte pour les utilisateurs clavier/AT.
    useEffect(() => {
        if (!filtersOpen) return;
        const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        const panel = document.getElementById('search-filters');
        (panel?.querySelector('.filtersClose') as HTMLElement | null)?.focus();

        const inerted: HTMLElement[] = [];
        if (window.matchMedia('(max-width: 1023px)').matches) {
            document.querySelectorAll<HTMLElement>('.resultsArea, .navbar').forEach((el) => {
                if (!el.inert) { el.inert = true; inerted.push(el); }
            });
        }

        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setFiltersOpen(false); };
        window.addEventListener('keydown', onKey);
        return () => {
            window.removeEventListener('keydown', onKey);
            inerted.forEach((el) => { el.inert = false; });
            opener?.focus();
        };
    }, [filtersOpen]);

    // --- FILTERS STATE ---
    const [selectedMatiere, setSelectedMatiere] = useState<string[]>([]);
    // Chambres cochées : clés « Groupe::Chambre » (cleChambre), une case par groupe ; le filtre
    // envoyé aux RPC est fait des couples « Juridiction réelle::Chambre » (filtreChambres).
    const [selectedChambre, setSelectedChambre] = useState<string[]>([]);
    const [selectedJuridiction, setSelectedJuridiction] = useState<string[]>([]);
    const [sortOption, setSortOption] = useState<'relevance' | 'date_desc' | 'date_asc'>('relevance');

    // DATE FILTERS
    const [datePreset, setDatePreset] = useState<'3y' | '5y' | 'custom' | null>(null);
    const [customYearStart, setCustomYearStart] = useState<string>('');
    const [customYearEnd, setCustomYearEnd] = useState<string>('');

    // Puces des filtres actifs (lisibles : « CCJA · Première chambre », « Pénale »…).
    const pucesMatieres = pucesMatiere(selectedMatiere);
    const libellePeriode = datePreset === '3y' ? '3 ans'
        : datePreset === '5y' ? '5 ans'
        : (customYearStart || customYearEnd) ? `${customYearStart || '…'} - ${customYearEnd || '…'}`
        : null;

    // Nombre de filtres actifs (pastille sur l'onglet « Filtres »)
    const activeFilterCount =
        pucesMatieres.length + selectedChambre.length + selectedJuridiction.length +
        (libellePeriode ? 1 : 0);

    // --- PASTILLES DE MATIÈRE (raccourcis, éventuellement à plusieurs valeurs) ---
    const handlePillClick = (valeurs: string[] | null) => {
        setSelectedMatiere(prev => basculerValeurs(valeurs, prev));
        setOffset(0);
    };


    useEffect(() => { latestQueryRef.current = (query || '').trim(); }, [query]);

    // Sync URL param. `location.key` : une nouvelle navigation vers /search?q=… recharge la
    // requête même si le paramètre lu par le routeur n'a pas changé (la page réécrit ?q= elle-même,
    // par replaceState, sans passer par le routeur).
    useEffect(() => {
        setQuery(queryParam);
        setOffset(0);
        userPickedTab.current = false; // nouvelle requête → on laissera l'onglet se choisir automatiquement
    }, [queryParam, location.key]);

    // La requête tapée dans la page est reportée dans l'adresse (?q=) : un retour arrière
    // depuis un résultat retrouve la recherche. replaceState : l'historique ne s'allonge pas
    // à chaque frappe, et l'état du routeur (clé, index) est conservé.
    const reporterRequeteDansAdresse = (term: string) => {
        if (typeof window === 'undefined' || !window.location.pathname.startsWith('/search')) return;
        const search = rechercheAvecRequete(window.location.search, term);
        if (search === window.location.search) return;
        try {
            window.history.replaceState(window.history.state, '', `${window.location.pathname}${search}${window.location.hash}`);
        } catch (e) {
            console.warn('adresse non mise à jour:', e);
        }
    };

    // Piliers « Codes & articles » et « Doctrine ».
    // Ils sont désormais servis par l'appel FÉDÉRÉ de `performSearch` (un seul
    // appel edge, un seul embedding Voyage pour les 3 piliers) — cf. diagnostic
    // perf 2026-07-27. Chaque pilier garde son repli FTS INDÉPENDANT : si
    // l'hybride échoue pour lui seul, on retombe sur sa RPC FTS sans pénaliser
    // les autres. `hybridRows === null` = pas de résultat hybride → repli.
    // `seq` : numéro de la recherche d'articles (articlesSeqRef) ; une réponse dépassée par une
    // recherche plus récente (autre requête, autre base) n'affiche rien.
    // `categories` : base de textes choisie (null = toutes) → category_filter du repli FTS.
    const applyArticles = async (term: string, hybridRows: any[] | null, seq: number, categories: string[] | null): Promise<BilanPilier> => {
        const courante = () => seq === articlesSeqRef.current;
        let mode: 'hybrid' | 'fts' = 'hybrid';
        try {
            let rows = hybridRows;
            if (rows === null) {
                mode = 'fts';
                const { data, error } = await supabase.rpc('search_articles', {
                    search_query: term,
                    result_limit: 50,
                    ...(categories ? { category_filter: categories } : {}),
                });
                if (error) throw error;
                rows = data || [];
            }
            // Sans code connu, pas de lien : jamais de renvoi par défaut vers un code
            // (l'ancien repli visait le Code du travail de 1997, abrogé).
            const hits: ArticleHit[] = (rows || []).filter((a: any) => a.code_slug && a.slug).map((a: any) => ({
                id: a.id,
                article_number: a.article_number,
                slug: a.slug,
                code_slug: a.code_slug,
                code_title: a.code_title || 'Code',
                content: a.content || ''
            }));

            // Marquage des articles ABROGÉS (article au statut « abrogé » ou texte abrogé en
            // entier) : deux petites lectures parallèles sur ce qui a déjà été trouvé (≤ 50
            // lignes). Sans ce signal, un article abrogé se lit comme du droit en vigueur. Si
            // elles échouent, on affiche les résultats sans badge plutôt que de perdre la recherche.
            if (hits.length) {
                try {
                    const codes = Array.from(new Set(hits.map(h => h.code_slug)));
                    const [{ data: st }, { data: textesAbroges }] = await Promise.all([
                        supabase.from('articles').select('id').in('id', hits.map(h => h.id)).eq('status', 'abrogé'),
                        supabase.from('laws_and_codes').select('slug').in('slug', codes).not('abrogated_by_slug', 'is', null),
                    ]);
                    const abroges = new Set((st || []).map((r: any) => r.id));
                    const codesAbroges = new Set((textesAbroges || []).map((r: any) => r.slug));
                    hits.forEach(h => { h.est_abroge = abroges.has(h.id) || codesAbroges.has(h.code_slug); });
                } catch (e) {
                    console.warn('statut abrogation non récupéré:', e);
                }
            }
            if (courante()) {
                articleModeRef.current = mode;
                setArticleResults(hits);
            }
            return { n: hits.length, mode, ok: true, fin: performance.now() };
        } catch (e) {
            if (courante()) setArticleResults([]);
            console.warn('search articles error:', e);
            return { n: 0, mode, ok: false, fin: performance.now() };
        } finally {
            if (courante()) setArticlesLoading(false);
        }
    };

    // Changement de base (onglet « Codes & articles ») : on ne relance QUE les articles. Grâce
    // au cache d'embeddings de la fonction edge, le texte n'est pas réembeddé.
    const rechercherArticles = async (term: string, categories: string[] | null) => {
        const seq = ++articlesSeqRef.current;
        if (term.length < 2) { setArticlesLoading(false); return; }
        setArticlesLoading(true);
        let rows: any[] | null = null;
        try {
            const { data: ef, error: efErr } = await supabase.functions.invoke('search', {
                body: { surface: 'articles', query: term, limit: 50, ...(categories ? { filters: { categories } } : {}) },
            });
            // Base restreinte : on ne se fie à l'hybride que s'il confirme avoir appliqué le
            // filtre (`categories` dans la réponse ; une version antérieure de la fonction
            // l'ignorait). Sinon, repli plein texte, filtré en base.
            if (!efErr && ef && !ef.fallback && Array.isArray(ef.results) && (!categories || Array.isArray(ef.categories))) {
                rows = ef.results;
            }
        } catch (e) {
            rows = null;
        }
        await applyArticles(term, rows, seq, categories);
    };

    const applyDoctrine = async (term: string, hybridRows: any[] | null, seq: number): Promise<BilanPilier> => {
        const courante = () => seq === doctrineSeqRef.current;
        let mode: 'hybrid' | 'fts' = 'hybrid';
        try {
            let rows = hybridRows;
            if (rows === null) {
                mode = 'fts';
                const { data, error } = await supabase.rpc('search_doctrine', {
                    search_query: term,
                    result_limit: 30
                });
                if (error) throw error;
                rows = data || [];
            }
            const hits = (rows || []) as DoctrineHit[];
            // Slugs des fiches : les RPC ne les renvoient pas. UNE lecture par ids (≤ 30), comme
            // lexenegal-mcp (noyauClient.searchDoctrine). Sans slug, repli sur la liste générale.
            if (hits.length) {
                try {
                    const { data: sl } = await supabase.from('doctrine').select('id,slug').in('id', hits.map(h => h.id));
                    const slugs = new Map<string, string>((sl || []).map((r: any) => [String(r.id), r.slug]));
                    hits.forEach(h => { h.slug = slugs.get(String(h.id)) ?? null; });
                } catch (e) {
                    console.warn('slugs de doctrine non récupérés:', e);
                }
            }
            if (courante()) {
                doctrineModeRef.current = mode;
                setDoctrineResults(hits);
            }
            return { n: hits.length, mode, ok: true, fin: performance.now() };
        } catch (e) {
            if (courante()) setDoctrineResults([]);
            console.warn('search doctrine error:', e);
            return { n: 0, mode, ok: false, fin: performance.now() };
        } finally {
            if (courante()) setDoctrineLoading(false);
        }
    };

    // Défaut « Tout » (fédéré) : plus de re-forçage automatique vers la jurisprudence
    // (dé-biaisage demandé). L'utilisateur choisit son périmètre via les onglets.

    // « Meilleur résultat » : référence structurée (article, texte ou décision) résolue par le
    // NOYAU en base (RPC resolve_citation, source unique) → cible directe, en TÊTE et
    // SANS occulter la liste FTS (condition proprio). Référence ambiguë (« article 10 du code
    // électoral » → L.10 | R.10) : petite liste de choix. « Non publié » : pas de carte.
    // Liens par la règle unique (urls.ts) : conventions sous /ccn/.
    // resolve_citation ne dit pas si la cible est abrogée ni, pour une référence ambiguë, quel
    // est le texte : deux petites lectures complémentaires (texte par son slug, statut des
    // articles par leurs ids), avec la même règle que la liste. La carte n'apparaît qu'une fois
    // complète (pas de badge qui surgit après coup) ; si ces lectures échouent, elle s'affiche
    // sans badge plutôt que pas du tout.
    useEffect(() => {
        const q = (query || '').trim();
        setBestMatch(null);
        if (q.length < 3) return;
        let active = true;
        (async () => {
            const { data, error } = await supabase.rpc('resolve_citation', { q });
            if (error || !active) return;
            const carte = carteMeilleurResultat(data);
            if (!carte) return;
            let complete = carte;
            const { codeSlug, articleIds } = lecturesMeilleurResultat(carte);
            if (codeSlug) {
                try {
                    const [texte, articles] = await Promise.all([
                        supabase.from('laws_and_codes').select('title, short_title, abrogated_by_slug').eq('slug', codeSlug).limit(1),
                        articleIds.length
                            ? supabase.from('articles').select('id').in('id', articleIds).eq('status', 'abrogé')
                            : null,
                    ]);
                    if (texte.error) throw texte.error;
                    if (articles?.error) throw articles.error;
                    const t = (texte.data || [])[0] as { title?: string | null; short_title?: string | null; abrogated_by_slug?: string | null } | undefined;
                    complete = completerMeilleurResultat(carte, {
                        titreTexte: t ? (t.short_title || t.title || null) : null,
                        texteAbroge: !!t?.abrogated_by_slug,
                        articlesAbroges: (articles?.data || []).map((r: any) => String(r.id)),
                    });
                } catch (e) {
                    console.warn('statut du meilleur résultat non récupéré:', e);
                }
            }
            if (active) setBestMatch(complete);
        })();
        return () => { active = false; };
    }, [query]);

    // Analytics requêtable (search_events) : UNE écriture par recherche, à la FIN de la
    // recherche fédérée (les 3 piliers terminés), avec le mode réellement employé, la durée
    // mesurée et un statut. L'ancienne version écrivait 1,2 s après la frappe, souvent AVANT
    // les résultats : 44 % de faux « zéro résultat » sur 90 jours (audit du 27/09/2026).
    // Série marquée `v: 2`. Fire-and-forget : ne doit jamais gêner la recherche.
    // `complements` : clés ajoutées seulement quand elles servent (base de textes choisie,
    // « en vigueur uniquement », total réel des décisions). Rien d'autre ne change : la
    // fonction ne contraint que `source`, les vues lisent v, statut et piliers_en_erreur.
    const journaliserRecherche = (
        term: string,
        t0: number,
        decisions: BilanPilier & { plus: boolean },
        articles: BilanPilier,
        doctrine: BilanPilier,
        statut: 'ok' | 'erreur' | 'delai',
        filtres: number,
        complements: Record<string, unknown> = {},
    ) => {
        if (term.length < 3) return;
        if (typeof navigator !== 'undefined' && isAutomatedAgent(navigator.userAgent || '')) return;
        // Fin de la recherche = le plus tardif des trois piliers (hors suggestions « Vouliez-vous dire »).
        const fin = Math.max(decisions.fin ?? 0, articles.fin ?? 0, doctrine.fin ?? 0) || performance.now();
        const latence = Math.round(fin - t0);
        // On laisse passer la frappe : seule la requête restée affichée 1 s est journalisée.
        setTimeout(() => {
            if (latestQueryRef.current !== term || loggedQueryRef.current === term) return;
            loggedQueryRef.current = term;
            const modes = [decisions.mode, articles.mode, doctrine.mode].filter(Boolean);
            const globalMode = modes.length === 0
                ? null
                : modes.every((m) => m === 'hybrid') ? 'hybrid' : modes.every((m) => m === 'fts') ? 'fts' : 'mixed';
            void supabase.rpc('log_search_event', {
                p_source: 'front',
                p_query: term,
                p_surface: 'all',
                p_mode: globalMode,
                p_result_count: decisions.n + articles.n + doctrine.n,
                p_latency_ms: latence,
                p_metadata: {
                    v: 2,
                    statut,
                    // Comptes de la PREMIÈRE page ; `decisions_plus` = d'autres décisions existent.
                    decisions: decisions.n,
                    decisions_plus: decisions.plus,
                    articles: articles.n,
                    doctrine: doctrine.n,
                    decisions_mode: decisions.mode,
                    articles_mode: articles.mode,
                    doctrine_mode: doctrine.mode,
                    filtres,
                    ...complements,
                    ...(articles.ok && doctrine.ok ? {} : { piliers_en_erreur: [articles.ok ? null : 'articles', doctrine.ok ? null : 'doctrine'].filter(Boolean) }),
                },
            }).then(undefined, () => { /* logging best-effort */ });
        }, 1000);
    };

    const selectTab = (tab: 'tout' | 'decisions' | 'articles' | 'doctrine') => {
        userPickedTab.current = true;
        setActiveTab(tab);
    };

    // TRIGGER SEARCH — la requête a changé : recherche FÉDÉRÉE (1 appel edge pour
    // les 3 piliers, 1 seul embedding Voyage au lieu de 3).
    useEffect(() => {
        const term = query?.trim() || '';
        // Seuils par pilier : articles ≥ 2 caractères, doctrine ≥ 3. En dessous,
        // le pilier est vidé et n'est pas demandé à l'edge function. Son numéro de recherche
        // avance aussi : une réponse encore en vol pour l'ancienne requête (« licenciement »
        // effacé pendant l'appel) devient périmée et ne réaffiche rien.
        if (term.length < 2) { ++articlesSeqRef.current; setArticleResults([]); setArticlesLoading(false); }
        if (term.length < 3) { ++doctrineSeqRef.current; setDoctrineResults([]); setDoctrineLoading(false); }
        const timer = setTimeout(() => {
            performSearch(false, true);
        }, 300);
        return () => clearTimeout(timer);
    }, [query]);

    // Filtres / tri / dates : SEULES les décisions sont concernées (articles et
    // doctrine ne sont pas filtrés) → on ne rejoue qu'elles, sans réembedder.
    // Le montage initial est déjà couvert par l'effet ci-dessus, on le saute.
    const filtersMountedRef = useRef(false);
    useEffect(() => {
        if (!filtersMountedRef.current) { filtersMountedRef.current = true; return; }
        const timer = setTimeout(() => {
            performSearch(false, false);
        }, 300);
        return () => clearTimeout(timer);
    }, [selectedMatiere, selectedChambre, selectedJuridiction, sortOption, datePreset, customYearStart, customYearEnd]);

    // LOAD MORE — pagination : décisions seules.
    useEffect(() => {
        if (offset > 0) performSearch(true, false);
    }, [offset]);

    // Base de textes changée : on ne relance que les articles (le montage initial est couvert
    // par la recherche fédérée, qui lit la base courante).
    const baseMonteeRef = useRef(false);
    useEffect(() => {
        if (!baseMonteeRef.current) { baseMonteeRef.current = true; return; }
        const term = (query || '').trim();
        if (term.length < 2) return;
        void rechercherArticles(term, categoriesDeBase(base));
    }, [base]);

    // Load facets once on mount (static counts for all decisions)
    useEffect(() => {
        const loadFacets = async () => {
            try {
                // Facettes agrégées côté serveur (TOUTES les décisions, pas un échantillon plafonné à 1000).
                // En parallèle, le compte des décisions actives SANS matière, que la vue des
                // facettes ignore : case « Non renseignée » (lot C5 ; les RPC acceptent la valeur).
                const [{ data: facetData, error: facetErr }, sansMatiere] = await Promise.all([
                    supabase.rpc('get_decision_facets'),
                    supabase.from('decisions').select('id', { count: 'exact', head: true })
                        .eq('is_active', true).is('matiere_principale', null),
                ]);

                if (facetData && !facetErr) {
                    const matiereCount: Record<string, number> = {};
                    (facetData.matieres || []).forEach((m: any) => {
                        if (m.matiere_principale) matiereCount[m.matiere_principale] = m.n;
                    });
                    if (!sansMatiere.error && typeof sansMatiere.count === 'number' && sansMatiere.count > 0) {
                        matiereCount[MATIERE_NON_RENSEIGNEE] = sansMatiere.count;
                    }
                    // Groupes (CCJA, Cour Suprême…) → juridictions réelles, et chaque chambre
                    // rattachée aux juridictions du groupe qui l'ont (lignes {juridiction, chambre, n}).
                    setFacets({
                        matiere_principale: matiereCount,
                        juridictionTree: construireArbreJuridictions(facetData.juridictions || []),
                    });
                }
            } catch (e) {
                console.warn('Error loading facets:', e);
            }
        };
        loadFacets();
    }, []);

    // `federated` : la requête vient de changer → on demande les 3 piliers en UN
    // appel (un seul embedding). Sinon (filtres, tri, pagination) → décisions seules.
    const performSearch = async (append: boolean, federated = false) => {
        // Garde contre les réponses périmées : seule la recherche la plus récente affiche.
        const seq = ++rechercheSeqRef.current;
        const courante = () => seq === rechercheSeqRef.current;
        setLoading(true);
        setError(null);
        // Une nouvelle première page remet la pagination à zéro (tri, dates, filtres…) :
        // sinon « Voir plus » repartait de l'ancien décalage et sautait des pages.
        if (!append) setOffset(0);
        const t0 = performance.now();
        const searchTermLog = query?.trim() || '';
        let pArticles: Promise<BilanPilier> = Promise.resolve(BILAN_VIDE);
        let pDoctrine: Promise<BilanPilier> = Promise.resolve(BILAN_VIDE);
        // Mode tenté pour les décisions, capturé ICI (une recherche concurrente peut écraser la ref).
        let modeDecisions: 'hybrid' | 'fts' | null = null;
        let finDecisions: number | undefined;
        // Base et interrupteur au moment de la recherche (journal).
        const baseCourante = baseRef.current;
        const categories = categoriesDeBase(baseCourante);
        const complementsJournal: Record<string, unknown> = {
            ...(baseCourante !== 'tous' ? { base: baseCourante } : {}),
            ...(enVigueur ? { en_vigueur: true } : {}),
        };
        try {
            const searchTerm = searchTermLog;
            if (federated) reporterRequeteDansAdresse(searchTerm);
            const currentOffset = append ? offset : 0;
            const pageSize = TAILLE_PAGE;
            // Une ligne de plus que la page : « Voir plus » n'apparaît que si la base l'a
            // réellement renvoyée (jamais d'une estimation).
            const sonde = pageSize + 1;

            // Prepare filter arrays (null if empty)
            const matiereFilter = selectedMatiere.length > 0 ? selectedMatiere : null;
            const chambreFilter = filtreChambres(selectedChambre, facets.juridictionTree);
            const finalJuridictionFilter = filtreJuridictions(selectedJuridiction, facets.juridictionTree);

            // Date filters
            const currentYear = new Date().getFullYear();
            let dateFrom: string | null = null;
            let dateTo: string | null = null;

            const validStart = /^\d{4}$/.test(customYearStart);
            const validEnd = /^\d{4}$/.test(customYearEnd);
            if (validStart || validEnd) {
                // Intervalle d'années personnalisé (prioritaire sur les presets)
                if (validStart) dateFrom = `${customYearStart}-01-01`;
                if (validEnd) dateTo = `${customYearEnd}-12-31`;
            } else if (datePreset === '3y') {
                dateFrom = `${currentYear - 3}-01-01`;
            } else if (datePreset === '5y') {
                dateFrom = `${currentYear - 5}-01-01`;
            }

            let rows: any[] = [];
            let total: TotalReel | null = null;

            if (searchTerm.length > 0) {
                const sortArg = sortOption === 'relevance' ? 'relevance' : sortOption === 'date_asc' ? 'date_asc' : 'date_desc';

                // Total RÉEL (borné à 1 000), compté en parallèle avec les mêmes filtres. Inutile
                // pour une page suivante : le total ne change pas.
                const pTotal: Promise<number | null> = append ? Promise.resolve(null) : (async () => {
                    try {
                        const { data, error } = await supabase.rpc('count_decisions_fts', {
                            search_query: searchTerm,
                            matiere_filter: matiereFilter,
                            chambre_filter: chambreFilter,
                            juridiction_filter: finalJuridictionFilter,
                            date_from: dateFrom,
                            date_to: dateTo,
                            cap: PLAFOND_TOTAL_DECISIONS,
                        });
                        return !error && typeof data === 'number' ? data : null;
                    } catch {
                        return null;
                    }
                })();

                // HYBRIDE via l'edge function `search` (tri + pagination + filtres) ; fallback FTS.
                let data: any[] = [];
                const decisionSpec = {
                    surface: 'decisions',
                    limit: sonde,
                    offset: currentOffset,
                    sort: sortArg,
                    // Le total est compté ici même (pTotal), quelle que soit la version déployée
                    // de la fonction edge : elle n'a pas à le recompter.
                    count: false,
                    filters: {
                        matiere: matiereFilter,
                        chambre: chambreFilter,
                        juridiction: finalJuridictionFilter,
                        date_from: dateFrom,
                        date_to: dateTo,
                    },
                };

                // Mode fédéré : un seul appel pour décisions + articles + doctrine.
                // Les piliers secondaires sont servis depuis CETTE réponse ; chacun
                // garde son repli FTS indépendant via applyArticles/applyDoctrine.
                const wantArticles = federated && searchTerm.length >= 2;
                const wantDoctrine = federated && searchTerm.length >= 3;
                const seqArticles = wantArticles ? ++articlesSeqRef.current : 0;
                const seqDoctrine = wantDoctrine ? ++doctrineSeqRef.current : 0;
                if (wantArticles) setArticlesLoading(true);
                if (wantDoctrine) setDoctrineLoading(true);

                const body = federated
                    ? {
                        query: searchTerm,
                        surfaces: [
                            decisionSpec,
                            ...(wantArticles ? [{ surface: 'articles', limit: 50, ...(categories ? { filters: { categories } } : {}) }] : []),
                            ...(wantDoctrine ? [{ surface: 'doctrine', limit: 30 }] : []),
                        ],
                    }
                    : { ...decisionSpec, query: searchTerm };

                const { data: ef, error: efErr } = await supabase.functions.invoke('search', { body });

                // Réponse fédérée = { results: { <surface>: {results,total} } } ;
                // réponse mono-surface (historique) = { results: [...] }.
                const bag =
                    federated && !efErr && ef && !ef.fallback && ef.results && !Array.isArray(ef.results)
                        ? (ef.results as Record<string, any>)
                        : null;

                if (federated) {
                    // On sert les piliers secondaires sans attendre les décisions.
                    // Base restreinte : l'hybride n'est retenu que s'il confirme avoir filtré.
                    const articlesHybrides = bag?.articles && !bag.articles.fallback && (!categories || Array.isArray(bag.articles.categories))
                        ? bag.articles.results
                        : null;
                    if (wantArticles) pArticles = applyArticles(searchTerm, articlesHybrides, seqArticles, categories);
                    if (wantDoctrine) pDoctrine = applyDoctrine(searchTerm, bag?.doctrine && !bag.doctrine.fallback ? bag.doctrine.results : null, seqDoctrine);
                }

                const hybridDecisions = federated
                    ? (bag?.decisions && !bag.decisions.fallback ? bag.decisions.results : null)
                    : (!efErr && ef && !ef.fallback && Array.isArray(ef.results) ? ef.results : null);

                if (hybridDecisions) {
                    data = hybridDecisions;
                    modeDecisions = 'hybrid';
                } else {
                    modeDecisions = 'fts';
                    const { data: ftsData, error: rpcError } = await supabase.rpc('search_decisions_fts', {
                        search_query: searchTerm,
                        matiere_filter: matiereFilter,
                        chambre_filter: chambreFilter,
                        juridiction_filter: finalJuridictionFilter,
                        date_from: dateFrom,
                        date_to: dateTo,
                        sort_by: sortArg,
                        result_limit: sonde,
                        result_offset: currentOffset
                    });
                    if (rpcError) throw rpcError;
                    data = ftsData || [];
                }
                if (courante()) decisionsModeRef.current = modeDecisions;

                rows = data || [];
                const n = await pTotal;
                total = n === null ? null : { n, plafond: PLAFOND_TOTAL_DECISIONS };

            } else {
                // No search term - use direct query for browsing
                let queryBuilder = supabase
                    .from('decisions')
                    .select('id, reference, slug, date_decision, matiere_principale, chambre, resume, mots_cles, juridiction', { count: 'exact' });

                // Matières : `.or()` plutôt que `.in()`, pour que « (non renseignée) » devienne
                // `matiere_principale is null`. Deux `.or()` (matières, chambres) se cumulent en ET.
                if (matiereFilter) queryBuilder = queryBuilder.or(filtreOuMatieres(matiereFilter));
                // Chambres : couples « Juridiction::Chambre » → (juridiction = … ET chambre = …) OU …
                if (chambreFilter) queryBuilder = queryBuilder.or(filtreOuChambres(chambreFilter));
                if (finalJuridictionFilter) queryBuilder = queryBuilder.in('juridiction', finalJuridictionFilter);
                if (dateFrom) queryBuilder = queryBuilder.gte('date_decision', dateFrom);
                if (dateTo) queryBuilder = queryBuilder.lte('date_decision', dateTo);

                queryBuilder = queryBuilder.order('date_decision', { ascending: sortOption === 'date_asc', nullsFirst: false });
                // Départage par clé unique : sans lui, les décisions d'une même date changent
                // d'ordre d'une page à l'autre (doublons et décisions jamais affichées).
                queryBuilder = queryBuilder.order('id', { ascending: true });
                queryBuilder = queryBuilder.range(currentOffset, currentOffset + sonde - 1);

                const { data, error: queryError, count } = await queryBuilder;
                if (queryError) throw queryError;

                rows = data || [];
                // Compte exact (sans plafond) ; seulement sur la première page.
                total = !append && typeof count === 'number' ? { n: count, plafond: Infinity } : null;
            }
            finDecisions = performance.now();

            const encoreLignes = rows.length > pageSize;
            const decisions = rows.slice(0, pageSize).map(versDecision);

            if (courante()) {
                if (append) {
                    // Garde-fou : une décision déjà affichée n'est pas répétée (ex. bascule
                    // hybride → plein texte d'une page à l'autre).
                    setResults(prev => {
                        const vues = new Set(prev.map(p => p.id));
                        return [...prev, ...decisions.filter(d => !vues.has(d.id))];
                    });
                } else {
                    setResults(decisions);
                    setTotalReel(total);

                    // 📊 Google Analytics 4 - Track search queries
                    if (searchTerm.length > 0 && typeof window !== 'undefined' && (window as any).gtag) {
                        (window as any).gtag('event', 'search', {
                            search_term: searchTerm,
                            results_count: total?.n ?? decisions.length,
                            filters_applied: activeFilterCount > 0 ? 'yes' : 'none'
                        });
                    }
                }
                setEncore(encoreLignes);
            }

            // 3.B - "Vouliez-vous dire" : si la recherche texte ne renvoie rien, proposer des décisions proches
            if (!append && searchTerm.length > 0 && decisions.length === 0) {
                const { data: sugg } = await supabase.rpc('search_decisions_suggest', {
                    search_query: searchTerm,
                    result_limit: 8
                });
                if (courante()) {
                    setSuggestions((sugg || []).map((d: any) => ({
                        id: d.id,
                        reference: d.reference || 'Décision',
                        date_decision: d.date_decision,
                        matiere_principale: '',
                        juridiction: d.juridiction || '',
                        chambre: d.chambre,
                        resume: d.resume,
                        slug: d.slug || d.id,
                        mots_cles: []
                    })));
                }
            } else if (!append && courante()) {
                setSuggestions([]);
            }

            if (federated) {
                const bilanDecisions = {
                    n: decisions.length,
                    plus: encoreLignes,
                    mode: modeDecisions,
                    ok: true,
                    fin: finDecisions,
                };
                const complements = {
                    ...complementsJournal,
                    // Total réel des décisions ; `decisions_total_plafond` : « au moins » ce nombre.
                    ...(total && Number.isFinite(total.plafond) ? {
                        decisions_total: total.n,
                        ...(total.n >= total.plafond ? { decisions_total_plafond: total.plafond } : {}),
                    } : {}),
                };
                void Promise.all([pArticles, pDoctrine]).then(([a, d]) =>
                    journaliserRecherche(searchTerm, t0, bilanDecisions, a, d, 'ok', activeFilterCount, complements));
            }

        } catch (err: any) {
            console.error("Search Error:", err);
            if (courante()) {
                setError(err.message);
                // Pas de « Voir plus » sur une recherche en échec.
                setEncore(false);
                // Première page en échec : la liste et le total de la recherche PRÉCÉDENTE ne
                // restent pas affichés sous le bandeau d'erreur comme s'ils y répondaient.
                if (!append) {
                    setResults([]);
                    setTotalReel(null);
                    setSuggestions([]);
                }
            }
            if (federated) {
                const delai = err?.code === '57014' || /timeout|statement timeout|canceling statement/i.test(err?.message || '');
                void Promise.all([pArticles, pDoctrine]).then(([a, d]) =>
                    journaliserRecherche(searchTermLog, t0, { n: 0, plus: false, mode: modeDecisions, ok: false, fin: performance.now() }, a, d, delai ? 'delai' : 'erreur', activeFilterCount, complementsJournal));
            }
        } finally {
            if (courante()) setLoading(false);
        }
    };

    const handleSearchInput = (e: React.ChangeEvent<HTMLInputElement>) => {
        setQuery(e.target.value);
        setOffset(0);
    };

    const toggleFilter = (type: 'matiere' | 'chambre' | 'juridiction', value: string) => {
        const setter = type === 'matiere' ? setSelectedMatiere : type === 'chambre' ? setSelectedChambre : setSelectedJuridiction;
        setter(prev => prev.includes(value) ? prev.filter(i => i !== value) : [...prev, value]);
        setOffset(0);
    };

    const changerTri = (tri: 'relevance' | 'date_desc' | 'date_asc') => {
        setSortOption(tri);
        setOffset(0);
    };

    const handleDatePreset = (preset: '3y' | '5y' | null) => {
        if (datePreset === preset) setDatePreset(null);
        else {
            setDatePreset(preset);
            setCustomYearStart('');
            setCustomYearEnd('');
        }
        setOffset(0);
    };

    const handleCustomYear = (which: 'start' | 'end', raw: string) => {
        const v = raw.replace(/\D/g, '').slice(0, 4);
        if (which === 'start') setCustomYearStart(v); else setCustomYearEnd(v);
        if (v) setDatePreset('custom');
        setOffset(0);
    };

    const effacerPeriode = () => {
        setDatePreset(null);
        setCustomYearStart('');
        setCustomYearEnd('');
        setOffset(0);
    };

    const clearFilters = () => {
        setSelectedMatiere([]);
        setSelectedChambre([]);
        setSelectedJuridiction([]);
        setDatePreset(null);
        setCustomYearStart('');
        setCustomYearEnd('');
        setSortOption('relevance');
        setOffset(0);
    };

    // Helper Component for Accordion
    const FilterAccordion = ({
        id,
        title,
        isOpen,
        toggle,
        children
    }: { id: string, title: string, isOpen: boolean, toggle: () => void, children: React.ReactNode }) => (
        <div className={`ghostAccordion ${isOpen ? 'open' : ''}`}>
            <motion.div
                className="accordionHeader"
                onClick={toggle}
                whileHover={{ opacity: 0.8 }}
            >
                <h3>{title}</h3>
                <motion.span
                    className="accordionIcon"
                    animate={{ rotate: isOpen ? 180 : 0 }}
                    transition={{ duration: 0.2 }}
                >
                    <svg width="10" height="6" viewBox="0 0 10 6" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <path d="M1 1L5 5L9 1" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                </motion.span>
            </motion.div>
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2, ease: "easeOut" }}
                        className="accordionContent"
                    >
                        {children}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );

    // Articles affichés : « En vigueur uniquement » masque les abrogés (compteurs compris).
    const articlesAffiches = enVigueur ? articleResults.filter(a => !a.est_abroge) : articleResults;
    const abrogesMasques = articleResults.length - articlesAffiches.length;

    // Total réel des décisions (ou « plus de 1 000 »), jamais une estimation.
    const totalDec = totalDecisions({
        total: totalReel?.n ?? null,
        plafond: totalReel?.plafond ?? Infinity,
        charges: results.length,
        encore,
    });
    const totalTout = ajouterAuTotal(totalDec, articlesAffiches.length + doctrineResults.length);
    // Fin de la liste par pertinence (≈ 300) plus courte que le total : inviter à trier par date.
    const aParcourir = totalAParcourir({
        tri: sortOption,
        total: totalReel?.n ?? null,
        plafond: totalReel?.plafond ?? Infinity,
        charges: results.length,
        encore,
    });

    // Compteur affiché pour l'onglet actif (toolbar + bouton « Voir les X résultats »)
    const currentTabTotal: TotalAffiche = activeTab === 'tout' ? totalTout
        : activeTab === 'decisions' ? totalDec
        : { n: activeTab === 'articles' ? articlesAffiches.length : doctrineResults.length, plus: false };

    return (
        <div className="searchPage linear-theme">
            {/* Onglet vertical « Filtres » (desktop, panneau replié) */}
            {!filtersOpen && (
                <button
                    className="filtersTab"
                    onClick={() => setFiltersOpen(true)}
                    aria-expanded={filtersOpen}
                    aria-controls="search-filters"
                >
                    <span className="filtersTab__label">Filtres</span>
                    {activeFilterCount > 0 && <span className="filtersTab__badge">{activeFilterCount}</span>}
                </button>
            )}

            <aside id="search-filters" className={`searchSidebar ghost-sidebar ${filtersOpen ? 'is-open' : ''}`}>
                <div className="sidebarTop">
                    <h2 className="sidebarTitle">Filtres</h2>
                    <div className="sidebarTopActions">
                        {activeFilterCount > 0 && (
                            <motion.button
                                onClick={clearFilters}
                                className="clearFiltersBtn"
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                            >
                                Effacer tout
                            </motion.button>
                        )}
                        <button className="filtersClose" onClick={() => setFiltersOpen(false)} aria-label="Fermer les filtres">✕</button>
                    </div>
                </div>

                {/* DATE */}
                <FilterAccordion id="date" title="Période" isOpen={openSections.date} toggle={() => toggleSection('date')}>
                    <div className="dateFilterContainer">
                        <div className="presetChips">
                            <button className={`presetChip ${datePreset === '3y' ? 'active' : ''}`} onClick={() => handleDatePreset('3y')}>
                                <span className="chipLabel">3 ans</span>
                            </button>
                            <button className={`presetChip ${datePreset === '5y' ? 'active' : ''}`} onClick={() => handleDatePreset('5y')}>
                                <span className="chipLabel">5 ans</span>
                            </button>
                        </div>
                        <div className="customDateInputs">
                            <label>Intervalle</label>
                            <div className="rangeInputs">
                                <input type="text" inputMode="numeric" placeholder="2020" value={customYearStart} onChange={(e) => handleCustomYear('start', e.target.value)} maxLength={4} />
                                <span className="rangeSep">-</span>
                                <input type="text" inputMode="numeric" placeholder="2024" value={customYearEnd} onChange={(e) => handleCustomYear('end', e.target.value)} maxLength={4} />
                            </div>
                        </div>
                    </div>
                </FilterAccordion>

                {/* JURIDICTION ET CHAMBRES */}
                <FilterAccordion id="juridiction" title="Juridictions" isOpen={openSections.juridiction} toggle={() => toggleSection('juridiction')}>
                    <ul className="filterList">
                        {facets.juridictionTree && Object.entries(facets.juridictionTree)
                            .sort((a, b) => b[1].total - a[1].total) // Sort by count descending
                            .map(([juridiction, data]) => (
                                <li key={juridiction} className="filterGroup">
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                                        <div className="filterItem juridictionItem" onClick={() => toggleFilter('juridiction', juridiction)} style={{ flex: 1, paddingRight: '8px' }}>
                                            <div className="checkbox-wrapper">
                                                <div className={`custom-checkbox ${selectedJuridiction.includes(juridiction) ? 'checked' : ''}`}>
                                                    {selectedJuridiction.includes(juridiction) && <span className="checkmark">✔</span>}
                                                </div>
                                                <span className="filterLabel" style={{ fontWeight: 600 }}>{libelleFacette(juridiction)}</span>
                                            </div>
                                            <span className="filterCount">({data.total})</span>
                                        </div>
                                        {Object.keys(data.chambres).length > 0 && (
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); toggleJuridiction(juridiction); }}
                                                className="expandJuridictionBtn"
                                                style={{ 
                                                    background: 'none', border: 'none', cursor: 'pointer', 
                                                    padding: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                    color: 'var(--text-secondary)', transition: 'transform 0.2s'
                                                }}
                                            >
                                                <svg 
                                                    width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                                                    style={{ transform: expandedJuridictions[juridiction] ? 'rotate(180deg)' : 'rotate(0deg)' }}
                                                >
                                                    <polyline points="6 9 12 15 18 9"></polyline>
                                                </svg>
                                            </button>
                                        )}
                                    </div>
                                    
                                    {/* Contenu dépliable : Sous-juridictions et chambres */}
                                    {expandedJuridictions[juridiction] && (
                                        <div style={{ paddingLeft: '1.5rem', marginTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                            
                                            {/* Sous-juridictions (Tribunaux spécifiques, etc) */}
                                            {Object.keys(data.subJuridictions).length > 0 && (
                                                <div className="subJuridictionsSection">
                                                    {Object.entries(data.subJuridictions)
                                                        .sort((a: any, b: any) => b[1] - a[1])
                                                        .map(([subJ, count]: [string, any]) => (
                                                            <li key={subJ} className="filterItem" onClick={() => toggleFilter('juridiction', subJ)} style={{ padding: '0.2rem 0' }}>
                                                                <div className="checkbox-wrapper">
                                                                    <div className={`custom-checkbox ${selectedJuridiction.includes(subJ) ? 'checked' : ''}`} style={{ width: '16px', height: '16px' }}>
                                                                        {selectedJuridiction.includes(subJ) && <span className="checkmark" style={{ fontSize: '10px' }}>✔</span>}
                                                                    </div>
                                                                    <span className="filterLabel" style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                                                                        {libelleFacette(subJ)}
                                                                    </span>
                                                                </div>
                                                                <span className="filterCount" style={{ fontSize: '0.8rem' }}>({count})</span>
                                                            </li>
                                                        ))}
                                                </div>
                                            )}

                                            {/* Chambres */}
                                            {Object.keys(data.chambres).length > 0 && (
                                                <div className="chambresSection" style={{ marginTop: Object.keys(data.subJuridictions).length > 0 ? '0.5rem' : '0' }}>
                                                    <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Chambres</div>
                                                    <ul className="subFilterList" style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                                        {/* Une chambre cochée ICI ne vaut que pour les juridictions de ce groupe
                                                            (« Première chambre » sous CCJA : 29 décisions, pas les 755 de la base). */}
                                                        {Object.entries(data.chambres)
                                                            .sort((a, b) => b[1].n - a[1].n)
                                                            .map(([chambre, info]) => {
                                                                const cle = cleChambre(juridiction, chambre);
                                                                const cochee = selectedChambre.includes(cle);
                                                                return (
                                                                <li key={cle} className="filterItem" onClick={() => toggleFilter('chambre', cle)} style={{ padding: '0.2rem 0' }}>
                                                                    <div className="checkbox-wrapper">
                                                                        <div className={`custom-checkbox ${cochee ? 'checked' : ''}`} style={{ width: '16px', height: '16px' }}>
                                                                            {cochee && <span className="checkmark" style={{ fontSize: '10px' }}>✔</span>}
                                                                        </div>
                                                                        <span className="filterLabel" style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                                                                            {libelleFacette(chambre)}
                                                                        </span>
                                                                    </div>
                                                                    <span className="filterCount" style={{ fontSize: '0.8rem' }}>({info.n})</span>
                                                                </li>
                                                                );
                                                            })}
                                                    </ul>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </li>
                            ))}
                    </ul>
                </FilterAccordion>

                {/* THEMES */}
                <FilterAccordion id="themes" title="Matières" isOpen={openSections.themes} toggle={() => toggleSection('themes')}>
                    <ul className="filterList">
                        {/* Regroupements arbitrés : « Pénale » coche aussi « Criminelle » (compte additionné). */}
                        {facets.matiere_principale && matieresRegroupees(facets.matiere_principale).map(m => {
                            const cochee = valeursActives(m.valeurs, selectedMatiere);
                            return (
                                <li key={m.libelle} className="filterItem" onClick={() => handlePillClick(m.valeurs)}>
                                    <div className="checkbox-wrapper">
                                        <div className={`custom-checkbox ${cochee ? 'checked' : ''}`}>
                                            {cochee && <span className="checkmark">✔</span>}
                                        </div>
                                        <span className="filterLabel">{libelleMatiere(m.libelle)}</span>
                                    </div>
                                    <span className="filterCount">({m.n})</span>
                                </li>
                            );
                        })}
                    </ul>
                </FilterAccordion>

                <div className="filtersApplyBar">
                    <button className="filtersApplyBtn" onClick={() => setFiltersOpen(false)}>
                        {libelleVoirResultats(currentTabTotal)}
                    </button>
                </div>
            </aside>

            {/* RESULTS */}
            <div className="resultsArea">
                <div className="searchHeader">
                    <input
                        type="text"
                        className="searchInput"
                        placeholder="Rechercher une décision, une loi..."
                        value={query}
                        onChange={handleSearchInput}
                        autoFocus={!queryParam}
                    />

                    {/* PASTILLES DE MATIÈRE (« Pénale » vise Pénale + Criminelle, arbitrage du 27/09) */}
                    <div className="contextual-pills">
                        {PASTILLES_MATIERE.map(pill => (
                            <motion.button
                                key={pill.libelle}
                                className={`pill ${valeursActives(pill.valeurs, selectedMatiere) ? 'active' : ''}`}
                                aria-pressed={valeursActives(pill.valeurs, selectedMatiere)}
                                onClick={() => handlePillClick(pill.valeurs)}
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                            >
                                {pill.libelle}
                            </motion.button>
                        ))}
                    </div>

                    {/* PUCES DES FILTRES ACTIFS (lisibles, retirables une à une) */}
                    {activeFilterCount > 0 && (
                        <ul className="activeFilters" aria-label="Filtres actifs">
                            {selectedJuridiction.map(j => (
                                <li key={`j-${j}`}>
                                    <button className="activeFilter" onClick={() => toggleFilter('juridiction', j)} aria-label={`Retirer le filtre ${libelleFacette(j)}`}>
                                        {libelleFacette(j)} <span aria-hidden="true">×</span>
                                    </button>
                                </li>
                            ))}
                            {selectedChambre.map(cle => {
                                const { groupe, chambre } = lireCleChambre(cle);
                                const libelle = `${libelleFacette(groupe)} · ${libelleFacette(chambre)}`;
                                return (
                                    <li key={`c-${cle}`}>
                                        <button className="activeFilter" onClick={() => toggleFilter('chambre', cle)} aria-label={`Retirer le filtre ${libelle}`}>
                                            {libelle} <span aria-hidden="true">×</span>
                                        </button>
                                    </li>
                                );
                            })}
                            {pucesMatieres.map(m => (
                                <li key={`m-${m.libelle}`}>
                                    <button className="activeFilter" onClick={() => setSelectedMatiere(prev => prev.filter(v => !m.valeurs.includes(v)))} aria-label={`Retirer le filtre ${libelleMatiere(m.libelle)}`}>
                                        {libelleMatiere(m.libelle)} <span aria-hidden="true">×</span>
                                    </button>
                                </li>
                            ))}
                            {libellePeriode && (
                                <li>
                                    <button className="activeFilter" onClick={effacerPeriode} aria-label={`Retirer le filtre de période ${libellePeriode}`}>
                                        {libellePeriode} <span aria-hidden="true">×</span>
                                    </button>
                                </li>
                            )}
                        </ul>
                    )}
                </div>

                {/* MEILLEUR RÉSULTAT (référence structurée) - en tête, n'occulte pas la liste.
                    Liens construits par la règle unique (urls.ts) : conventions sous /ccn/. */}
                {bestMatch && bestMatch.kind !== 'choix' && (
                    <Link to={bestMatch.href} className="best-match">
                        <span className="best-match__badge">★ Meilleur résultat</span>
                        <div className="best-match__body">
                            <div className="best-match__titre">
                                <strong>{bestMatch.titre}</strong>
                                {/* Abrogé : trouvable, mais signalé même en tête (arbitrage du 27/09). */}
                                {bestMatch.kind !== 'decision' && bestMatch.estAbroge && (
                                    <span className="badge-abroge" title={bestMatch.kind === 'texte' ? 'Ce texte a été abrogé' : 'Cet article a été abrogé'}>Abrogé</span>
                                )}
                            </div>
                            {bestMatch.kind === 'texte'
                                ? <span className="best-match__meta">Texte complet</span>
                                : bestMatch.meta && <span className="best-match__meta">{bestMatch.meta}</span>}
                        </div>
                    </Link>
                )}
                {bestMatch && bestMatch.kind === 'choix' && (
                    <div className="best-match best-match--choix">
                        <span className="best-match__badge">★ Plusieurs articles correspondent</span>
                        <div className="best-match__body">
                            {bestMatch.titre && <strong>{bestMatch.titre}</strong>}
                            <ul className="best-match__options">
                                {bestMatch.options.map(o => (
                                    <li key={o.href}>
                                        <Link to={o.href}>{o.libelle}</Link>
                                        {o.estAbroge && <span className="badge-abroge" title="Cet article a été abrogé">Abrogé</span>}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>
                )}

                {/* ONGLETS : Jurisprudence / Codes & articles */}
                <div className="searchTabs" role="tablist">
                    <button
                        role="tab"
                        aria-selected={activeTab === 'tout'}
                        className={`searchTab ${activeTab === 'tout' ? 'active' : ''}`}
                        onClick={() => selectTab('tout')}
                    >
                        Tout <span className="searchTabCount">{formatTotalCourt(totalTout)}</span>
                    </button>
                    <button
                        role="tab"
                        aria-selected={activeTab === 'decisions'}
                        className={`searchTab ${activeTab === 'decisions' ? 'active' : ''}`}
                        onClick={() => selectTab('decisions')}
                    >
                        Jurisprudence <span className="searchTabCount">{formatTotalCourt(totalDec)}</span>
                    </button>
                    <button
                        role="tab"
                        aria-selected={activeTab === 'articles'}
                        className={`searchTab ${activeTab === 'articles' ? 'active' : ''}`}
                        onClick={() => selectTab('articles')}
                    >
                        Codes &amp; articles <span className="searchTabCount">{articlesAffiches.length}</span>
                    </button>
                    <button
                        role="tab"
                        aria-selected={activeTab === 'doctrine'}
                        className={`searchTab ${activeTab === 'doctrine' ? 'active' : ''}`}
                        onClick={() => selectTab('doctrine')}
                    >
                        Doctrine <span className="searchTabCount">{doctrineResults.length}</span>
                    </button>
                </div>

                <div className="resultsToolbar">
                    <div className="resultsCount">
                        <span className="count-number">{formatTotal(currentTabTotal)}</span> résultat{currentTabTotal.plus || currentTabTotal.n > 1 ? 's' : ''}
                    </div>
                    <div className="toolbarActions">
                        <button
                            className="filtersToggle"
                            onClick={() => setFiltersOpen(true)}
                            aria-expanded={filtersOpen}
                            aria-controls="search-filters"
                        >
                            Filtres{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
                        </button>
                        {activeTab === 'decisions' && (
                            <select
                                className="sortSelect"
                                value={sortOption}
                                onChange={(e) => changerTri(e.target.value as 'relevance' | 'date_desc' | 'date_asc')}
                            >
                                <option value="relevance">Pertinence</option>
                                <option value="date_desc">Plus récent</option>
                                <option value="date_asc">Plus ancien</option>
                            </select>
                        )}
                    </div>
                </div>

                {error && <div className="errorBanner"><strong>Erreur technique :</strong> {error}</div>}

                {activeTab === 'tout' && (
                    <div className="tout-view">
                        {results.length > 0 && (
                            <section className="tout-section">
                                <div className="tout-section__head">
                                    <h3>Jurisprudence</h3>
                                    <button className="tout-voir" onClick={() => selectTab('decisions')}>{libelleVoirSection(totalDec)}</button>
                                </div>
                                <div className="resultsGrid">
                                    {results.slice(0, 4).map((d) => (
                                        <div key={d.id} className="resultCard linear-card" onClick={() => navigate(`/decision/${d.slug}`)}>
                                            <div className="cardHeader">
                                                <span className="cardRef">{d.reference || d.matiere_principale || d.juridiction}</span>
                                                <span className="cardDate">{[d.juridiction, d.chambre, d.date_decision && new Date(d.date_decision).toLocaleDateString('fr-FR')].filter(Boolean).join(' · ')}</span>
                                            </div>
                                            {d.resume && <p className="cardSnippet">{stripHtml(d.resume).slice(0, 200)}</p>}
                                        </div>
                                    ))}
                                </div>
                            </section>
                        )}
                        {articlesAffiches.length > 0 && (
                            <section className="tout-section">
                                <div className="tout-section__head">
                                    <h3>Codes &amp; articles</h3>
                                    <button className="tout-voir" onClick={() => selectTab('articles')}>Voir les {articlesAffiches.length} →</button>
                                </div>
                                <div className="resultsGrid">
                                    {articlesAffiches.slice(0, 4).map((art) => (
                                        <div key={art.id} className="resultCard linear-card" onClick={() => window.open(urlArticle(art.code_slug, art.slug), '_blank')}>
                                            <div className="cardHeader">
                                                <span className="cardRef">{articleLabel({ article_number: art.article_number })}</span>
                                                {art.est_abroge && <span className="badge-abroge" title="Cet article a été abrogé">Abrogé</span>}
                                                <span className="cardDate">{art.code_title}</span>
                                            </div>
                                            <p className="cardSnippet">{stripHtml(art.content).slice(0, 200)}</p>
                                        </div>
                                    ))}
                                </div>
                            </section>
                        )}
                        {doctrineResults.length > 0 && (
                            <section className="tout-section">
                                <div className="tout-section__head">
                                    <h3>Doctrine</h3>
                                    <button className="tout-voir" onClick={() => selectTab('doctrine')}>Voir les {doctrineResults.length} →</button>
                                </div>
                                <div className="resultsGrid">
                                    {doctrineResults.slice(0, 4).map((d) => (
                                        <div key={d.id} className="resultCard linear-card" onClick={() => navigate(d.slug ? `/doctrine-fiscale/${d.slug}` : '/doctrine-fiscale')}>
                                            <div className="cardHeader">
                                                <span className="cardRef">{d.reference_complete}</span>
                                                {d.annee && <span className="cardDate">{d.annee}</span>}
                                            </div>
                                            {d.objet && <p className="cardSnippet">{d.objet}</p>}
                                        </div>
                                    ))}
                                </div>
                            </section>
                        )}
                        {/* Pas de « Aucun résultat » sous un bandeau d'erreur : on ne sait pas. */}
                        {results.length === 0 && articlesAffiches.length === 0 && doctrineResults.length === 0 && !loading && !articlesLoading && !doctrineLoading && !error && query.trim().length >= 3 && (
                            <div className="emptyState"><p>Aucun résultat pour «&nbsp;{query}&nbsp;».</p></div>
                        )}
                    </div>
                )}

                {activeTab === 'decisions' && (<>
                <LayoutGroup>
                    <motion.div className="resultsGrid" layout>
                        <AnimatePresence>
                            {results.map((hit, idx) => (
                                <motion.div
                                    layout
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, scale: 0.95 }}
                                    transition={{ duration: 0.3 }}
                                    key={`${hit.id}-${idx}`}
                                    className="resultCard linear-card"
                                    onClick={() => window.open(`/decision/${hit.slug}`, '_blank')}
                                >
                                    <div className="cardHeader">
                                        <span className="cardRef">{hit.reference}</span>
                                        <span className="cardDate">
                                            {hit.date_decision && !isNaN(Date.parse(hit.date_decision))
                                                ? new Date(hit.date_decision).toLocaleDateString('fr-FR', { year: 'numeric', month: 'short', day: 'numeric' })
                                                : 'Date N/D'}
                                        </span>
                                    </div>
                                    <h2 className="cardTitle">{[hit.matiere_principale || hit.juridiction, hit.chambre].filter(Boolean).join(' - ') || 'Décision'}</h2>
                                    <p className="cardSnippet">{hit.resume || 'Aucun aperçu disponible pour ce document.'}</p>
                                    <div className="cardTags">
                                        {hit.mots_cles && hit.mots_cles.slice(0, 3).map(tag => (
                                            <span key={tag} className="tag">{tag}</span>
                                        ))}
                                    </div>
                                </motion.div>
                            ))}
                        </AnimatePresence>
                    </motion.div>
                </LayoutGroup>

                {!loading && !error && results.length === 0 && (
                    <div className="emptyState">
                        <p>Aucun résultat trouvé pour "{query}".</p>
                        {suggestions.length > 0 && (
                            <div className="suggestions">
                                <p className="suggestionsTitle">Vouliez-vous dire l'une de ces décisions&nbsp;?</p>
                                <div className="suggestionsList">
                                    {suggestions.map(s => (
                                        <div
                                            key={s.id}
                                            className="suggestionItem"
                                            onClick={() => window.open(`/decision/${s.slug}`, '_blank')}
                                        >
                                            <span className="cardRef">{s.reference}</span>
                                            {s.resume ? <span className="suggestionSnippet">{s.resume.slice(0, 120)}…</span> : null}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                        <button onClick={clearFilters}>Réinitialiser les filtres</button>
                    </div>
                )}

                {loading && <div className="loadingState"><div className="spinner"></div></div>}

                {/* « Voir plus » : seulement si la base a renvoyé une ligne de plus que la page. */}
                {!loading && encore && (
                    <div className="loadMoreContainer">
                        <button onClick={() => setOffset(p => p + TAILLE_PAGE)} className="loadMoreBtn">Voir plus</button>
                    </div>
                )}

                {/* Fin de la liste par pertinence (≈ 300 décisions) alors que le total est plus grand. */}
                {!loading && !error && aParcourir && (
                    <p className="finPertinence">
                        Seules les décisions les plus pertinentes sont listées ;{' '}
                        <button className="finPertinence__tri" onClick={() => changerTri('date_desc')}>triez par date</button>{' '}
                        pour parcourir les {aParcourir} décisions.
                    </p>
                )}
                </>)}

                {/* RÉSULTATS "CODES & ARTICLES" */}
                {activeTab === 'articles' && (
                    <div className="resultsGrid">
                        {/* Base de textes (mêmes bases que le connecteur MCP) et abrogés masquables. */}
                        <div className="articlesControls">
                            <div className="baseSelector" role="radiogroup" aria-label="Base de textes">
                                {BASES_TEXTES.map(b => (
                                    <button
                                        key={b.cle}
                                        role="radio"
                                        aria-checked={base === b.cle}
                                        title={b.titre}
                                        className={`pill ${base === b.cle ? 'active' : ''}`}
                                        onClick={() => setBase(b.cle)}
                                    >
                                        {b.libelle}
                                    </button>
                                ))}
                            </div>
                            <label className="toggleVigueur">
                                <input
                                    type="checkbox"
                                    checked={enVigueur}
                                    onChange={(e) => setEnVigueur(e.target.checked)}
                                />
                                En vigueur uniquement
                            </label>
                        </div>
                        {enVigueur && abrogesMasques > 0 && !articlesLoading && (
                            <p className="abrogesMasques">
                                {abrogesMasques === 1 ? '1 article abrogé masqué.' : `${abrogesMasques} articles abrogés masqués.`}
                            </p>
                        )}
                        {articlesAffiches.map((art) => (
                            <div
                                key={art.id}
                                className="resultCard linear-card"
                                onClick={() => window.open(urlArticle(art.code_slug, art.slug), '_blank')}
                            >
                                <div className="cardHeader">
                                    <span className="cardRef">{articleLabel({ article_number: art.article_number })}</span>
                                    {art.est_abroge && <span className="badge-abroge" title="Cet article a été abrogé">Abrogé</span>}
                                    <span className="cardDate">{art.code_title}</span>
                                </div>
                                <p className="cardSnippet">{stripHtml(art.content).slice(0, 240) || 'Voir l’article complet.'}</p>
                            </div>
                        ))}
                        {!articlesLoading && articlesAffiches.length === 0 && (
                            <div className="emptyState"><p>
                                {enVigueur && abrogesMasques > 0
                                    ? <>Aucun article en vigueur trouvé pour «&nbsp;{query}&nbsp;».</>
                                    : <>Aucun article trouvé pour «&nbsp;{query}&nbsp;».</>}
                            </p></div>
                        )}
                        {articlesLoading && <div className="loadingState"><div className="spinner"></div></div>}
                    </div>
                )}

                {activeTab === 'doctrine' && (
                    <div className="resultsGrid">
                        {doctrineResults.map((d) => (
                            <div
                                key={d.id}
                                className="resultCard linear-card"
                                onClick={() => navigate(d.slug ? `/doctrine-fiscale/${d.slug}` : '/doctrine-fiscale')}
                            >
                                <div className="cardHeader">
                                    <span className="cardRef">{d.reference_complete}</span>
                                    {d.annee && <span className="cardDate">{d.annee}</span>}
                                </div>
                                {d.objet && <p className="cardSnippet">{d.objet}</p>}
                            </div>
                        ))}
                        {!doctrineLoading && doctrineResults.length === 0 && (
                            <div className="emptyState"><p>Aucune doctrine trouvée pour «&nbsp;{query}&nbsp;».</p></div>
                        )}
                        {doctrineLoading && <div className="loadingState"><div className="spinner"></div></div>}
                    </div>
                )}
            </div>
        </div>
    );
};

export default SearchPage;
