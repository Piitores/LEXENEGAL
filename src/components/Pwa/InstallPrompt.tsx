import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLocation } from 'react-router-dom';
import { Download, Share, SquarePlus, X } from 'lucide-react';
import { isStandalone } from '../../lib/pwa';
import './Pwa.css';

const DISMISS_KEY = 'lexenegal_pwa_dismissed_at';
const VISITS_KEY = 'lexenegal_visits';
const SESSION_KEY = 'lexenegal_visit_counted';
const NUDGE_KEY = 'lexenegal_nudge_dismissed_at'; // posé par AccountNudge

const DISMISS_DAYS = 60;   // un refus d'installation se respecte longtemps
const MIN_VISITS = 2;      // ne rien proposer à un visiteur de passage
const DELAY_MS = 25000;    // laisser d'abord lire

// Mêmes pages neutralisées que pour l'invitation à créer un compte.
const SUPPRESSED = ['/login', '/signup', '/auth', '/admin', '/solliciter-acces', '/cabinet'];

/** Événement Chrome, absent des définitions TypeScript standard. */
interface BeforeInstallPromptEvent extends Event {
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

function readNumber(key: string): number {
    try {
        return Number(localStorage.getItem(key) || 0);
    } catch {
        return 0;
    }
}

/** Compte une visite par session, pour ne solliciter que les visiteurs qui reviennent. */
function countVisit(): number {
    try {
        if (sessionStorage.getItem(SESSION_KEY)) return readNumber(VISITS_KEY);
        sessionStorage.setItem(SESSION_KEY, '1');
        const next = readNumber(VISITS_KEY) + 1;
        localStorage.setItem(VISITS_KEY, String(next));
        return next;
    } catch {
        return 0; // stockage indisponible : on ne propose rien.
    }
}

function isIosSafari(): boolean {
    const ua = navigator.userAgent;
    const iOS = /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
    // Chrome et Firefox sur iOS ne savent pas installer : on ne cible que Safari.
    return iOS && /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua);
}

/**
 * Invitation discrète à installer Lexenegal sur l'écran d'accueil.
 *
 * Deux chemins : Android/Chrome expose `beforeinstallprompt` et installe en un geste ;
 * Safari iOS n'a pas d'API, on y explique le geste manuel « Partager → Sur l'écran
 * d'accueil ».
 *
 * L'invitation ne s'affiche jamais en même temps que celle de création de compte :
 * elle attend que cette dernière ait été traitée (ou que l'utilisateur soit revenu).
 */
const InstallPrompt: React.FC = () => {
    const location = useLocation();
    const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
    const [visible, setVisible] = useState(false);
    const [iosHint, setIosHint] = useState(false);

    useEffect(() => {
        if (isStandalone()) return; // déjà installé

        const dismissedAt = readNumber(DISMISS_KEY);
        if (dismissedAt && Date.now() - dismissedAt < DISMISS_DAYS * 86400000) return;

        if (countVisit() < MIN_VISITS) return;

        // Ne pas empiler deux sollicitations : on attend que l'invitation « créer un
        // compte » ait déjà été vue et fermée au moins une fois.
        if (!readNumber(NUDGE_KEY)) return;

        const onBeforeInstall = (event: Event) => {
            event.preventDefault(); // garder la main sur le moment de l'invitation
            setDeferred(event as BeforeInstallPromptEvent);
            setVisible(true);
        };

        const onInstalled = () => {
            setVisible(false);
            setDeferred(null);
        };

        window.addEventListener('beforeinstallprompt', onBeforeInstall);
        window.addEventListener('appinstalled', onInstalled);

        // Safari iOS : aucun événement, on affiche la marche à suivre après un délai.
        let timer: ReturnType<typeof setTimeout> | undefined;
        if (isIosSafari()) {
            timer = setTimeout(() => {
                setIosHint(true);
                setVisible(true);
            }, DELAY_MS);
        }

        return () => {
            window.removeEventListener('beforeinstallprompt', onBeforeInstall);
            window.removeEventListener('appinstalled', onInstalled);
            if (timer) clearTimeout(timer);
        };
    }, []);

    const dismiss = () => {
        setVisible(false);
        try {
            localStorage.setItem(DISMISS_KEY, String(Date.now()));
        } catch {
            /* stockage indisponible */
        }
    };

    const install = async () => {
        if (!deferred) return;
        setVisible(false);
        await deferred.prompt();
        const { outcome } = await deferred.userChoice;
        setDeferred(null);
        if (outcome === 'dismissed') dismiss();
    };

    if (SUPPRESSED.some((p) => location.pathname.startsWith(p))) return null;

    return (
        <AnimatePresence>
            {visible && (
                <motion.div
                    className="pwa-install"
                    initial={{ opacity: 0, y: 24 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 24 }}
                    transition={{ type: 'spring', damping: 24, stiffness: 280 }}
                    role="dialog"
                    aria-label="Installer Lexenegal sur votre écran d'accueil"
                >
                    <button className="pwa-install__close" onClick={dismiss} aria-label="Fermer">
                        <X size={16} />
                    </button>

                    <span className="pwa-install__icon" aria-hidden="true">
                        <Download size={18} />
                    </span>

                    <div className="pwa-install__body">
                        <strong>Installer Lexenegal</strong>
                        {iosHint ? (
                            <span>
                                Accès direct depuis votre écran d'accueil, et consultation
                                hors connexion des pages déjà ouvertes.
                            </span>
                        ) : (
                            <span>
                                Accès direct depuis votre écran d'accueil, sans passer par le
                                navigateur ni par un magasin d'applications.
                            </span>
                        )}
                    </div>

                    {iosHint ? (
                        <p className="pwa-install__steps">
                            Appuyez sur <Share size={14} aria-label="Partager" /> en bas de l'écran,
                            puis sur <SquarePlus size={14} aria-hidden="true" /> «&nbsp;Sur l'écran
                            d'accueil&nbsp;».
                        </p>
                    ) : (
                        <div className="pwa-install__actions">
                            <button className="pwa-install__cta" onClick={install}>
                                Installer
                            </button>
                            <button className="pwa-install__link" onClick={dismiss}>
                                Plus tard
                            </button>
                        </div>
                    )}
                </motion.div>
            )}
        </AnimatePresence>
    );
};

export default InstallPrompt;
