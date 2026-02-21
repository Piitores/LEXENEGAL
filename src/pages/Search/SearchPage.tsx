import React, { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion';
import './SearchPage.css';

// --- CONFIG SUPABASE FTS ---
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// --- TYPES ---
interface Decision {
    id: string;
    reference: string;
    date_decision: string;
    matiere_principale: string;
    chambre: string;
    resume: string;
    slug: string;
    mots_cles: string[];
}

const SearchPage: React.FC = () => {
    const [searchParams, setSearchParams] = useSearchParams();
    const queryParam = searchParams.get('q') || '';
    const [query, setQuery] = useState(queryParam);

    const [results, setResults] = useState<Decision[]>([]);
    const [totalHits, setTotalHits] = useState(0);
    const [facets, setFacets] = useState<any>({});
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [offset, setOffset] = useState(0);

    const navigate = useNavigate();

    // --- ACCORDION STATE ---
    const [openSections, setOpenSections] = useState<Record<string, boolean>>({
        date: true,
        juridiction: true,
        themes: true
    });

    const toggleSection = (section: string) => {
        setOpenSections(prev => ({ ...prev, [section]: !prev[section] }));
    };

    // --- FILTERS STATE ---
    const [selectedMatiere, setSelectedMatiere] = useState<string[]>([]);
    const [selectedChambre, setSelectedChambre] = useState<string[]>([]);
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
    }, [queryParam]);

    // TRIGGER SEARCH
    useEffect(() => {
        const timer = setTimeout(() => {
            performSearch(false);
        }, 300);
        return () => clearTimeout(timer);
    }, [query, selectedMatiere, selectedChambre, sortOption, datePreset, customYearStart, customYearEnd]);

    // LOAD MORE
    useEffect(() => {
        if (offset > 0) performSearch(true);
    }, [offset]);

    // Load facets once on mount (static counts for all decisions)
    useEffect(() => {
        const loadFacets = async () => {
            try {
                // Get distinct matières with counts
                const { data: allDecisions } = await supabase
                    .from('decisions')
                    .select('matiere_principale, chambre');

                if (allDecisions) {
                    const matiereCount: Record<string, number> = {};
                    const chambreCount: Record<string, number> = {};

                    allDecisions.forEach((d: any) => {
                        if (d.matiere_principale) {
                            matiereCount[d.matiere_principale] = (matiereCount[d.matiere_principale] || 0) + 1;
                        }
                        if (d.chambre) {
                            chambreCount[d.chambre] = (chambreCount[d.chambre] || 0) + 1;
                        }
                    });

                    setFacets({
                        matiere_principale: matiereCount,
                        chambre: chambreCount
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

            // Date filters
            const currentYear = new Date().getFullYear();
            let dateFrom: string | null = null;
            let dateTo: string | null = null;

            if (datePreset === '3y') {
                dateFrom = `${currentYear - 3}-01-01`;
            } else if (datePreset === '5y') {
                dateFrom = `${currentYear - 5}-01-01`;
            } else if (datePreset === 'custom') {
                if (customYearStart && /^\d{4}$/.test(customYearStart)) {
                    dateFrom = `${customYearStart}-01-01`;
                }
                if (customYearEnd && /^\d{4}$/.test(customYearEnd)) {
                    dateTo = `${customYearEnd}-12-31`;
                }
            }

            let decisions: Decision[] = [];
            let totalCount = 0;

            if (searchTerm.length > 0) {
                // Use FTS RPC for text search
                const { data, error: rpcError } = await supabase.rpc('search_decisions_fts', {
                    search_query: searchTerm,
                    matiere_filter: matiereFilter,
                    chambre_filter: chambreFilter,
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
                        filters_applied: (selectedMatiere.length + selectedChambre.length) > 0 ? 'yes' : 'none'
                    });
                }
            }

            setTotalHits(totalCount);

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

    const toggleFilter = (type: 'matiere' | 'chambre', value: string) => {
        const setter = type === 'matiere' ? setSelectedMatiere : setSelectedChambre;
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

    const handleCustomDateFocus = () => {
        setDatePreset('custom');
    };

    const clearFilters = () => {
        setSelectedMatiere([]);
        setSelectedChambre([]);
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
                    {(selectedMatiere.length > 0 || selectedChambre.length > 0 || datePreset) && (
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
                                <input type="text" placeholder="2020" value={customYearStart} onChange={(e) => setCustomYearStart(e.target.value)} onFocus={handleCustomDateFocus} maxLength={4} />
                                <span className="rangeSep">-</span>
                                <input type="text" placeholder="2024" value={customYearEnd} onChange={(e) => setCustomYearEnd(e.target.value)} onFocus={handleCustomDateFocus} maxLength={4} />
                            </div>
                        </div>
                    </div>
                </FilterAccordion>

                {/* JURIDICTION */}
                <FilterAccordion id="juridiction" title="Juridiction" isOpen={openSections.juridiction} toggle={() => toggleSection('juridiction')}>
                    <ul className="filterList">
                        {facets?.chambre && Object.entries(facets.chambre)
                            .sort((a: any, b: any) => b[1] - a[1]) // Sort by count descending
                            .map(([chambre, count]: [string, any]) => (
                                <li key={chambre} className="filterItem" onClick={() => toggleFilter('chambre', chambre)}>
                                    <div className="checkbox-wrapper">
                                        <div className={`custom-checkbox ${selectedChambre.includes(chambre) ? 'checked' : ''}`}>
                                            {selectedChambre.includes(chambre) && <span className="checkmark">✔</span>}
                                        </div>
                                        <span className="filterLabel">{chambre.replace(/_/g, ' ')}</span>
                                    </div>
                                    <span className="filterCount">({count})</span>
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

                <div className="resultsToolbar">
                    <div className="resultsCount">
                        <span className="count-number">{totalHits}</span> résultats
                    </div>
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
                </div>

                {error && <div className="errorBanner"><strong>Erreur technique :</strong> {error}</div>}

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
                                    <h2 className="cardTitle">{hit.matiere_principale} {hit.chambre ? `— ${hit.chambre}` : ''}</h2>
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
                        <button onClick={clearFilters}>Réinitialiser les filtres</button>
                    </div>
                )}

                {loading && <div className="loadingState"><div className="spinner"></div></div>}

                {!loading && results.length < totalHits && (
                    <div className="loadMoreContainer">
                        <button onClick={() => setOffset(p => p + 20)} className="loadMoreBtn">Voir plus</button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default SearchPage;
