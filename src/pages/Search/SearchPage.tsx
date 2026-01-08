import React, { useEffect, useState } from 'react';
import { MeiliSearch } from 'meilisearch';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion';
import './SearchPage.css';

// --- CONFIG MEILISEARCH CLOUD ---
const client = new MeiliSearch({
    host: 'https://ms-9c13e7ae24b5-37398.fra.meilisearch.io',
    apiKey: '8ce0415a927b3362022e014993879f8986a7f941',
});
const index = client.index('decisions');

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

    const performSearch = async (append: boolean) => {
        setLoading(true);
        setError(null);
        try {
            const filterParts: string[] = [];
            const wrap = (val: string) => `"${val.replace(/"/g, '\\"')}"`;

            // 1. Facets
            if (selectedMatiere.length > 0) {
                filterParts.push(`matiere_principale IN [${selectedMatiere.map(wrap).join(', ')}]`);
            }
            if (selectedChambre.length > 0) {
                filterParts.push(`chambre IN [${selectedChambre.map(wrap).join(', ')}]`);
            }

            // 2. Date Logic
            const now = new Date();
            const currentYear = now.getFullYear();

            if (datePreset === '3y') {
                const cutoff = `${currentYear - 3}-01-01`;
                filterParts.push(`date_decision >= ${cutoff}`);
            } else if (datePreset === '5y') {
                const cutoff = `${currentYear - 5}-01-01`;
                filterParts.push(`date_decision >= ${cutoff}`);
            } else if (datePreset === 'custom') {
                if (customYearStart && /^\d{4}$/.test(customYearStart)) {
                    filterParts.push(`date_decision >= ${customYearStart}-01-01`);
                }
                if (customYearEnd && /^\d{4}$/.test(customYearEnd)) {
                    filterParts.push(`date_decision <= ${customYearEnd}-12-31`);
                }
            }

            const filterExpression = filterParts.length > 0 ? filterParts.join(' AND ') : undefined;

            // Sort
            let sortConfig: string[] | undefined;
            if (sortOption === 'date_desc') sortConfig = ['date_decision:desc'];
            else if (sortOption === 'date_asc') sortConfig = ['date_decision:asc'];

            const searchResponse = await index.search(query, {
                limit: 20,
                offset: append ? offset : 0,
                attributesToCrop: ['texte_integral'],
                cropLength: 50,
                filter: filterExpression,
                sort: sortConfig,
                facets: ['matiere_principale', 'chambre']
            });

            if (append) {
                setResults(prev => [...prev, ...searchResponse.hits as unknown as Decision[]]);
            } else {
                setResults(searchResponse.hits as unknown as Decision[]);

                // 📊 Google Analytics 4 - Track search queries
                if (query && query.trim().length > 0 && typeof window !== 'undefined' && (window as any).gtag) {
                    (window as any).gtag('event', 'search', {
                        search_term: query.trim(),
                        results_count: searchResponse.estimatedTotalHits,
                        filters_applied: filterParts.length > 0 ? filterParts.join(', ') : 'none'
                    });
                }
            }

            setTotalHits(searchResponse.estimatedTotalHits);
            if (!append) setFacets(searchResponse.facetDistribution);

        } catch (err: any) {
            console.error("Meilisearch Error:", err);
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
