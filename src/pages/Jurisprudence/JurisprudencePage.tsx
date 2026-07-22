import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { Loader2, Scale, Search, Landmark, Tags } from 'lucide-react';
import './JurisprudencePage.css';

/*
 * Hub Jurisprudence (/jurisprudence) - porte d'entrée du pilier, DISTINCTE de la
 * page de résultats de recherche (/search). Présente les matières et les
 * pages-thèmes (seo_themes). SSR : api/render.js type=jurisprudence.
 */

interface ThemeIndexItem {
    slug: string;
    label: string;
    matiere: string | null;
    cached_total: number;
}

const JurisprudencePage: React.FC = () => {
    const navigate = useNavigate();
    const [themes, setThemes] = useState<ThemeIndexItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [query, setQuery] = useState('');

    useEffect(() => {
        let active = true;
        (async () => {
            const { data } = await supabase
                .from('seo_themes')
                .select('slug, label, matiere, cached_total')
                .eq('is_active', true)
                .order('cached_total', { ascending: false })
                .limit(200);
            if (!active) return;
            setThemes((data as ThemeIndexItem[]) || []);
            setLoading(false);
        })();
        return () => { active = false; };
    }, []);

    useEffect(() => {
        document.title = 'Jurisprudence du Sénégal - décisions de justice en texte intégral | Lexenegal';
        return () => { document.title = 'Lexenegal'; };
    }, []);

    const submitSearch = (e: React.FormEvent) => {
        e.preventDefault();
        navigate(query.trim() ? `/search?q=${encodeURIComponent(query.trim())}` : '/search');
    };

    const matieres = themes.filter((t) => t.matiere);
    const sujets = themes.filter((t) => !t.matiere);

    return (
        <div className="juris-hub">
            <div className="juris-hub__container">
                <header className="juris-hub__header">
                    <span className="juris-hub__eyebrow"><Scale size={14} /> Jurisprudence</span>
                    <h1>Jurisprudence du Sénégal et de l'OHADA</h1>
                    <p className="juris-hub__intro">
                        Consultez les décisions de justice en texte intégral : Cour suprême, Cour de
                        cassation, Conseil constitutionnel, cours d'appel et tribunaux, ainsi que la
                        CCJA (OHADA). Chaque décision est reliée aux articles de codes qu'elle cite.
                    </p>
                    <form className="juris-hub__search" onSubmit={submitSearch} role="search">
                        <Search size={18} />
                        <input
                            type="search"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="Rechercher une décision, un mot-clé, une référence…"
                            aria-label="Rechercher dans la jurisprudence"
                        />
                        <button type="submit">Rechercher</button>
                    </form>
                </header>

                {loading ? (
                    <div className="juris-hub__loading">
                        <Loader2 size={32} className="spinner" />
                    </div>
                ) : (
                    <>
                        {matieres.length > 0 && (
                            <section className="juris-hub__section">
                                <h2><Landmark size={18} /> Par matière</h2>
                                <ul className="juris-hub__grid juris-hub__grid--matieres">
                                    {matieres.map((t) => (
                                        <li key={t.slug}>
                                            <Link to={`/jurisprudence/theme/${t.slug}`}>
                                                <strong>{t.label}</strong>
                                                <span>{t.cached_total} décisions</span>
                                            </Link>
                                        </li>
                                    ))}
                                </ul>
                            </section>
                        )}

                        {sujets.length > 0 && (
                            <section className="juris-hub__section">
                                <h2><Tags size={18} /> Par thème</h2>
                                <ul className="juris-hub__grid">
                                    {sujets.map((t) => (
                                        <li key={t.slug}>
                                            <Link to={`/jurisprudence/theme/${t.slug}`}>
                                                <strong>{t.label}</strong>
                                                <span>{t.cached_total} décisions</span>
                                            </Link>
                                        </li>
                                    ))}
                                </ul>
                            </section>
                        )}
                    </>
                )}
            </div>
        </div>
    );
};

export default JurisprudencePage;
