import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Scale, X, Sparkles } from 'lucide-react';
import './ConversionModal.css';

interface ConversionModalProps {
    isOpen: boolean;
    onClose: () => void;
    onRequestAccess?: () => void; // conservé pour compat (non utilisé : le CTA mène à l'inscription)
    remainingDays?: number;       // conservé pour compat
}

/**
 * Invitation à créer un compte GRATUIT (anciennement "passer Pro").
 * Affichée quand un visiteur non connecté tente une action réservée aux membres
 * (favoris, dossiers, annotations, export PDF, comparateur). La lecture reste libre.
 */
const ConversionModal: React.FC<ConversionModalProps> = ({ isOpen, onClose }) => {
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
                    <div className="conversion-modal-wrapper">
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
                                Créez votre compte gratuit
                            </h2>

                            {/* MESSAGE */}
                            <p className="modal-message">
                                C'est <strong>gratuit</strong>. Connectez-vous ou créez un compte
                                pour enregistrer vos favoris, organiser vos dossiers, annoter les
                                décisions et télécharger en PDF. La lecture reste libre.
                            </p>

                            {/* FEATURES LIST */}
                            <ul className="modal-features">
                                <li><Sparkles size={14} /> Favoris &amp; dossiers personnels</li>
                                <li><Sparkles size={14} /> Annotations privées sur les décisions</li>
                                <li><Sparkles size={14} /> Téléchargement PDF &amp; comparateur de versions</li>
                            </ul>

                            {/* CTA BUTTON - création de compte */}
                            <button
                                className="modal-cta"
                                onClick={() => {
                                    onClose();
                                    window.location.href = '/signup';
                                }}
                            >
                                Créer un compte gratuit
                            </button>

                            {/* SECONDARY - déjà inscrit */}
                            <button
                                className="modal-secondary"
                                onClick={() => {
                                    onClose();
                                    window.location.href = '/login';
                                }}
                            >
                                J'ai déjà un compte - Connexion
                            </button>

                            {/* TERTIARY - continuer sans compte */}
                            <button
                                className="modal-secondary"
                                onClick={onClose}
                            >
                                Continuer la lecture sans compte
                            </button>
                        </motion.div>
                    </div>
                </>
            )}
        </AnimatePresence>
    );
};

export default ConversionModal;
