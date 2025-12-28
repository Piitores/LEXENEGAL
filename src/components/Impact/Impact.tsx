import React from 'react';
import './Impact.css';

function Impact() {
    const stats = [
        { value: '15,000+', label: 'Décisions Indexées' },
        { value: '100%', label: 'Juridictions Couvertes' },
        { value: '-70%', label: 'Temps de Recherche' },
        { value: '24/7', label: 'Disponibilité' },
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
