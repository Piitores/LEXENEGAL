import React from 'react';
import './Impact.css';

function Impact() {
    const stats = [
        { value: '1,300+', label: 'Décisions de la Cour Suprême' },
        { value: '10+', label: 'Codes & Textes de Loi' },
        { value: '4,400+', label: 'Articles Indexés' },
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
