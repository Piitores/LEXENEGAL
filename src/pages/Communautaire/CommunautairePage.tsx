import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Globe2, FileText, ArrowRight, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import SEO from '../../components/SEO/SEO';
import './CommunautairePage.css';

interface OhadaText {
    slug: string;
    title: string;
    short_title: string | null;
}

/**
 * Page « Droit communautaire » — entrée autonome (hors Corpus National).
 * Liste les actes uniformes & textes OHADA dont on dispose (données réelles).
 * UEMOA et Union africaine (UA) : à venir.
 */
const CommunautairePage: React.FC = () => {
    const [actes, setActes] = useState<OhadaText[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        (async () => {
            const { data } = await supabase
                .from('laws_and_codes')
                .select('slug, title, short_title')
                .eq('category', 'ohada')
                .eq('is_active', true)
                .order('title');
            setActes(data || []);
            setLoading(false);
        })();
    }, []);

    return (
        <main className="comm-page">
            <SEO
                title="Droit communautaire (OHADA) au Sénégal | Lexenegal"
                description="Le droit OHADA applicable au Sénégal : actes uniformes, traité et jurisprudence de la CCJA, en texte intégral et consolidé sur Lexenegal."
                url="https://www.lexenegal.sn/droit-communautaire"
            />

            <section className="comm-hero">
                <div className="container">
                    <span className="comm-badge"><Globe2 size={14} /> Droit communautaire</span>
                    <h1 className="comm-title">
                        Le droit <span className="text-gradient">OHADA</span> applicable au Sénégal
                    </h1>
                    <p className="comm-subtitle">
                        Le Sénégal est partie à l'Organisation pour l'harmonisation en Afrique du droit
                        des affaires (OHADA). Retrouvez ici les actes uniformes, le traité et les textes
                        communautaires en vigueur, en texte intégral.
                    </p>
                </div>
            </section>

            <section className="comm-list">
                <div className="container">
                    <h2 className="comm-list__heading">Actes uniformes &amp; textes OHADA</h2>

                    {loading ? (
                        <div className="comm-loading"><Loader2 size={28} className="comm-spin" /></div>
                    ) : actes.length === 0 ? (
                        <p className="comm-empty">Aucun texte OHADA publié pour l'instant.</p>
                    ) : (
                        <div className="comm-grid">
                            {actes.map((a) => (
                                <Link key={a.slug} to={`/code/${a.slug}`} className="comm-card">
                                    <span className="comm-card__icon"><FileText size={20} strokeWidth={1.6} /></span>
                                    <span className="comm-card__title">{a.short_title || a.title}</span>
                                    <ArrowRight size={16} className="comm-card__arrow" />
                                </Link>
                            ))}
                        </div>
                    )}

                    <div className="comm-soon">
                        <span className="comm-soon__pill">À venir</span>
                        UEMOA et traités de l'Union africaine (UA)
                    </div>
                </div>
            </section>
        </main>
    );
};

export default CommunautairePage;
