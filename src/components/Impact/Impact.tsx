import React, { useEffect, useState } from 'react';
import {
    fetchPublicStats, formatFr, libelleArticles, libelleDecisions, type PublicStats,
} from '../../lib/homeStats';
import './Impact.css';

/**
 * Chiffres d'impact — lus EN DIRECT depuis `get_public_stats` (cf. lib/homeStats).
 * Ils étaient auparavant codés en dur et périmés : « 8 000+ articles » pour
 * 17 169 réels, « 11 codes » pour 27, « 6 juridictions » pour 22.
 */
function Impact() {
    const [s, setS] = useState<PublicStats | null>(null);

    useEffect(() => {
        let vivant = true;
        fetchPublicStats().then((v) => { if (vivant) setS(v); });
        return () => { vivant = false; };
    }, []);

    const stats = s
        ? [
            { value: libelleDecisions(s), label: 'Décisions de Jurisprudence' },
            { value: libelleArticles(s), label: 'Articles de Loi Indexés' },
            { value: formatFr(s.codes), label: 'Codes du Corpus National' },
            { value: formatFr(s.juridictions), label: 'Juridictions Couvertes' },
            { value: '24/7', label: 'Accès Gratuit' },
        ]
        : null;

    return (
        <section id="impact" className="impact">
            <div className="container">
                <div className="impact__grid">
                    {(stats ?? []).map((stat, i) => (
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
