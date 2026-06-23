import React from 'react';
import { Link } from 'react-router-dom';
import { Bookmark, Clock, FolderOpen, ArrowRight } from 'lucide-react';
import './FreeAccountCTA.css';

const BENEFITS = [
    { icon: <Bookmark size={18} strokeWidth={1.7} />, label: 'Favoris & annotations' },
    { icon: <Clock size={18} strokeWidth={1.7} />, label: 'Historique de consultation' },
    { icon: <FolderOpen size={18} strokeWidth={1.7} />, label: 'Votre espace personnel' },
];

const FreeAccountCTA: React.FC = () => (
    <section id="creer-compte" className="free-cta">
        <div className="container">
            <div className="free-cta__panel">
                <h2 className="free-cta__title">
                    Créez votre compte <span className="text-gradient">gratuit</span>
                </h2>
                <p className="free-cta__subtitle">
                    L'accès au droit sénégalais est ouvert à tous. Créez un compte gratuit pour
                    enregistrer vos favoris, retrouver votre historique et organiser votre travail.
                </p>

                <ul className="free-cta__benefits">
                    {BENEFITS.map((b) => (
                        <li key={b.label} className="free-cta__benefit">
                            <span className="free-cta__benefit-icon">{b.icon}</span>
                            {b.label}
                        </li>
                    ))}
                </ul>

                <div className="free-cta__actions">
                    <Link to="/signup" className="free-cta__btn free-cta__btn--primary">
                        Créer mon compte gratuit <ArrowRight size={18} />
                    </Link>
                    <Link to="/login" className="free-cta__btn free-cta__btn--ghost">
                        J'ai déjà un compte
                    </Link>
                </div>

                <p className="free-cta__cabinet">
                    Vous êtes un cabinet ou une institution ?{' '}
                    <Link to="/solliciter-acces">Écrivez-nous</Link>.
                </p>
            </div>
        </div>
    </section>
);

export default FreeAccountCTA;
