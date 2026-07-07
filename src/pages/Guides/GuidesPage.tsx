import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { Loader2, BookMarked } from 'lucide-react';
import './GuidesPage.css';

/*
 * Liste des guides pratiques (/guides). SSR : api/render.js type=guides.
 * Chantier B — Strategie-SEO-Contenu-Topical.
 */

interface GuideIndexItem {
    slug: string;
    title: string;
    description: string;
    published_at: string;
}

const GuidesPage: React.FC = () => {
    const [guides, setGuides] = useState<GuideIndexItem[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let active = true;
        (async () => {
            const { data } = await supabase
                .from('guides')
                .select('slug, title, description, published_at')
                .eq('is_active', true)
                .order('published_at', { ascending: false })
                .limit(200);
            if (!active) return;
            setGuides((data as GuideIndexItem[]) || []);
            setLoading(false);
        })();
        return () => { active = false; };
    }, []);

    useEffect(() => {
        document.title = 'Guides pratiques du droit sénégalais | Lexenegal';
        return () => { document.title = 'Lexenegal'; };
    }, []);

    return (
        <div className="guides-page">
            <div className="guides-page__container">
                <header className="guides-page__header">
                    <span className="guides-page__eyebrow"><BookMarked size={14} /> Guides pratiques</span>
                    <h1>Guides pratiques du droit sénégalais</h1>
                    <p>
                        Des réponses claires, appuyées sur les codes, les lois et la jurisprudence
                        du Sénégal, aux questions juridiques les plus fréquentes.
                    </p>
                </header>

                {loading ? (
                    <div className="guides-page__loading"><Loader2 size={32} className="spinner" /></div>
                ) : (
                    <ul className="guides-page__list">
                        {guides.map((g) => (
                            <li key={g.slug}>
                                <Link to={`/guides/${g.slug}`}>
                                    <strong>{g.title}</strong>
                                    {g.description && <span>{g.description}</span>}
                                </Link>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </div>
    );
};

export default GuidesPage;
