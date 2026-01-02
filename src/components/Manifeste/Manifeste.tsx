import React from 'react';
import './Manifeste.css';

const Manifeste: React.FC = () => {
    return (
        <section className="manifeste">
            <div className="container">
                <div className="manifeste__divider"></div>

                {/* L'Équité par la Clarté - Tagline */}
                <h3 className="manifeste__tagline">L'Équité par la Clarté</h3>

                <blockquote className="manifeste__text">
                    Au carrefour de la tradition juridique et de l'innovation, nous croyons que le droit ne doit plus être une matière opaque. Notre mission est de restaurer la clarté là où régnait la complexité.
                    <br /><br />
                    En éditant chaque décision avec la précision due aux grands arrêts, nous offrons aux acteurs du droit sénégalais — magistrats, avocats et citoyens — un instrument de vérité.
                    <br /><br />
                    <strong>Lexenegal n'est pas seulement une base de données ; c'est l'engagement d'une justice accessible, documentée et technologiquement souveraine.</strong>
                </blockquote>
                <div className="manifeste__signature">— Le Manifeste Lexenegal</div>
            </div>
        </section>
    );
};

export default Manifeste;

