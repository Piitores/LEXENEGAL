import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, FileText } from 'lucide-react';
import {
    badgePour, fetchRecentPublications, metaPour, type RecentPublication,
} from '../../lib/homeStats';
import './RecentlyPublished.css';

/**
 * « Récemment publié » — alimenté par la RPC `get_recent_publications`.
 *
 * La liste était auparavant CURÉE EN DUR, avec la note « les timestamps DB
 * reflètent les migrations, pas l'édition ». Vérifié le 2026-07-27 : c'est
 * PÉRIMÉ. `laws_and_codes.created_at` suit fidèlement les vraies publications
 * (25/07 = lois sur les institutions judiciaires, 22/07 = CIMA, 21/07 = codes
 * de l'électricité et forestier, 15/07 = code minier…), ce qui recoupe le
 * journal des chantiers. La liste en dur, elle, s'arrêtait à un décret de 2025
 * et masquait un mois entier de publications.
 *
 * La RPC borne à 2 textes par journée de publication pour qu'une grosse fournée
 * (les 28 textes CIMA du 22/07) ne monopolise pas la vitrine.
 */
const RecentlyPublished: React.FC = () => {
    const [items, setItems] = useState<RecentPublication[] | null>(null);

    useEffect(() => {
        let vivant = true;
        fetchRecentPublications(6).then((v) => { if (vivant) setItems(v); });
        return () => { vivant = false; };
    }, []);

    // Rien à montrer (base injoignable) → on masque la section plutôt que
    // d'afficher une vitrine vide ou, pire, des nouveautés qui n'en sont plus.
    if (items !== null && items.length === 0) return null;

    return (
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
                    {(items ?? []).map((item) => (
                        <Link key={item.slug} to={`/code/${item.slug}`} className="recent-card">
                            <span className="recent-card__badge">{badgePour(item.category)}</span>
                            <span className="recent-card__icon"><FileText size={18} strokeWidth={1.6} /></span>
                            <h3 className="recent-card__title">{item.titre}</h3>
                            <span className="recent-card__meta">{metaPour(item)}</span>
                        </Link>
                    ))}
                </div>
            </div>
        </section>
    );
};

export default RecentlyPublished;
