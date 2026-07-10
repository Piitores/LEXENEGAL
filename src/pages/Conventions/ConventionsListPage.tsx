import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, FileText, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import SEO from '../../components/SEO/SEO';
import '../Codes/CodesListPage.css';

interface ConventionItem {
    id: string;
    title: string;
    slug: string;
    short_title: string | null;
    articles_count: number;
}

// Page « Conventions collectives » (menu « Autour de la loi »).
// Liste les textes category='convention_collective' publiés ; chacun ouvre son
// texte intégral sous /convention/<slug>.
const ConventionsListPage: React.FC = () => {
    const [items, setItems] = useState<ConventionItem[] | null>(null);

    useEffect(() => {
        (async () => {
            const { data } = await supabase
                .from('laws_and_codes')
                .select('id, title, slug, short_title, category, is_active, articles:articles(count)')
                .eq('category', 'convention_collective')
                .eq('is_active', true)
                .order('title');
            setItems(
                (data || []).map((c: any) => ({
                    id: c.id,
                    title: c.title,
                    slug: c.slug,
                    short_title: c.short_title,
                    articles_count: c.articles?.[0]?.count || 0,
                })),
            );
        })();
    }, []);

    return (
        <div className="corpus-page">
            <SEO
                title="Conventions collectives | Lexenegal"
                description="Conventions collectives applicables au Sénégal — texte intégral consolidé, articles reliés au Code du travail. Droit du travail sénégalais sur Lexenegal."
                url="https://www.lexenegal.sn/conventions-collectives"
            />

            <header className="corpus-hero">
                <div className="corpus-hero__container">
                    <div className="corpus-hero__emblem">
                        <FileText size={30} />
                    </div>
                    <h1>Conventions collectives</h1>
                    <p>
                        Les conventions collectives applicables au Sénégal, en texte intégral consolidé,
                        avec les renvois au Code du travail rendus cliquables.
                    </p>
                </div>
            </header>

            <section className="corpus-content">
                <div className="corpus-container">
                    {items === null ? (
                        <div className="corpus-loading">
                            <Loader2 size={40} className="spinner" />
                        </div>
                    ) : items.length === 0 ? (
                        <div className="corpus-loading">Aucune convention collective publiée pour le moment.</div>
                    ) : (
                        <div className="codes-list">
                            {items.map((c) => (
                                <Link key={c.id} to={`/convention/${c.slug}`} className="code-card-v2">
                                    <div className="code-card-v2__icon" style={{ background: '#2563eb15', color: '#2563eb' }}>
                                        <FileText size={24} />
                                    </div>
                                    <div className="code-card-v2__content">
                                        <h3>{c.short_title || c.title}</h3>
                                        <p>{c.title}</p>
                                        <span className="code-card-v2__meta">{c.articles_count} articles</span>
                                    </div>
                                    <ChevronRight size={18} className="code-card-v2__arrow" />
                                </Link>
                            ))}
                        </div>
                    )}
                </div>
            </section>
        </div>
    );
};

export default ConventionsListPage;
