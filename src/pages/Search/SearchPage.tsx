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
    resume: string; // generated preview
    slug: string;
    mots_cles: string[];
}

const SearchPage: React.FC = () => {
    const [searchParams, setSearchParams] = useSearchParams();
    const query = searchParams.get('q') || '';

    const [results, setResults] = useState<Decision[]>([]);
    const [totalHits, setTotalHits] = useState(0);
    const [facets, setFacets] = useState<any>({}); // For storing dynamic facets
    const [loading, setLoading] = useState(false);

    const navigate = useNavigate();

    // Filters State
    const [selectedMatiere, setSelectedMatiere] = useState<string[]>([]);
    const [dateSort, setDateSort] = useState<'desc' | 'asc'>('desc');

    useEffect(() => {
        performSearch();
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
                facets: ['matiere_principale', 'chambre']
            });

            console.log("Search results:", searchResponse); // Debug

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
        setSearchParams({ q: e.target.value });
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
                    {facets?.matiere_principale && Object.keys(facets.matiere_principale).map(matiere => (
                        <label key={matiere}>
                            <input
                                type="checkbox"
                                checked={selectedMatiere.includes(matiere)}
                                onChange={() => toggleMatiere(matiere)}
                            />
                            {matiere} <span style={{ color: '#9CA3AF', fontSize: '0.8em' }}>({facets.matiere_principale[matiere]})</span>
                        </label>
                    ))}
                </div>

                <div className="filterGroup" style={{ marginTop: '2rem' }}>
                    <h3>Année</h3>
                    <select
                        value={dateSort}
                        onChange={(e) => setDateSort(e.target.value as 'asc' | 'desc')}
                        style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #E5E7EB' }}
                    >
                        <option value="desc">Plus récent d'abord</option>
                        <option value="asc">Plus ancien d'abord</option>
                    </select>
                </div>
            </aside>

            {/* RESULTS */}
            <div className="resultsArea">
                <div className="searchHeader">
                    <input
                        type="text"
                        className="searchInput"
                        placeholder="Rechercher un arrêt, un mot-clé, une référence..."
                        value={query}
                        onChange={handleSearchInput}
                        autoFocus
                    />
                    <div className="resultsCount">
                        {loading ? 'Recherche en cours...' : `${totalHits} résultats trouvés`}
                    </div>
                </div>

                <div className="resultsGrid">
                    {results.map(hit => (
                        <div key={hit.id} className="resultCard" onClick={() => navigate(`/decision/${hit.slug}`)}>
                            <div className="cardHeader">
                                <span className="cardRef">{hit.reference}</span>
                                <span className="cardDate">{hit.date_decision ? new Date(hit.date_decision).toLocaleDateString('fr-FR', { year: 'numeric', month: 'long', day: 'numeric' }) : 'Date inconnue'}</span>
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
                        <div style={{ textAlign: 'center', marginTop: '4rem', color: '#6B7280' }}>
                            <p>Aucun résultat trouvé pour "{query}".</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default SearchPage;
