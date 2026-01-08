import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Search, Scale, BookOpen, ArrowRight, Loader2 } from 'lucide-react';
import MeiliSearch from 'meilisearch';
import './Hero.css';

const meiliHost = import.meta.env.VITE_MEILISEARCH_HOST || '';
const meiliKey = import.meta.env.VITE_MEILISEARCH_API_KEY || '';
const meiliClient = meiliHost ? new MeiliSearch({ host: meiliHost, apiKey: meiliKey }) : null;

interface SearchResult {
  type: 'decision' | 'article';
  id: string;
  title: string;
  subtitle: string;
  slug: string;
  codeSlug?: string;
}

function Hero() {
  const [query, setQuery] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  const suggestions = ['Abus de confiance', 'Licenciement', 'L.52'];

  // Handle search with debounce
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (query.length < 2) {
      setResults([]);
      return;
    }

    debounceRef.current = setTimeout(() => {
      performSearch(query);
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  const performSearch = async (searchQuery: string) => {
    setLoading(true);
    const mixedResults: SearchResult[] = [];

    try {
      // 1. Search Decisions (MeiliSearch)
      if (meiliClient) {
        try {
          const meiliResults = await meiliClient.index('decisions').search(searchQuery, {
            limit: 4,
            attributesToRetrieve: ['id', 'titre', 'slug', 'chambre', 'date_decision']
          });

          meiliResults.hits.forEach((hit: any) => {
            mixedResults.push({
              type: 'decision',
              id: hit.id,
              title: hit.titre,
              subtitle: `${hit.chambre || 'Cour Suprême'} · ${hit.date_decision ? new Date(hit.date_decision).getFullYear() : ''}`,
              slug: hit.slug
            });
          });
        } catch (e) {
          console.warn('MeiliSearch error:', e);
        }
      }

      // 2. Search Articles (MeiliSearch)
      if (meiliClient) {
        try {
          const articlesResults = await meiliClient.index('articles').search(searchQuery, {
            limit: 4,
            attributesToRetrieve: ['id', 'article_number', 'slug', 'chapter_name', 'code_slug', 'code_name']
          });

          articlesResults.hits.forEach((hit: any) => {
            mixedResults.push({
              type: 'article',
              id: hit.id,
              title: `Article ${hit.article_number}`,
              subtitle: hit.code_name || 'Code du Travail',
              slug: hit.slug,
              codeSlug: hit.code_slug || 'code-travail'
            });
          });
        } catch (e) {
          console.warn('MeiliSearch articles error:', e);
        }
      }

      setResults(mixedResults);
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    if (query.trim()) {
      navigate(`/search?q=${encodeURIComponent(query)}`);
    } else {
      navigate('/search');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSearch();
    if (e.key === 'Escape') {
      setIsFocused(false);
      inputRef.current?.blur();
    }
  };

  const handleResultClick = (result: SearchResult) => {
    if (result.type === 'decision') {
      navigate(`/decision/${result.slug}`);
    } else {
      navigate(`/code/${result.codeSlug}/${result.slug}`);
    }
  };

  return (
    <section id="hero" className="hero">
      <div className="hero__bg-abstract"></div>

      <div className="hero__container container">
        <div className="hero__content animate-fade-up">
          <h1 className="hero__title">
            La <span className="text-gradient">référence</span> numérique<br />
            du droit sénégalais.
          </h1>
          <p className="hero__subtitle">
            LEXENEGAL n'est pas un outil. C'est la mémoire juridique organisée du Sénégal.
          </p>

          {/* SPOTLIGHT SEARCH */}
          <div className={`spotlight ${isFocused ? 'spotlight--active' : ''}`}>
            <div className="spotlight__bar">
              <Search className="spotlight__icon" size={22} />
              <input
                ref={inputRef}
                type="text"
                placeholder="Rechercher jurisprudence, articles de loi..."
                className="spotlight__input"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                onFocus={() => setIsFocused(true)}
                onBlur={() => setTimeout(() => setIsFocused(false), 200)}
              />
              {loading && <Loader2 size={18} className="spotlight__loader" />}
              <button className="spotlight__btn" onClick={handleSearch}>
                <ArrowRight size={18} />
              </button>
            </div>

            {/* Smart Preview */}
            {isFocused && (query.length >= 2 || results.length > 0) && (
              <div className="spotlight__preview">
                {results.length === 0 && !loading && query.length >= 2 ? (
                  <p className="spotlight__empty">Aucun résultat pour "{query}"</p>
                ) : (
                  <div className="spotlight__results">
                    {results.map((result) => (
                      <button
                        key={`${result.type}-${result.id}`}
                        className="spotlight__result"
                        onClick={() => handleResultClick(result)}
                      >
                        <span className="spotlight__result-icon">
                          {result.type === 'decision' ? (
                            <Scale size={16} />
                          ) : (
                            <BookOpen size={16} />
                          )}
                        </span>
                        <div className="spotlight__result-content">
                          <span className="spotlight__result-title">{result.title}</span>
                          <span className="spotlight__result-subtitle">{result.subtitle}</span>
                        </div>
                        <span className={`spotlight__result-badge ${result.type}`}>
                          {result.type === 'decision' ? '⚖️' : '📖'}
                        </span>
                      </button>
                    ))}
                  </div>
                )}

                <button className="spotlight__all" onClick={handleSearch}>
                  Voir tous les résultats
                  <ArrowRight size={14} />
                </button>
              </div>
            )}
          </div>

          {/* Suggestions */}
          <div className="hero__suggestions">
            <span className="hero__suggestions-label">Essayez :</span>
            {suggestions.map((tag, i) => (
              <button
                key={i}
                className="hero__suggestion-tag"
                onClick={() => {
                  setQuery(tag);
                  inputRef.current?.focus();
                }}
              >
                {tag}
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

export default Hero;
