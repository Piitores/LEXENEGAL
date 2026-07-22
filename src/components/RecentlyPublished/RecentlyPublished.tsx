import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, FileText } from 'lucide-react';
import './RecentlyPublished.css';

interface RecentItem {
    slug: string;
    badge: string;
    title: string;
    meta: string;
}

// Sélection curée de textes réellement publiés récemment (slugs réels).
// (Les timestamps DB reflètent les migrations, pas l'édition → liste curée.)
const RECENT: RecentItem[] = [
    { slug: 'cocc', badge: 'Nouveau', title: 'Code des obligations civiles et commerciales', meta: 'Code consolidé · 948 articles' },
    { slug: 'code-de-l-environnement', badge: 'Code', title: "Code de l'environnement", meta: 'Loi n° 2023-15' },
    { slug: 'decret-2025-227-application-code-environnement', badge: 'Décret', title: "Décret d'application du Code de l'environnement", meta: 'Décret n° 2025-227 · 2025' },
    { slug: 'constitution-senegal', badge: 'Fondamental', title: 'Constitution du Sénégal', meta: 'Loi n° 2001-03' },
    { slug: 'loi-83-71-code-hygiene', badge: 'Code', title: "Code de l'Hygiène", meta: 'Loi n° 83-71' },
    { slug: 'loi-transactions-electroniques', badge: 'Loi', title: 'Loi sur les transactions électroniques', meta: 'Loi n° 2008-08' },
];

const RecentlyPublished: React.FC = () => (
    <section id="recent" className="recent">
        <div className="container">
            <header className="recent__header">
                <div>
                    <h2 className="recent__title">Récemment publié &amp; mis à jour</h2>
                    <p className="recent__subtitle">
                        Le corpus du droit sénégalais s'enrichit en continu - codes consolidés, lois et décrets.
                    </p>
                </div>
                <Link to="/codes" className="recent__all">
                    Tous les textes <ArrowRight size={15} />
                </Link>
            </header>

            <div className="recent__grid">
                {RECENT.map((item) => (
                    <Link key={item.slug} to={`/code/${item.slug}`} className="recent-card">
                        <span className="recent-card__badge">{item.badge}</span>
                        <span className="recent-card__icon"><FileText size={18} strokeWidth={1.6} /></span>
                        <h3 className="recent-card__title">{item.title}</h3>
                        <span className="recent-card__meta">{item.meta}</span>
                    </Link>
                ))}
            </div>
        </div>
    </section>
);

export default RecentlyPublished;
