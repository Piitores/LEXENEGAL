import React, { useEffect, useState } from 'react';
import { MeiliSearch } from 'meilisearch';
import { useNavigate, useSearchParams } from 'react-router-dom';
import './SearchPage.css';

// --- CONFIG MEILISEARCH CLOUD ---
const client = new MeiliSearch({
    host: 'https://ms-9c13e7ae24b5-37398.fra.meilisearch.io',
    apiKey: 'eabe07740906b7bad2b7dcbe72ab6c010888bc827d3e7ec28b365810a5cad73a',
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
    const [query, setQuery] = useState(queryParam); // Local state for input

    const [results, setResults] = useState<Decision[]>([]);
    const [totalHits, setTotalHits] = useState(0);
    const [facets, setFacets] = useState<any>({});
    const [loading, setLoading] = useState(false);

    const navigate = useNavigate();

    // Filters State
    const [selectedMatiere, setSelectedMatiere] = useState<string[]>([]);
    const [dateSort, setDateSort] = useState<'desc' | 'asc'>('desc');

    // Sync URL param to Local State on mount
    useEffect(() => {
        setQuery(queryParam);
    }, [queryParam]);

    // AS YOU TYPE SEARCH (Debounced effectively by logic or rapid updates, explicit debounce opt)
    useEffect(() => {
        const timer = setTimeout(() => {
            performSearch();
        }, 300); // 300ms debounce
        return () => clearTimeout(timer);
    }, [query, selectedMatiere, dateSort]);

    const performSearch = async () => {
        setLoading(true);
        try {
            const filterExpression = selectedMatiere.length > 0
                ? `matiere_principale IN [${selectedMatiere.map(m => `"${m}"`).join(', ')}]`
                : undefined;

            const searchResponse = await index.search(query, {
                limit: 20,
                attributesToSnippet: ['texte_integral:50'],
                filter: filterExpression,
                sort: [`date_decision:${dateSort}`],
                facets: ['matiere_principale', 'date_decision'] // Ensure facets returned
            });

            setResults(searchResponse.hits as unknown as Decision[]);
            setTotalHits(searchResponse.estimatedTotalHits);
            setFacets(searchResponse.facetDistribution);

        } catch (error) {
            console.error("Meilisearch Error:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleSearchInput = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newVal = e.target.value;
        setQuery(newVal);
        // We update URL seamlessly? Or just keep local? 
        // Better to keep local for typing speed, but maybe sync on debounce?
        // For now, simple local state + debounce is best for UX.
    };

    const toggleMatiere = (matiere: string) => {
        setSelectedMatiere(prev =>
            prev.includes(matiere)
                ? prev.filter(m => m !== matiere)
                : [...prev, matiere]
        );
    };

    return (
        <div className="searchPage">
            {/* SIDEBAR */}
            <aside className="searchSidebar">
                <div className="filterGroup">
                    <h3>Matière</h3>
                    <ul className="filterList">
                        {facets?.matiere_principale && Object.keys(facets.matiere_principale).map(matiere => (
                            <li key={matiere} className="filterItem" onClick={() => toggleMatiere(matiere)}>
                                <div style={{ display: 'flex', alignItems: 'center' }}>
                                    <input
                                        type="checkbox"
                                        checked={selectedMatiere.includes(matiere)}
                                        readOnly
                                    />
                                    <span>{matiere}</span>
                                </div>
                                <span className="filterCount">{facets.matiere_principale[matiere]}</span>
                            </li>
                        ))}
                    </ul>
                </div>

                <div className="filterGroup">
                    <h3>Année / Tri</h3>
                    <ul className="filterList">
                        <li className="filterItem" onClick={() => setDateSort('desc')}>
                            <div style={{ display: 'flex', alignItems: 'center' }}>
                                <span style={{ width: '16px', marginRight: '0.75rem', textAlign: 'center', color: dateSort === 'desc' ? '#047857' : '#D1D5DB' }}>●</span>
                                <span>Plus récent d'abord</span>
                            </div>
                        </li>
                        <li className="filterItem" onClick={() => setDateSort('asc')}>
                            <div style={{ display: 'flex', alignItems: 'center' }}>
                                <span style={{ width: '16px', marginRight: '0.75rem', textAlign: 'center', color: dateSort === 'asc' ? '#047857' : '#D1D5DB' }}>●</span>
                                <span>Plus ancien d'abord</span>
                            </div>
                        </li>
                    </ul>
                </div>
            </aside>

            {/* RESULTS */}
            <div className="resultsArea">
                <div className="searchHeader">
                    <input
                        type="text"
                        className="searchInput"
                        placeholder="Rechercher..."
                        value={query}
                        onChange={handleSearchInput}
                        autoFocus
                    />
                    <div className="resultsCount">
                        {loading ? '...' : `${totalHits} décisions trouvées`}
                    </div>
                </div>

                <div className="resultsGrid">
                    {results.map(hit => (
                        <div key={hit.id} className="resultCard" onClick={() => navigate(`/decision/${hit.slug}`)}>
                            <div className="cardHeader">
                                <span className="cardRef">{hit.reference}</span>
                                <span className="cardDate">{hit.date_decision ? new Date(hit.date_decision).toLocaleDateString('fr-FR', { year: 'numeric' }) : 'N/A'}</span>
                            </div>
                            <h2 className="cardTitle">{hit.matiere_principale} - {hit.chambre}</h2>
                            <p className="cardSnippet" dangerouslySetInnerHTML={{ __html: (hit as any)._formatted?.texte_integral || hit.resume }} />

                            <div className="cardTags">
                                {hit.mots_cles && hit.mots_cles.slice(0, 3).map(tag => (
                                    <span key={tag} className="tag">{tag}</span>
                                ))}
                            </div>
                        </div>
                    ))}

                    {!loading && results.length === 0 && (
                        <div style={{ textAlign: 'center', marginTop: '4rem', color: '#9CA3AF' }}>
                            <p>Aucun résultat.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default SearchPage;
