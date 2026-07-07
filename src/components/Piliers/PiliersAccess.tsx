import React from 'react';
import { Link } from 'react-router-dom';
import { Scale, BookOpen, Globe2, FileText, ArrowRight } from 'lucide-react';
import './PiliersAccess.css';

interface Pilier {
    to: string;
    icon: React.ReactNode;
    title: string;
    count: string;
    desc: string;
}

const PILIERS: Pilier[] = [
    {
        to: '/jurisprudence',
        icon: <Scale size={26} strokeWidth={1.6} />,
        title: 'Jurisprudence',
        count: '11 325 décisions',
        desc: "Arrêts et décisions des juridictions sénégalaises — Cour suprême, cours d'appel, tribunaux et CCJA.",
    },
    {
        to: '/codes',
        icon: <BookOpen size={26} strokeWidth={1.6} />,
        title: 'Corpus National',
        count: '11 codes · 8 131 articles',
        desc: 'Codes consolidés et LODA (lois, ordonnances, décrets, arrêtés, circulaires) du Sénégal. Journaux officiels à venir.',
    },
    {
        to: '/search?q=OHADA',
        icon: <Globe2 size={26} strokeWidth={1.6} />,
        title: 'Droit communautaire',
        count: '11 actes uniformes',
        desc: 'Le droit OHADA et UEMOA applicable au Sénégal — actes uniformes, traité et jurisprudence CCJA.',
    },
    {
        to: '/doctrine-fiscale',
        icon: <FileText size={26} strokeWidth={1.6} />,
        title: 'Autour de la loi',
        count: 'Doctrine & ressources',
        desc: 'Doctrine, conventions collectives, rapports ministériels et fiches techniques pour éclairer le droit sénégalais.',
    },
];

const PiliersAccess: React.FC = () => (
    <section id="piliers" className="piliers">
        <div className="container">
            <header className="piliers__header">
                <h2 className="piliers__title">
                    Tout le droit sénégalais, <span className="text-gradient">en quatre piliers</span>
                </h2>
                <p className="piliers__subtitle">
                    Jurisprudence, codes et lois, droit communautaire et doctrine — réunis, vérifiés et reliés entre eux.
                </p>
            </header>

            <div className="piliers__grid">
                {PILIERS.map((p) => (
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

export default PiliersAccess;
