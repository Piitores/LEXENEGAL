import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { Loader2, BookMarked, Scale, HelpCircle } from 'lucide-react';
import './GuidesPage.css';

/*
 * Page d'un guide pratique (/guides/:slug). Le contenu HTML vient de notre table
 * guides (rédigé et vérifié par nous → source de confiance, injecté tel quel,
 * même approche que le contenu juridique des codes). SSR : type=guide.
 */

interface GuideFaqItem { q: string; a: string; }
interface GuideDetail {
    slug: string;
    title: string;
    h1: string;
    description: string;
    content_html: string;
    faq: GuideFaqItem[];
    theme_slug: string | null;
    published_at: string;
}

const formatDateFr = (d: string | null) => {
    if (!d) return '';
    try {
        return new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
    } catch {
        return '';
    }
};

const GuideDetailPage: React.FC = () => {
    const { slug } = useParams();
    const [guide, setGuide] = useState<GuideDetail | null>(null);
    const [notFound, setNotFound] = useState(false);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let active = true;
        setLoading(true);
        setNotFound(false);
        (async () => {
            const { data, error } = await supabase
                .from('guides')
                .select('slug, title, h1, description, content_html, faq, theme_slug, published_at')
                .eq('slug', slug)
                .eq('is_active', true)
                .maybeSingle();
            if (!active) return;
            if (error || !data) setNotFound(true);
            else setGuide(data as GuideDetail);
            setLoading(false);
        })();
        return () => { active = false; };
    }, [slug]);

    useEffect(() => {
        if (guide) document.title = `${guide.title} | Lexenegal`;
        return () => { document.title = 'Lexenegal'; };
    }, [guide]);

    if (loading) {
        return (
            <div className="guides-page">
                <div className="guides-page__container guides-page__loading">
                    <Loader2 size={40} className="spinner" />
                </div>
            </div>
        );
    }

    if (notFound || !guide) {
        return (
            <div className="guides-page">
                <div className="guides-page__container guides-page__empty">
                    <BookMarked size={48} />
                    <h1>Guide introuvable</h1>
                    <p>Ce guide n'existe pas ou n'est plus disponible.</p>
                    <Link to="/guides" className="guides-page__cta">Tous les guides pratiques</Link>
                </div>
            </div>
        );
    }

    const faq = (guide.faq || []).filter((f) => f && f.q && f.a);

    return (
        <div className="guides-page guide-detail">
            <div className="guides-page__container">
                <nav className="guide-detail__breadcrumb" aria-label="Fil d'Ariane">
                    <Link to="/guides">Guides pratiques</Link> <span>›</span> {guide.title}
                </nav>

                <header className="guide-detail__header">
                    <h1>{guide.h1 || guide.title}</h1>
                    {guide.published_at && (
                        <p className="guide-detail__date">
                            Publié le {formatDateFr(guide.published_at)} - Lexenegal
                        </p>
                    )}
                </header>

                <div
                    className="guide-detail__body"
                    dangerouslySetInnerHTML={{ __html: guide.content_html }}
                />

                {faq.length > 0 && (
                    <section className="guide-detail__faq">
                        <h2><HelpCircle size={18} /> Questions fréquentes</h2>
                        {faq.map((f) => (
                            <details key={f.q}>
                                <summary>{f.q}</summary>
                                <p>{f.a}</p>
                            </details>
                        ))}
                    </section>
                )}

                {guide.theme_slug && (
                    <p className="guide-detail__theme">
                        <Link to={`/jurisprudence/theme/${guide.theme_slug}`}>
                            <Scale size={16} /> Voir la jurisprudence liée à ce guide →
                        </Link>
                    </p>
                )}
            </div>
        </div>
    );
};

export default GuideDetailPage;
