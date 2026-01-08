/**
 * LEXENEGAL - Bot Blocker Component
 * 
 * Détection des navigateurs headless et robots
 * Protection contre le scraping automatisé
 */

import React, { useEffect, useState } from 'react';
import { Shield, AlertTriangle } from 'lucide-react';
import './BotBlocker.css';

interface BotBlockerProps {
    children: React.ReactNode;
}

/**
 * Détecte si le navigateur est probablement un bot/headless
 */
function detectBot(): { isBot: boolean; reasons: string[] } {
    const reasons: string[] = [];

    // 1. Check navigator.webdriver (Selenium, Puppeteer)
    if (navigator.webdriver) {
        reasons.push('webdriver');
    }

    // 2. Check for automation frameworks
    const windowAny = window as any;
    if (windowAny._phantom || windowAny.__nightmare || windowAny.callPhantom) {
        reasons.push('phantom');
    }

    // 3. Check for missing plugins (bots often have none)
    if (navigator.plugins && navigator.plugins.length === 0) {
        reasons.push('no_plugins');
    }

    // 4. Check for suspicious user agent
    const ua = navigator.userAgent.toLowerCase();
    const suspiciousUA = ['headless', 'phantom', 'selenium', 'puppeteer', 'playwright'];
    if (suspiciousUA.some(s => ua.includes(s))) {
        reasons.push('suspicious_ua');
    }

    // 5. Check for Chrome without Chrome global
    if (ua.includes('chrome') && !windowAny.chrome) {
        reasons.push('fake_chrome');
    }

    // 6. Check for abnormal screen dimensions
    if (window.screen.width === 0 || window.screen.height === 0) {
        reasons.push('no_screen');
    }

    // 7. Check for missing languages
    if (!navigator.languages || navigator.languages.length === 0) {
        reasons.push('no_languages');
    }

    // Threshold: 2+ suspicious signals = likely bot
    return {
        isBot: reasons.length >= 2,
        reasons
    };
}

const BotBlocker: React.FC<BotBlockerProps> = ({ children }) => {
    const [detection, setDetection] = useState<{ isBot: boolean; reasons: string[] }>({ isBot: false, reasons: [] });
    const [dismissed, setDismissed] = useState(false);

    useEffect(() => {
        // Délai pour éviter les faux positifs lors du chargement
        const timer = setTimeout(() => {
            const result = detectBot();
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
