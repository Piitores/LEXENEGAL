import React from 'react';
import './Impact.css';

function Impact() {
    const stats = [
        { value: '10 000+', label: 'Décisions de Jurisprudence' },
        { value: '10+', label: 'Codes du Corpus National' },
        { value: '4 400+', label: 'Articles de Loi Indexés' },
        { value: '5', label: 'Juridictions Couvertes' },
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
