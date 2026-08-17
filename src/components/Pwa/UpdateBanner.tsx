import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RefreshCw, X } from 'lucide-react';
import { registerServiceWorker, applyUpdate } from '../../lib/pwa';
import './Pwa.css';

/**
 * Enregistre le service worker et signale les nouvelles versions.
 *
 * Le rechargement n'est jamais imposé : une consultation en cours (un article long,
 * une recherche) ne doit pas être interrompue par un rafraîchissement automatique.
 */
const UpdateBanner: React.FC = () => {
    const [ready, setReady] = useState(false);
    const [dismissed, setDismissed] = useState(false);

    useEffect(() => {
        registerServiceWorker(() => setReady(true));
    }, []);

    if (!ready || dismissed) return null;

    return (
        <AnimatePresence>
            <motion.div
                className="pwa-update"
                initial={{ opacity: 0, y: -16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -16 }}
                transition={{ type: 'spring', damping: 24, stiffness: 280 }}
                role="status"
            >
                <RefreshCw size={16} className="pwa-update__icon" aria-hidden="true" />
                <span className="pwa-update__text">Une nouvelle version est disponible.</span>
                <button className="pwa-update__cta" onClick={applyUpdate}>
                    Mettre à jour
                </button>
                <button
                    className="pwa-update__close"
                    onClick={() => setDismissed(true)}
                    aria-label="Ignorer la mise à jour"
                >
                    <X size={15} />
                </button>
            </motion.div>
        </AnimatePresence>
    );
};

export default UpdateBanner;
