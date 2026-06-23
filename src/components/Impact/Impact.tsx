import React from 'react';
import './Impact.css';

function Impact() {
    // Chiffres à jour au 2026-06-23 (counts publics Supabase) :
    // décisions actives = 11 325 · articles visibles = 8 131 · codes actifs = 11.
    const stats = [
        { value: '11 000+', label: 'Décisions de Jurisprudence' },
        { value: '8 000+', label: 'Articles de Loi Indexés' },
        { value: '11', label: 'Codes du Corpus National' },
        { value: '6', label: 'Juridictions Couvertes' },
        { value: '24/7', label: 'Accès Gratuit' },
    ];

    return (
        <section id="impact" className="impact">
            <div className="container">
                <div className="impact__grid">
                    {stats.map((stat, i) => (
                        <div key={i} className="impact__item">
                            <div className="impact__value text-gradient">{stat.value}</div>
                            <div className="impact__label">{stat.label}</div>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}

export default Impact;
