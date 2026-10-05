import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { avecReprise } from '../../lib/reprise';
import ChargementInterrompu from '../../components/ChargementInterrompu/ChargementInterrompu';
import { Loader2, BookMarked } from 'lucide-react';
import './GuidesPage.css';

/*
 * Liste des guides pratiques (/guides). SSR : api/render.js type=guides.
 * Chantier B - Strategie-SEO-Contenu-Topical.
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
    // Lecture en échec : « Chargement interrompu » + « Réessayer », jamais une liste vide.
    const [echec, setEchec] = useState(false);
    const [tentative, setTentative] = useState(0);

    useEffect(() => {
        let active = true;
        setLoading(true);
        setEchec(false);
        (async () => {
            const { data, error } = await avecReprise(() => supabase
                .from('guides')
                .select('slug, title, description, published_at')
                .eq('is_active', true)
                .order('published_at', { ascending: false })
                .limit(200));
            if (!active) return;
            if (error) setEchec(true);
            else setGuides((data as GuideIndexItem[]) || []);
            setLoading(false);
        })();
        return () => { active = false; };
    }, [tentative]);

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
                ) : echec ? (
                    <ChargementInterrompu onReessayer={() => setTentative((t) => t + 1)} />
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
