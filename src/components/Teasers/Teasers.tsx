import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Cpu, BarChart3, ArrowRight } from 'lucide-react';
import './Teasers.css';

const Teasers: React.FC = () => {
    const navigate = useNavigate();

    return (
        <section className="teasers">
            <div className="container">
                <div className="teasers__grid">
                    {/* SOLUTIONS TEASER */}
                    <div className="teaser-card" onClick={() => navigate('/solutions')}>
                        <div className="teaser-card__icon">
                            <Cpu size={28} />
                        </div>
                        <h3 className="teaser-card__title">Notre Technologie</h3>
                        <p className="teaser-card__desc">
                            Découvrez notre moteur de segmentation IA qui transforme des bulletins complexes en décisions structurées.
                        </p>
                        <span className="teaser-card__link">
                            Explorer <ArrowRight size={16} />
                        </span>
                    </div>

                    {/* PRO TEASER */}
                    <div className="teaser-card teaser-card--premium" onClick={() => navigate('/espace-professionnel')}>
                        <div className="teaser-card__icon teaser-card__icon--gold">
                            <BarChart3 size={28} />
                        </div>
                        <h3 className="teaser-card__title">Espace Professionnel</h3>
                        <p className="teaser-card__desc">
                            Outils de jurimétrie, veille automatisée et analyse de tendances pour avocats et juristes.
                        </p>
                        <span className="teaser-card__link teaser-card__link--gold">
                            Accéder <ArrowRight size={16} />
                        </span>
                    </div>
                </div>
            </div>
        </section>
    );
};

export default Teasers;
