import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Search, Scale, BookOpen, ArrowRight, Loader2 } from 'lucide-react';
import { createClient } from '@supabase/supabase-js';
import './Hero.css';

// Supabase client for Full-Text Search
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = supabaseUrl ? createClient(supabaseUrl, supabaseAnonKey) : null;

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
      // 1. Search Decisions (Supabase FTS)
      if (supabase) {
        try {
          const { data: decisions, error } = await supabase
            .rpc('search_decisions_fts', {
              query: searchQuery
            });

          if (!error && decisions) {
            // Take top 4 decisions since the RPC returns 50 by default
            decisions.slice(0, 4).forEach((hit: any) => {
              mixedResults.push({
                type: 'decision',
                id: hit.id,
                title: hit.reference || 'Décision',
                subtitle: `${hit.chambre || hit.juridiction || 'Juridiction'} · ${hit.date ? new Date(hit.date).getFullYear() : ''}`,
                slug: hit.id // Use ID as slug for decisions
              });
            });
          }
        } catch (e) {
          console.warn('Supabase decisions search error:', e);
        }
      }

      // 2. Search Articles (Supabase FTS)
      if (supabase) {
        try {
          const { data: articles, error } = await supabase
            .rpc('search_articles', {
              search_query: searchQuery,
              result_limit: 4
            });

          if (!error && articles) {
            articles.forEach((hit: any) => {
              mixedResults.push({
                type: 'article',
                id: hit.id,
                title: `Article ${hit.article_number}`,
                subtitle: hit.code_title || 'Code',
                slug: hit.slug,
                codeSlug: hit.code_slug || 'code-travail'
              });
            });
          }
        } catch (e) {
          console.warn('Supabase articles search error:', e);
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
      {/* Animated SVG Grid Background */}
      <svg className="hero__grid-svg" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <defs>
          <pattern id="heroGrid" width="60" height="60" patternUnits="userSpaceOnUse">
            <path d="M 60 0 L 0 0 0 60" fill="none" stroke="rgba(4, 120, 87, 0.1)" strokeWidth="0.5"/>
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#heroGrid)" />
        {/* Structural guide lines */}
        <line x1="0" y1="20%" x2="100%" y2="20%" className="hero__grid-line" style={{ animationDelay: '0.5s' }} />
        <line x1="0" y1="80%" x2="100%" y2="80%" className="hero__grid-line" style={{ animationDelay: '1s' }} />
        <line x1="25%" y1="0" x2="25%" y2="100%" className="hero__grid-line" style={{ animationDelay: '1.5s' }} />
        <line x1="75%" y1="0" x2="75%" y2="100%" className="hero__grid-line" style={{ animationDelay: '2s' }} />
        {/* Intersection dots */}
        <circle cx="25%" cy="20%" r="1.5" className="hero__grid-dot" style={{ animationDelay: '2.5s' }} />
        <circle cx="75%" cy="20%" r="1.5" className="hero__grid-dot" style={{ animationDelay: '2.7s' }} />
        <circle cx="25%" cy="80%" r="1.5" className="hero__grid-dot" style={{ animationDelay: '2.9s' }} />
        <circle cx="75%" cy="80%" r="1.5" className="hero__grid-dot" style={{ animationDelay: '3.1s' }} />
        <circle cx="50%" cy="50%" r="1" className="hero__grid-dot" style={{ animationDelay: '3.5s' }} />
      </svg>

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
