/**
 * LEXENEGAL - Rate Limit Alert Modal
 * 
 * Affiche une alerte quand l'utilisateur dépasse la limite de requêtes
 * Design: Blanc Perle & Émeraude
 */

import React, { useEffect, useState } from 'react';
import { Clock, AlertTriangle } from 'lucide-react';
import './BotBlocker.css';

interface RateLimitModalProps {
    isBlocked: boolean;
    resetTime: number | null;
    onDismiss?: () => void;
}

const RateLimitModal: React.FC<RateLimitModalProps> = ({ isBlocked, resetTime, onDismiss }) => {
    const [timeLeft, setTimeLeft] = useState<string>('');

    useEffect(() => {
        if (!isBlocked || !resetTime) return;

        const updateTimer = () => {
            const now = Date.now();
            const diff = Math.max(0, resetTime - now);
            const minutes = Math.floor(diff / 60000);
            const seconds = Math.floor((diff % 60000) / 1000);
            setTimeLeft(`${minutes}:${seconds.toString().padStart(2, '0')}`);
        };

        updateTimer();
        const interval = setInterval(updateTimer, 1000);

        return () => clearInterval(interval);
    }, [isBlocked, resetTime]);

    if (!isBlocked) return null;

    return (
        <div className="rate-limit-modal">
            <div className="rate-limit-modal__overlay" onClick={onDismiss} />
            <div className="rate-limit-modal__content">
                <div className="rate-limit-modal__icon">
                    <AlertTriangle size={28} />
                </div>
                <h3>Limite de requêtes atteinte</h3>
                <p>
                    Trop de requêtes détectées. Pour protéger le Corpus National,
                    veuillez patienter avant de continuer.
                </p>
                <div className="rate-limit-modal__timer">
                    <Clock size={18} style={{ display: 'inline', marginRight: '8px', verticalAlign: 'middle' }} />
                    {timeLeft}
                </div>
                <p style={{ fontSize: '0.8rem', color: '#9CA3AF' }}>
                    Limite : 50 requêtes par minute
                </p>
                {onDismiss && (
                    <button className="rate-limit-modal__btn" onClick={onDismiss}>
                        J'ai compris
                    </button>
                )}
            </div>
        </div>
    );
};

export default RateLimitModal;
