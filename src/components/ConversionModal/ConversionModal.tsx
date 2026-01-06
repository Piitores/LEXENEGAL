import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Scale, X, Sparkles } from 'lucide-react';
import './ConversionModal.css';

interface ConversionModalProps {
    isOpen: boolean;
    onClose: () => void;
    onRequestAccess: () => void;
    remainingDays?: number;  // Jours restants dans l'essai
}

const ConversionModal: React.FC<ConversionModalProps> = ({
    isOpen,
    onClose,
    onRequestAccess,
    remainingDays
}) => {
    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* BACKDROP */}
                    <motion.div
                        className="modal-backdrop"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                    />

                    {/* MODAL */}
                    <motion.div
                        className="conversion-modal"
                        initial={{ opacity: 0, scale: 0.9, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: 20 }}
                        transition={{ type: "spring", damping: 25, stiffness: 300 }}
                    >
                        {/* CLOSE BUTTON */}
                        <button className="modal-close" onClick={onClose}>
                            <X size={20} />
                        </button>

                        {/* ICON */}
                        <div className="modal-icon">
                            <Scale size={32} />
                        </div>

                        {/* TITLE */}
                        <h2 className="modal-title">
                            Passez au standard supérieur.
                        </h2>

                        {/* MESSAGE */}
                        <p className="modal-message">
                            Vous avez épuisé vos crédits de consultation gratuite.
                            Pour accéder à l'intégralité de l'Arsenal Lexenegal,
                            télécharger nos <strong>Éditions Certifiées</strong> et utiliser
                            nos outils d'analyse avancée, sollicitez un accès privilégié.
                        </p>

                        {/* FEATURES LIST */}
                        <ul className="modal-features">
                            <li><Sparkles size={14} /> Téléchargement illimité PDF Master Edition</li>
                            <li><Sparkles size={14} /> Synthèse Juridique complète (Faits, Motifs, Dispositif)</li>
                            <li><Sparkles size={14} /> Dossiers personnels et favoris</li>
                        </ul>

                        {/* TRIAL REMINDER */}
                        {remainingDays !== undefined && remainingDays > 0 && (
                            <div className="trial-reminder">
                                <span className="trial-badge">Essai</span>
                                {remainingDays} jour{remainingDays > 1 ? 's' : ''} restant{remainingDays > 1 ? 's' : ''} dans votre période d'essai
                            </div>
                        )}

                        {/* CTA BUTTON */}
                        <button
                            className="modal-cta"
                            onClick={() => {
                                onClose();
                                window.location.href = '/espace-professionnel#contact';
                            }}
                        >
                            Solliciter un Accès Privilégié
                        </button>

                        {/* SECONDARY LINK */}
                        <button
                            className="modal-secondary"
                            onClick={onClose}
                        >
                            Continuer la lecture simple sur le web
                        </button>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
};

export default ConversionModal;
