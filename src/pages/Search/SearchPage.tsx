import React, { useEffect, useRef, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion';
import './SearchPage.css';
import { detectArticleRef, detectDecisionRef } from '../../lib/searchRefDetect';
import { buildCodeIndex, normalizeToken, normalizeArticleNumber } from '../../lib/articleRefResolver';


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
}

type BestMatch =
    | { kind: 'article'; article_number: string; slug: string; code_slug: string; code_title: string }
    | { kind: 'decision'; reference: string; slug: string; date_decision: string; chambre: string; juridiction: string };

const SearchPage: React.FC = () => {
    const [searchParams, setSearchParams] = useSearchParams();
    const queryParam = searchParams.get('q') || '';
    const [query, setQuery] = useState(queryParam);

    const [results, setResults] = useState<Decision[]>([]);
    const [totalHits, setTotalHits] = useState(0);

    // Onglet actif + résultats "Codes & articles"
    const [activeTab, setActiveTab] = useState<'decisions' | 'articles'>('decisions');
    const [articleResults, setArticleResults] = useState<ArticleHit[]>([]);
    const [articlesLoading, setArticlesLoading] = useState(false);
    // L'utilisateur a-t-il choisi un onglet manuellement ? (sinon on choisit pour lui selon la requête)
    const userPickedTab = useRef(false);
    const [suggestions, setSuggestions] = useState<Decision[]>([]);
    const [facets, setFacets] = useState<any>({});
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [offset, setOffset] = useState(0);

    // Détection de références structurées → carte « meilleur résultat »
    const [codeIndex, setCodeIndex] = useState<Map<string, string>>(new Map());
    const [bestMatch, setBestMatch] = useState<BestMatch | null>(null);

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

    // --- FILTERS STATE ---
    const [selectedMatiere, setSelectedMatiere] = useState<string[]>([]);
    const [selectedChambre, setSelectedChambre] = useState<string[]>([]);
    const [selectedJuridiction, setSelectedJuridiction] = useState<string[]>([]);
    const [sortOption, setSortOption] = useState<'relevance' | 'date_desc' | 'date_asc'>('relevance');

    // DATE FILTERS
    const [datePreset, setDatePreset] = useState<'3y' | '5y' | 'custom' | null>(null);
    const [customYearStart, setCustomYearStart] = useState<string>('');
    const [customYearEnd, setCustomYearEnd] = useState<string>('');

    // --- CONTEXTUAL PILLS (MATIERE SHORTCUTS) ---
    const CONTEXTUAL_PILLS = [
        { label: 'Tous', value: null },
        { label: 'Civile', value: 'Civile' },
        { label: 'Sociale', value: 'Sociale' },
        { label: 'Criminelle', value: 'Criminelle' },
        { label: 'Commerciale', value: 'Commerciale' },
        { label: 'Administrative', value: 'Administrative' }
    ];

    // Handle Pill Click (Exclusive or Additive? Let's make it additive for flexibility but smart)
    const handlePillClick = (value: string | null) => {
        if (value === null) {
            setSelectedMatiere([]);
        } else {
            // Toggle logic for pills
            setSelectedMatiere(prev => prev.includes(value) ? prev.filter(m => m !== value) : [...prev, value]);
        }
        setOffset(0);
    };


    // Sync URL param
    useEffect(() => {
        setQuery(queryParam);
        setOffset(0);
        userPickedTab.current = false; // nouvelle requête → on laissera l'onglet se choisir automatiquement
    }, [queryParam]);

    // RECHERCHE "CODES & ARTICLES" (en parallèle des décisions)
    useEffect(() => {
        const term = query?.trim() || '';
        if (term.length < 2) {
            setArticleResults([]);
            return;
        }
        let cancelled = false;
        setArticlesLoading(true);
        const timer = setTimeout(async () => {
            try {
                const { data, error: artErr } = await supabase.rpc('search_articles', {
                    search_query: term,
                    result_limit: 50
                });
                if (cancelled) return;
                if (artErr) throw artErr;
                const arr: ArticleHit[] = (data || []).map((a: any) => ({
                    id: a.id,
                    article_number: a.article_number,
                    slug: a.slug,
                    code_slug: a.code_slug || 'code-travail',
                    code_title: a.code_title || 'Code',
                    content: a.content || ''
                }));
                setArticleResults(arr);
            } catch (e) {
                if (!cancelled) setArticleResults([]);
                console.warn('search_articles error:', e);
            } finally {
                if (!cancelled) setArticlesLoading(false);
            }
        }, 300);
        return () => { cancelled = true; clearTimeout(timer); };
    }, [query]);

    // Choix automatique de l'onglet : si l'utilisateur cherche "article 10" (ou que la
    // jurisprudence ne donne rien mais les articles oui), on ouvre l'onglet "Codes & articles".
    useEffect(() => {
        if (userPickedTab.current) return;
        const looksLikeArticle = /\b(art\.?|article)\s*\.?\s*[0-9lr]/i.test(query || '');
        if ((looksLikeArticle && articleResults.length > 0) ||
            (results.length === 0 && articleResults.length > 0 && !loading)) {
            setActiveTab('articles');
        } else if (results.length > 0) {
            setActiveTab('decisions');
        }
    }, [results, articleResults, query, loading]);

    // Index des codes (titres + alias DB `code_aliases` = source) pour la détection structurée.
    useEffect(() => {
        (async () => {
            const { data: laws } = await supabase.from('laws_and_codes').select('slug, title, short_title').eq('is_active', true);
            const idx = buildCodeIndex(laws || []);
            const { data: aliases } = await supabase.from('code_aliases').select('code_slug, alias');
            (aliases || []).forEach((a: any) => idx.set(normalizeToken(a.alias), a.code_slug));
            setCodeIndex(idx);
        })();
    }, []);

    // « Meilleur résultat » : référence structurée (article ou décision) → cible directe,
    // en TÊTE et SANS occulter la liste FTS (condition proprio).
    useEffect(() => {
        const q = (query || '').trim();
        setBestMatch(null);
        if (q.length < 3) return;
        let active = true;
        (async () => {
            // 1) Article : « article 24 AUDCG »
            if (codeIndex.size) {
                const art = detectArticleRef(q, codeIndex);
                if (art) {
                    const { data } = await supabase
                        .from('articles')
                        .select('article_number, slug, laws_and_codes!inner(slug, short_title)')
                        .eq('laws_and_codes.slug', art.codeSlug)
                        .limit(300);
                    const hit = (data || []).find(
                        (a: any) => normalizeArticleNumber(a.article_number) === normalizeArticleNumber(art.articleNumber),
                    );
                    if (hit && active) {
                        setBestMatch({
                            kind: 'article',
                            article_number: hit.article_number,
                            slug: hit.slug,
                            code_slug: (hit as any).laws_and_codes?.slug || art.codeSlug,
                            code_title: (hit as any).laws_and_codes?.short_title || art.codeSlug,
                        });
                        return;
                    }
                }
            }
            // 2) Décision : « arrêt 34 du 14 janvier 2005 »
            const dec = detectDecisionRef(q);
            if (dec && (dec.dateISO || dec.number)) {
                let qb: any = supabase.from('decisions').select('reference, slug, date_decision, chambre, juridiction').limit(1);
                if (dec.dateISO) qb = qb.eq('date_decision', dec.dateISO);
                if (dec.number) qb = qb.ilike('reference', `%${dec.number}%`);
                const { data } = await qb;
                if (data && data[0] && active) setBestMatch({ kind: 'decision', ...(data[0] as any) });
            }
        })();
        return () => { active = false; };
    }, [query, codeIndex]);

    const selectTab = (tab: 'decisions' | 'articles') => {
        userPickedTab.current = true;
        setActiveTab(tab);
    };

    // TRIGGER SEARCH
    useEffect(() => {
        const timer = setTimeout(() => {
            performSearch(false);
        }, 300);
        return () => clearTimeout(timer);
    }, [query, selectedMatiere, selectedChambre, selectedJuridiction, sortOption, datePreset, customYearStart, customYearEnd]);

    // LOAD MORE
    useEffect(() => {
        if (offset > 0) performSearch(true);
    }, [offset]);

    // Load facets once on mount (static counts for all decisions)
    useEffect(() => {
        const loadFacets = async () => {
            try {
                // Facettes agrégées côté serveur (TOUTES les décisions, pas un échantillon plafonné à 1000)
                const { data: facetData, error: facetErr } = await supabase.rpc('get_decision_facets');

                if (facetData && !facetErr) {
                    const matiereCount: Record<string, number> = {};
                    (facetData.matieres || []).forEach((m: any) => {
                        if (m.matiere_principale) matiereCount[m.matiere_principale] = m.n;
                    });
                    
                    const getParentCategory = (j: string) => {
                        if (!j) return 'Autres';
                        const lower = j.toLowerCase();
                        if (lower.includes('ccja') || lower.includes('commune de justice')) return 'CCJA';
                        if (lower.includes('conseil constitutionnel')) return 'Conseil Constitutionnel';
                        if (lower.includes("cour d'appel") || lower.includes('cour d appel') || lower.includes('cour d’appel')) return "Cour d'Appel";
                        if (lower.includes('tribunal') || lower.includes('tribunaux') || lower.includes('high court')) return 'Tribunaux';
                        // Cour suprême : intègre l'ex-Cour de cassation et l'ex-Conseil d'État (réforme de 2008)
                        if (lower.includes('cour de cassation') || lower.includes('cour suprême') || lower.includes('cour supreme')
                            || lower.includes("conseil d'état") || lower.includes('conseil d etat') || lower.includes('conseil d’état') || lower.includes('conseil d’etat')
                            || lower === 'la cour') return 'Cour Suprême';
                        return 'Autres';
                    };

                    const juridictionTree: Record<string, { total: number, subJuridictions: Record<string, number>, chambres: Record<string, number> }> = {};

                    (facetData.juridictions || []).forEach((row: any) => {
                        const n = row.n || 0;
                        const jStr = row.juridiction || 'Non spécifié';
                        const parent = getParentCategory(jStr);

                        if (!juridictionTree[parent]) {
                            juridictionTree[parent] = { total: 0, subJuridictions: {}, chambres: {} };
                        }
                        juridictionTree[parent].total += n;

                        // Si la juridiction exacte n'est pas le parent exact, on l'ajoute aux sous-juridictions
                        if (jStr && jStr !== parent) {
                            juridictionTree[parent].subJuridictions[jStr] = (juridictionTree[parent].subJuridictions[jStr] || 0) + n;
                        }

                        if (row.chambre) {
                            juridictionTree[parent].chambres[row.chambre] = (juridictionTree[parent].chambres[row.chambre] || 0) + n;
                        }
                    });

                    setFacets({
                        matiere_principale: matiereCount,
                        juridictionTree
                    });
                }
            } catch (e) {
                console.warn('Error loading facets:', e);
            }
        };
        loadFacets();
    }, []);

    const performSearch = async (append: boolean) => {
        setLoading(true);
        setError(null);
        try {
            const searchTerm = query?.trim() || '';
            const currentOffset = append ? offset : 0;
            const pageSize = 20;

            // Prepare filter arrays (null if empty)
            const matiereFilter = selectedMatiere.length > 0 ? selectedMatiere : null;
            const chambreFilter = selectedChambre.length > 0 ? selectedChambre : null;
            
            let finalJuridictionFilter: string[] | null = null;
            if (selectedJuridiction.length > 0) {
                const expandedJuri = new Set<string>();
                selectedJuridiction.forEach(j => {
                    expandedJuri.add(j);
                    // Si 'j' est une catégorie parente, on inclut toutes ses sous-juridictions
                    if (facets?.juridictionTree && facets.juridictionTree[j]) {
                        Object.keys(facets.juridictionTree[j].subJuridictions).forEach(subJ => expandedJuri.add(subJ));
                    }
                });
                finalJuridictionFilter = Array.from(expandedJuri);
            }

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

            let decisions: Decision[] = [];
            let totalCount = 0;

            if (searchTerm.length > 0) {
                // Use FTS RPC for text search
                const { data, error: rpcError } = await supabase.rpc('search_decisions_fts', {
                    search_query: searchTerm,
                    matiere_filter: matiereFilter,
                    chambre_filter: chambreFilter,
                    juridiction_filter: finalJuridictionFilter,
                    date_from: dateFrom,
                    date_to: dateTo,
                    sort_by: sortOption === 'relevance' ? 'relevance' : sortOption === 'date_asc' ? 'date_asc' : 'date_desc',
                    result_limit: pageSize,
                    result_offset: currentOffset
                });

                if (rpcError) throw rpcError;

                decisions = (data || []).map((d: any) => ({
                    id: d.id,
                    reference: d.reference || 'Décision',
                    date_decision: d.date_decision,
                    matiere_principale: d.matiere_principale,
                    juridiction: d.juridiction,
                    chambre: d.chambre,
                    resume: d.resume,
                    slug: d.slug || d.id,
                    mots_cles: d.mots_cles || []
                }));

                // Get total count (FTS doesn't return count, so estimate)
                totalCount = data?.length === pageSize ? currentOffset + pageSize + 1 : currentOffset + (data?.length || 0);

            } else {
                // No search term - use direct query for browsing
                let queryBuilder = supabase
                    .from('decisions')
                    .select('id, reference, slug, date_decision, matiere_principale, chambre, resume, mots_cles, juridiction', { count: 'exact' });

                if (matiereFilter) queryBuilder = queryBuilder.in('matiere_principale', matiereFilter);
                if (chambreFilter) queryBuilder = queryBuilder.in('chambre', chambreFilter);
                if (finalJuridictionFilter) queryBuilder = queryBuilder.in('juridiction', finalJuridictionFilter);
                if (dateFrom) queryBuilder = queryBuilder.gte('date_decision', dateFrom);
                if (dateTo) queryBuilder = queryBuilder.lte('date_decision', dateTo);

                queryBuilder = queryBuilder.order('date_decision', { ascending: sortOption === 'date_asc', nullsFirst: false });
                queryBuilder = queryBuilder.range(currentOffset, currentOffset + pageSize - 1);

                const { data, error: queryError, count } = await queryBuilder;
                if (queryError) throw queryError;

                decisions = (data || []).map((d: any) => ({
                    id: d.id,
                    reference: d.reference || 'Décision',
                    date_decision: d.date_decision,
                    matiere_principale: d.matiere_principale,
                    juridiction: d.juridiction,
                    chambre: d.chambre,
                    resume: d.resume,
                    slug: d.slug || d.id,
                    mots_cles: d.mots_cles || []
                }));

                totalCount = count || 0;
            }

            if (append) {
                setResults(prev => [...prev, ...decisions]);
            } else {
                setResults(decisions);

                // 📊 Google Analytics 4 - Track search queries
                if (searchTerm.length > 0 && typeof window !== 'undefined' && (window as any).gtag) {
                    (window as any).gtag('event', 'search', {
                        search_term: searchTerm,
                        results_count: totalCount,
                        filters_applied: (selectedMatiere.length + selectedChambre.length + selectedJuridiction.length) > 0 ? 'yes' : 'none'
                    });
                }
            }

            setTotalHits(totalCount);

            // 3.B — "Vouliez-vous dire" : si la recherche texte ne renvoie rien, proposer des décisions proches
            if (!append && searchTerm.length > 0 && decisions.length === 0) {
                const { data: sugg } = await supabase.rpc('search_decisions_suggest', {
                    search_query: searchTerm,
                    result_limit: 8
                });
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
            } else if (!append) {
                setSuggestions([]);
            }

        } catch (err: any) {
            console.error("Search Error:", err);
            setError(err.message);
        } finally {
            setLoading(false);
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

    const handleDatePreset = (preset: '3y' | '5y' | null) => {
        if (datePreset === preset) setDatePreset(null);
        else {
            setDatePreset(preset);
            setCustomYearStart('');
            setCustomYearEnd('');
        }
    };

    const handleCustomYear = (which: 'start' | 'end', raw: string) => {
        const v = raw.replace(/\D/g, '').slice(0, 4);
        if (which === 'start') setCustomYearStart(v); else setCustomYearEnd(v);
        if (v) setDatePreset('custom');
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

    return (
        <div className="searchPage linear-theme">
            <aside className="searchSidebar ghost-sidebar">
                <div className="sidebarTop">
                    <h2 className="sidebarTitle">Filtres</h2>
                    {(selectedMatiere.length > 0 || selectedChambre.length > 0 || selectedJuridiction.length > 0 || datePreset) && (
                        <motion.button
                            onClick={clearFilters}
                            className="clearFiltersBtn"
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                        >
                            Effacer tout
                        </motion.button>
                    )}
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
                        {facets?.juridictionTree && Object.entries(facets.juridictionTree)
                            .sort((a: any, b: any) => b[1].total - a[1].total) // Sort by count descending
                            .map(([juridiction, data]: [string, any]) => (
                                <li key={juridiction} className="filterGroup">
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                                        <div className="filterItem juridictionItem" onClick={() => toggleFilter('juridiction', juridiction)} style={{ flex: 1, paddingRight: '8px' }}>
                                            <div className="checkbox-wrapper">
                                                <div className={`custom-checkbox ${selectedJuridiction.includes(juridiction) ? 'checked' : ''}`}>
                                                    {selectedJuridiction.includes(juridiction) && <span className="checkmark">✔</span>}
                                                </div>
                                                <span className="filterLabel" style={{ fontWeight: 600 }}>{juridiction.replace(/_/g, ' ')}</span>
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
                                                                        {subJ.replace(/_/g, ' ')}
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
                                                        {Object.entries(data.chambres)
                                                            .sort((a: any, b: any) => b[1] - a[1])
                                                            .map(([chambre, count]: [string, any]) => (
                                                                <li key={chambre} className="filterItem" onClick={() => toggleFilter('chambre', chambre)} style={{ padding: '0.2rem 0' }}>
                                                                    <div className="checkbox-wrapper">
                                                                        <div className={`custom-checkbox ${selectedChambre.includes(chambre) ? 'checked' : ''}`} style={{ width: '16px', height: '16px' }}>
                                                                            {selectedChambre.includes(chambre) && <span className="checkmark" style={{ fontSize: '10px' }}>✔</span>}
                                                                        </div>
                                                                        <span className="filterLabel" style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                                                                            {chambre.replace(/_/g, ' ')}
                                                                        </span>
                                                                    </div>
                                                                    <span className="filterCount" style={{ fontSize: '0.8rem' }}>({count})</span>
                                                                </li>
                                                            ))}
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
                        {facets?.matiere_principale && Object.keys(facets.matiere_principale).map(matiere => (
                            <li key={matiere} className="filterItem" onClick={() => toggleFilter('matiere', matiere)}>
                                <div className="checkbox-wrapper">
                                    <div className={`custom-checkbox ${selectedMatiere.includes(matiere) ? 'checked' : ''}`}>
                                        {selectedMatiere.includes(matiere) && <span className="checkmark">✔</span>}
                                    </div>
                                    <span className="filterLabel">{matiere}</span>
                                </div>
                                <span className="filterCount">({facets.matiere_principale[matiere]})</span>
                            </li>
                        ))}
                    </ul>
                </FilterAccordion>
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
                        autoFocus
                    />

                    {/* CONTEXTUAL PILLS */}
                    <div className="contextual-pills">
                        {CONTEXTUAL_PILLS.map(pill => (
                            <motion.button
                                key={pill.label}
                                className={`pill ${(pill.value === null && selectedMatiere.length === 0) || (pill.value && selectedMatiere.includes(pill.value))
                                    ? 'active'
                                    : ''
                                    }`}
                                onClick={() => handlePillClick(pill.value)}
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                            >
                                {pill.label}
                            </motion.button>
                        ))}
                    </div>
                </div>

                {/* MEILLEUR RÉSULTAT (référence structurée) — en tête, n'occulte pas la liste */}
                {bestMatch && (
                    <div
                        className="best-match"
                        onClick={() =>
                            navigate(
                                bestMatch.kind === 'article'
                                    ? `/code/${bestMatch.code_slug}/${bestMatch.slug}`
                                    : `/decision/${bestMatch.slug}`,
                            )
                        }
                    >
                        <span className="best-match__badge">★ Meilleur résultat</span>
                        {bestMatch.kind === 'article' ? (
                            <div className="best-match__body">
                                <strong>Article {bestMatch.article_number}</strong>
                                <span className="best-match__meta">{bestMatch.code_title}</span>
                            </div>
                        ) : (
                            <div className="best-match__body">
                                <strong>{bestMatch.reference}</strong>
                                <span className="best-match__meta">
                                    {[bestMatch.juridiction, bestMatch.chambre, bestMatch.date_decision && new Date(bestMatch.date_decision).toLocaleDateString('fr-FR')]
                                        .filter(Boolean)
                                        .join(' · ')}
                                </span>
                            </div>
                        )}
                    </div>
                )}

                {/* ONGLETS : Jurisprudence / Codes & articles */}
                <div className="searchTabs" role="tablist">
                    <button
                        role="tab"
                        aria-selected={activeTab === 'decisions'}
                        className={`searchTab ${activeTab === 'decisions' ? 'active' : ''}`}
                        onClick={() => selectTab('decisions')}
                    >
                        Jurisprudence <span className="searchTabCount">{totalHits}</span>
                    </button>
                    <button
                        role="tab"
                        aria-selected={activeTab === 'articles'}
                        className={`searchTab ${activeTab === 'articles' ? 'active' : ''}`}
                        onClick={() => selectTab('articles')}
                    >
                        Codes &amp; articles <span className="searchTabCount">{articleResults.length}</span>
                    </button>
                </div>

                <div className="resultsToolbar">
                    <div className="resultsCount">
                        <span className="count-number">{activeTab === 'decisions' ? totalHits : articleResults.length}</span> résultats
                    </div>
                    {activeTab === 'decisions' && (
                        <div className="sortControls">
                            <select
                                className="sortSelect"
                                value={sortOption}
                                onChange={(e) => setSortOption(e.target.value as any)}
                            >
                                <option value="relevance">Pertinence</option>
                                <option value="date_desc">Plus récent</option>
                                <option value="date_asc">Plus ancien</option>
                            </select>
                        </div>
                    )}
                </div>

                {error && <div className="errorBanner"><strong>Erreur technique :</strong> {error}</div>}

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
                                    <h2 className="cardTitle">{[hit.matiere_principale || hit.juridiction, hit.chambre].filter(Boolean).join(' — ') || 'Décision'}</h2>
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

                {!loading && results.length < totalHits && (
                    <div className="loadMoreContainer">
                        <button onClick={() => setOffset(p => p + 20)} className="loadMoreBtn">Voir plus</button>
                    </div>
                )}
                </>)}

                {/* RÉSULTATS "CODES & ARTICLES" */}
                {activeTab === 'articles' && (
                    <div className="resultsGrid">
                        {articleResults.map((art) => (
                            <div
                                key={art.id}
                                className="resultCard linear-card"
                                onClick={() => window.open(`/code/${art.code_slug}/${art.slug}`, '_blank')}
                            >
                                <div className="cardHeader">
                                    <span className="cardRef">Article {art.article_number}</span>
                                    <span className="cardDate">{art.code_title}</span>
                                </div>
                                <p className="cardSnippet">{stripHtml(art.content).slice(0, 240) || 'Voir l’article complet.'}</p>
                            </div>
                        ))}
                        {!articlesLoading && articleResults.length === 0 && (
                            <div className="emptyState"><p>Aucun article trouvé pour «&nbsp;{query}&nbsp;».</p></div>
                        )}
                        {articlesLoading && <div className="loadingState"><div className="spinner"></div></div>}
                    </div>
                )}
            </div>
        </div>
    );
};

export default SearchPage;
