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
    const [query, setQuery] = useState(queryParam);

    const [results, setResults] = useState<Decision[]>([]);
    const [totalHits, setTotalHits] = useState(0);
    const [facets, setFacets] = useState<any>({});
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [offset, setOffset] = useState(0);

    const navigate = useNavigate();

    // Filters State
    const [selectedMatiere, setSelectedMatiere] = useState<string[]>([]);
    const [dateSort, setDateSort] = useState<'desc' | 'asc'>('desc');

    // Sync URL param to Local State
    useEffect(() => {
        setQuery(queryParam);
        setOffset(0); // Reset pagination on new URL query
    }, [queryParam]);

    // Triggers search when params change
    useEffect(() => {
        const timer = setTimeout(() => {
            performSearch(false); // false = reset list (fresh search)
        }, 300);
        return () => clearTimeout(timer);
    }, [query, selectedMatiere, dateSort]); // Removed offset from here to avoid double-fetch loops, handled by loadMore

    // Trigger explicit load more
    useEffect(() => {
        if (offset > 0) {
            performSearch(true); // true = append
        }
    }, [offset]);

    const performSearch = async (append: boolean) => {
        setLoading(true);
        setError(null);
        try {
            // ROBUST FILTER: Escape double quotes in values to prevent syntax crashes
            const safeMatieres = selectedMatiere.map(m => `"${m.replace(/"/g, '\\"')}"`);
            const filterExpression = safeMatieres.length > 0
                ? `matiere_principale IN [${safeMatieres.join(', ')}]`
                : undefined;

            console.log("🔍 Searching:", { query, filter: filterExpression, offset, sort: dateSort });

            const searchResponse = await index.search(query, {
                limit: 20,
                offset: append ? offset : 0,
                attributesToCrop: ['texte_integral'], // Corrected from attributesToSnippet
                cropLength: 50,
                filter: filterExpression,
                sort: [`date_decision:${dateSort}`],
                facets: ['matiere_principale', 'date_decision']
            });

            if (append) {
                setResults(prev => [...prev, ...searchResponse.hits as unknown as Decision[]]);
            } else {
                setResults(searchResponse.hits as unknown as Decision[]);
            }

            setTotalHits(searchResponse.estimatedTotalHits);
            if (!append) {
                // Keep existing facets if appending, or update? Update usually safe.
                setFacets(searchResponse.facetDistribution);
            }

        } catch (err: any) {
            console.error("❌ Meilisearch Error:", err);
            // Display technical error to user for easy debugging via screenshot
            setError(err.message || 'Erreur inconnue lors de la recherche.');
        } finally {
            setLoading(false);
        }
    };

    const handleSearchInput = (e: React.ChangeEvent<HTMLInputElement>) => {
        setQuery(e.target.value);
        setOffset(0); // Reset pagination
    };

    const toggleMatiere = (matiere: string) => {
        setSelectedMatiere(prev =>
            prev.includes(matiere)
                ? prev.filter(m => m !== matiere)
                : [...prev, matiere]
        );
        setOffset(0);
    };

    const handleLoadMore = () => {
        setOffset(prev => prev + 20);
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
                        {totalHits} décisions trouvées
                    </div>
                </div>

                {error && (
                    <div style={{ padding: '1rem', background: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: '8px', color: '#991B1B', marginBottom: '2rem' }}>
                        <strong>Erreur technique :</strong> {error}
                    </div>
                )}

                <div className="resultsGrid">
                    {results.map((hit, idx) => (
                        <div key={`${hit.id}-${idx}`} className="resultCard" onClick={() => navigate(`/decision/${hit.slug}`)}>
                            <div className="cardHeader">
                                <span className="cardRef">{hit.reference || 'Réf. Inconnue'}</span>
                                <span className="cardDate">
                                    {hit.date_decision && !isNaN(Date.parse(hit.date_decision))
                                        ? new Date(hit.date_decision).toLocaleDateString('fr-FR', { year: 'numeric' })
                                        : 'Date N/D'}
                                </span>
                            </div>
                            <h2 className="cardTitle">{hit.matiere_principale} - {hit.chambre}</h2>
                            <p
                                className="cardSnippet"
                                dangerouslySetInnerHTML={{ __html: (hit as any)._formatted?.texte_integral || hit.resume || 'Aucun aperçu disponible.' }}
                            />

                            <div className="cardTags">
                                {hit.mots_cles && hit.mots_cles.slice(0, 3).map(tag => (
                                    <span key={tag} className="tag">{tag}</span>
                                ))}
                            </div>
                        </div>
                    ))}

                    {!loading && !error && results.length === 0 && (
                        <div style={{ textAlign: 'center', marginTop: '4rem', color: '#9CA3AF' }}>
                            <p>Aucun résultat trouvé pour "{query}".</p>
                        </div>
                    )}

                    {loading && (
                        <div style={{ textAlign: 'center', marginTop: '2rem', color: '#047857' }}>Recherche en cours...</div>
                    )}

                    {!loading && results.length < totalHits && (
                        <div style={{ textAlign: 'center', marginTop: '3rem' }}>
                            <button
                                onClick={handleLoadMore}
                                style={{
                                    padding: '0.75rem 2rem',
                                    background: '#fff',
                                    border: '1px solid #E5E7EB',
                                    borderRadius: '6px',
                                    cursor: 'pointer',
                                    color: '#374151',
                                    fontWeight: 500
                                }}
                            >
                                Voir plus de résultats
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default SearchPage;
