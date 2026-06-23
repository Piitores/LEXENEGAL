import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, useLocation } from 'react-router-dom';
import { Sparkles, X } from 'lucide-react';
import useAuth from '../../hooks/useAuth';
import './AccountNudge.css';

const DISMISS_KEY = 'lexenegal_nudge_dismissed_at';
const DISMISS_DAYS = 7;        // ne pas re-proposer avant 7 jours après un rejet
const DELAY_MS = 60000;        // ~60 s d'engagement avant l'invitation

// Pages où l'invitation n'a pas de sens (auth, admin, demande d'accès, cabinet)
const SUPPRESSED = ['/login', '/signup', '/auth', '/admin', '/solliciter-acces', '/cabinet'];

/**
 * Invitation NON BLOQUANTE à créer un compte gratuit.
 * Slide-in discret en bas d'écran, fermable instantanément, jamais d'interstitiel.
 * Masquée si l'utilisateur est connecté ou a fermé l'invitation récemment.
 */
const AccountNudge: React.FC = () => {
    const { isConnected, loading } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        if (loading || isConnected) return;
        try {
            const ts = Number(localStorage.getItem(DISMISS_KEY) || 0);
            if (ts && Date.now() - ts < DISMISS_DAYS * 86400000) return;
        } catch { /* localStorage indisponible */ }
        const t = setTimeout(() => setVisible(true), DELAY_MS);
        return () => clearTimeout(t);
    }, [loading, isConnected]);

    useEffect(() => {
        if (isConnected) setVisible(false);
    }, [isConnected]);

    const dismiss = () => {
        setVisible(false);
        try { localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch { /* ignore */ }
    };

    const suppressed = SUPPRESSED.some(p => location.pathname.startsWith(p));
    if (isConnected || suppressed) return null;

    return (
        <AnimatePresence>
            {visible && (
                <motion.div
                    className="account-nudge"
                    initial={{ opacity: 0, y: 24 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 24 }}
                    transition={{ type: 'spring', damping: 24, stiffness: 280 }}
                    role="dialog"
                    aria-label="Créer un compte gratuit"
                >
                    <button className="account-nudge__close" onClick={dismiss} aria-label="Fermer">
                        <X size={16} />
                    </button>
                    <div className="account-nudge__icon"><Sparkles size={18} /></div>
                    <div className="account-nudge__body">
                        <strong>Créez votre compte gratuit</strong>
                        <span>Enregistrez vos favoris, annotez et téléchargez en PDF. La lecture reste libre.</span>
                    </div>
                    <div className="account-nudge__actions">
                        <button className="account-nudge__cta" onClick={() => { dismiss(); navigate('/signup'); }}>
                            Créer un compte
                        </button>
                        <button className="account-nudge__link" onClick={() => { dismiss(); navigate('/login'); }}>
                            Se connecter
                        </button>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};

export default AccountNudge;
