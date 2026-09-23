/**
 * LEXENEGAL - Bot Blocker Component
 * 
 * Détection des navigateurs headless et robots (heuristiques dans lib/botDetect.ts,
 * testées sous vitest). Les robots d'indexation vérifiés ne sont jamais bloqués :
 * le 2026-09-23, Google rendait TOUTES les pages avec cette modale.
 */

import React, { useEffect, useState } from 'react';
import { Shield, AlertTriangle } from 'lucide-react';
import './BotBlocker.css';
import { detectBot, readBotEnv, type BotDetection } from '../../lib/botDetect';

interface BotBlockerProps {
    children: React.ReactNode;
}

const BotBlocker: React.FC<BotBlockerProps> = ({ children }) => {
    const [detection, setDetection] = useState<BotDetection>({ isBot: false, reasons: [] });
    const [dismissed, setDismissed] = useState(false);

    useEffect(() => {
        // Délai pour éviter les faux positifs lors du chargement
        const timer = setTimeout(() => {
            const result = detectBot(readBotEnv());
            setDetection(result);

            if (result.isBot) {
                console.warn('🤖 Bot detection triggered:', result.reasons);
            }
        }, 1000);

        return () => clearTimeout(timer);
    }, []);

    // Si bot détecté et non dismissé, afficher l'avertissement
    if (detection.isBot && !dismissed) {
        return (
            <div className="bot-blocker">
                <div className="bot-blocker__overlay" />
                <div className="bot-blocker__modal">
                    <div className="bot-blocker__icon">
                        <Shield size={48} />
                    </div>
                    <h2>Protection du Corpus National</h2>
                    <p>
                        <AlertTriangle size={16} style={{ display: 'inline', marginRight: '8px' }} />
                        Une activité automatisée a été détectée.
                    </p>
                    <p className="bot-blocker__text">
                        LEXENEGAL protège le patrimoine juridique sénégalais contre l'extraction automatisée.
                        Si vous êtes un utilisateur légitime, veuillez utiliser un navigateur standard.
                    </p>
                    <div className="bot-blocker__actions">
                        <button
                            className="bot-blocker__btn bot-blocker__btn--primary"
                            onClick={() => setDismissed(true)}
                        >
                            Je suis un humain, continuer
                        </button>
                        <a href="mailto:contact@lexenegal.sn" className="bot-blocker__link">
                            Signaler un problème
                        </a>
                    </div>
                </div>
                {/* Contenu en arrière-plan (flou) */}
                <div className="bot-blocker__background">
                    {children}
                </div>
            </div>
        );
    }

    return <>{children}</>;
};

export default BotBlocker;
