import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { Loader2, Scale, FileText, BookOpen, HelpCircle } from 'lucide-react';
import './ThemePage.css';

/*
 * Page-thème de jurisprudence (/jurisprudence/theme/:slug).
 * Le SSR (api/render.js type=theme) sert le même contenu aux crawlers ;
 * cette page prend le relais après hydratation. Données : RPC get_theme_page
 * (table seo_themes — chantier Strategie-SEO-Contenu-Topical).
 */

interface ThemeFaqItem { q: string; a: string; }
interface ThemeDecision {
    slug: string;
    reference: string | null;
    juridiction: string | null;
    chambre: string | null;
    date_decision: string | null;
    matiere_principale: string | null;
    resume: string | null;
}
interface ThemeArticle {
    article_slug: string;
    article_label: string;
    code_slug: string;
    code_title: string;
    n: number;
}
interface ThemePageData {
    theme: {
        slug: string;
        label: string;
        h1: string;
        chapo: string;
        faq: ThemeFaqItem[];
    };
    total: number;
    juridictions: { juridiction: string; n: number }[];
    decisions: ThemeDecision[];
    articles: ThemeArticle[];
}

const formatDateFr = (d: string | null) => {
    if (!d) return '';
    try {
        return new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
    } catch {
        return '';
    }
};

const ThemePage: React.FC = () => {
    const { slug } = useParams();
    const [data, setData] = useState<ThemePageData | null>(null);
    const [notFound, setNotFound] = useState(false);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let active = true;
        setLoading(true);
        setNotFound(false);
        (async () => {
            const { data: page, error } = await supabase.rpc('get_theme_page', { p_slug: slug });
            if (!active) return;
            if (error || !page || !page.theme) setNotFound(true);
            else setData(page as ThemePageData);
            setLoading(false);
        })();
        return () => { active = false; };
    }, [slug]);

    // Titre côté SPA (le SSR sert déjà le <head> complet aux crawlers).
    useEffect(() => {
        if (data) {
            document.title = `${data.theme.label} au Sénégal : jurisprudence (${data.total} décisions) | Lexenegal`;
        }
        return () => { document.title = 'Lexenegal'; };
    }, [data]);

    if (loading) {
        return (
            <div className="theme-page">
                <div className="theme-page__container theme-page__loading">
                    <Loader2 size={40} className="spinner" />
                    <p>Chargement…</p>
                </div>
            </div>
        );
    }

    if (notFound || !data) {
        return (
            <div className="theme-page">
                <div className="theme-page__container theme-page__empty">
                    <Scale size={48} />
                    <h1>Thème introuvable</h1>
                    <p>Ce thème de jurisprudence n'existe pas ou n'est pas encore publié.</p>
                    <Link to="/search" className="theme-page__cta">Rechercher dans la jurisprudence</Link>
                </div>
            </div>
        );
    }

    const { theme, total, juridictions, decisions, articles } = data;
    const jurisTxt = (juridictions || []).slice(0, 6).map((j) => `${j.juridiction} (${j.n})`).join(', ');
    const faq = (theme.faq || []).filter((f) => f && f.q && f.a);

    return (
        <div className="theme-page">
            <div className="theme-page__container">
                <nav className="theme-page__breadcrumb" aria-label="Fil d'Ariane">
                    <Link to="/search">Jurisprudence</Link> <span>›</span> {theme.label}
                </nav>

                <header className="theme-page__header">
                    <span className="theme-page__eyebrow"><Scale size={14} /> Thème de jurisprudence</span>
                    <h1>{theme.h1}</h1>
                    <p className="theme-page__chapo">{theme.chapo}</p>
                    <p className="theme-page__stats">
                        <strong>{total} décisions</strong> sur ce thème dans la base{jurisTxt ? ` : ${jurisTxt}.` : '.'}
                    </p>
                </header>

                {articles.length > 0 && (
                    <section className="theme-page__section">
                        <h2><BookOpen size={18} /> Articles de codes les plus cités</h2>
                        <ul className="theme-page__articles">
                            {articles.map((a) => (
                                <li key={`${a.code_slug}/${a.article_slug}`}>
                                    <Link to={`/code/${a.code_slug}/${a.article_slug}`}>
                                        {a.article_label} — {a.code_title}
                                    </Link>
                                    <span className="theme-page__article-count">
                                        cité par {a.n} décision{a.n > 1 ? 's' : ''}
                                    </span>
                                </li>
                            ))}
                        </ul>
                    </section>
                )}

                <section className="theme-page__section">
                    <h2><FileText size={18} /> Décisions récentes — {theme.label}</h2>
                    <ul className="theme-page__decisions">
                        {decisions.map((d) => {
                            const meta = [d.juridiction, d.chambre, formatDateFr(d.date_decision)]
                                .filter(Boolean).join(' — ');
                            return (
                                <li key={d.slug}>
                                    <Link to={`/decision/${d.slug}`} className="theme-page__decision-ref">
                                        {d.reference || 'Décision'}
                                    </Link>
                                    {meta && <span className="theme-page__decision-meta">{meta}</span>}
                                    {d.resume && <p className="theme-page__decision-resume">{d.resume}</p>}
                                </li>
                            );
                        })}
                    </ul>
                </section>

                {faq.length > 0 && (
                    <section className="theme-page__section theme-page__faq">
                        <h2><HelpCircle size={18} /> Questions fréquentes — {theme.label}</h2>
                        {faq.map((f) => (
                            <details key={f.q}>
                                <summary>{f.q}</summary>
                                <p>{f.a}</p>
                            </details>
                        ))}
                    </section>
                )}

                <p className="theme-page__more">
                    <Link to={`/search?q=${encodeURIComponent(theme.label)}`}>
                        Rechercher « {theme.label} » dans toute la base →
                    </Link>
                </p>
            </div>
        </div>
    );
};

export default ThemePage;
