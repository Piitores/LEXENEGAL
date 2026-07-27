import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Scale, BookOpen, Globe2, FileText, ArrowRight } from 'lucide-react';
import {
    fetchPublicStats, formatFr, libelleArticles, libelleDecisions, type PublicStats,
} from '../../lib/homeStats';
import './PiliersAccess.css';

interface Pilier {
    to: string;
    icon: React.ReactNode;
    title: string;
    count: string;
    desc: string;
}

/**
 * Les compteurs des piliers viennent de `get_public_stats` (cf. lib/homeStats).
 * Ils étaient codés en dur et faux : « 11 325 décisions » (10 922 réelles) et
 * surtout « 11 codes · 8 131 articles » pour 27 codes et 17 169 articles.
 */
const piliersAvec = (s: PublicStats | null): Pilier[] => [
    {
        to: '/jurisprudence',
        icon: <Scale size={26} strokeWidth={1.6} />,
        title: 'Jurisprudence',
        count: s ? `${libelleDecisions(s)} décisions` : '',
        desc: "Arrêts et décisions des juridictions sénégalaises - Cour suprême, cours d'appel, tribunaux et CCJA.",
    },
    {
        to: '/codes',
        icon: <BookOpen size={26} strokeWidth={1.6} />,
        title: 'Corpus National',
        count: s ? `${formatFr(s.codes)} codes · ${libelleArticles(s)} articles` : '',
        desc: 'Codes consolidés et LODA (lois, ordonnances, décrets, arrêtés, circulaires) du Sénégal. Journaux officiels à venir.',
    },
    {
        to: '/search?q=OHADA',
        icon: <Globe2 size={26} strokeWidth={1.6} />,
        title: 'Droit communautaire',
        count: s ? `${formatFr(s.ohada)} actes uniformes` : '',
        desc: 'Le droit OHADA et UEMOA applicable au Sénégal - actes uniformes, traité et jurisprudence CCJA.',
    },
    {
        to: '/doctrine-fiscale',
        icon: <FileText size={26} strokeWidth={1.6} />,
        title: 'Autour de la loi',
        count: 'Doctrine & ressources',
        desc: 'Doctrine, conventions collectives, rapports ministériels et fiches techniques pour éclairer le droit sénégalais.',
    },
];

const PiliersAccess: React.FC = () => {
    const [s, setS] = useState<PublicStats | null>(null);
    useEffect(() => {
        let vivant = true;
        fetchPublicStats().then((v) => { if (vivant) setS(v); });
        return () => { vivant = false; };
    }, []);

    return (
    <section id="piliers" className="piliers">
        <div className="container">
            <header className="piliers__header">
                <h2 className="piliers__title">
                    Tout le droit sénégalais, <span className="text-gradient">en quatre piliers</span>
                </h2>
                <p className="piliers__subtitle">
                    Jurisprudence, codes et lois, droit communautaire et doctrine - réunis, vérifiés et reliés entre eux.
                </p>
            </header>

            <div className="piliers__grid">
                {piliersAvec(s).map((p) => (
                    <Link key={p.title} to={p.to} className="pilier-card">
                        <span className="pilier-card__icon">{p.icon}</span>
                        <span className="pilier-card__count">{p.count}</span>
                        <h3 className="pilier-card__title">{p.title}</h3>
                        <p className="pilier-card__desc">{p.desc}</p>
                        <span className="pilier-card__cta">
                            Explorer <ArrowRight size={15} />
                        </span>
                    </Link>
                ))}
            </div>
        </div>
    </section>
    );
};

export default PiliersAccess;
