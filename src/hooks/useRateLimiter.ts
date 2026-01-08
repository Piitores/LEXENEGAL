/**
 * LEXENEGAL - Rate Limiter Hook
 * 
 * Protection anti-scraping côté client
 * Limite: 50 requêtes par minute par session
 */

import { useState, useCallback, useEffect } from 'react';

interface RateLimitState {
    isBlocked: boolean;
    remainingRequests: number;
    resetTime: number | null;
}

interface StoredRequests {
    timestamps: number[];
    blockedUntil: number | null;
}

const STORAGE_KEY = 'lexenegal_rate_limit';
const MAX_REQUESTS = 50;
const TIME_WINDOW_MS = 60 * 1000; // 1 minute
const BLOCK_DURATION_MS = 5 * 60 * 1000; // 5 minutes block if exceeded

/**
 * Hook de rate limiting côté client
 * @returns Fonctions pour vérifier et enregistrer les requêtes
 */
export function useRateLimiter() {
    const [state, setState] = useState<RateLimitState>({
        isBlocked: false,
        remainingRequests: MAX_REQUESTS,
        resetTime: null
    });

    // Charger l'état depuis localStorage
    const loadState = useCallback((): StoredRequests => {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (stored) {
                return JSON.parse(stored);
            }
        } catch (e) {
            console.warn('Rate limiter: failed to load state');
        }
        return { timestamps: [], blockedUntil: null };
    }, []);

    // Sauvegarder l'état
    const saveState = useCallback((data: StoredRequests) => {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        } catch (e) {
            console.warn('Rate limiter: failed to save state');
        }
    }, []);

    // Nettoyer les timestamps expirés
    const cleanTimestamps = useCallback((timestamps: number[]): number[] => {
        const now = Date.now();
        return timestamps.filter(ts => now - ts < TIME_WINDOW_MS);
    }, []);

    // Vérifier si on est bloqué
    const checkBlocked = useCallback(() => {
        const stored = loadState();
        const now = Date.now();

        // Vérifier le blocage temporaire
        if (stored.blockedUntil && now < stored.blockedUntil) {
            setState({
                isBlocked: true,
                remainingRequests: 0,
                resetTime: stored.blockedUntil
            });
            return true;
        }

        // Nettoyer le blocage expiré
        if (stored.blockedUntil && now >= stored.blockedUntil) {
            stored.blockedUntil = null;
            stored.timestamps = [];
            saveState(stored);
        }

        // Calculer les requêtes restantes
        const validTimestamps = cleanTimestamps(stored.timestamps);
        const remaining = MAX_REQUESTS - validTimestamps.length;

        setState({
            isBlocked: remaining <= 0,
            remainingRequests: Math.max(0, remaining),
            resetTime: validTimestamps.length > 0 ? validTimestamps[0] + TIME_WINDOW_MS : null
        });

        return remaining <= 0;
    }, [loadState, saveState, cleanTimestamps]);

    // Enregistrer une requête
    const recordRequest = useCallback((): boolean => {
        const stored = loadState();
        const now = Date.now();

        // Si bloqué, refuser
        if (stored.blockedUntil && now < stored.blockedUntil) {
            return false;
        }

        // Nettoyer et ajouter la nouvelle requête
        const validTimestamps = cleanTimestamps(stored.timestamps);
        validTimestamps.push(now);

        // Vérifier si on dépasse la limite
        if (validTimestamps.length > MAX_REQUESTS) {
            stored.blockedUntil = now + BLOCK_DURATION_MS;
            stored.timestamps = [];
            saveState(stored);

            setState({
                isBlocked: true,
                remainingRequests: 0,
                resetTime: stored.blockedUntil
            });

            return false;
        }

        stored.timestamps = validTimestamps;
        saveState(stored);

        setState({
            isBlocked: false,
            remainingRequests: MAX_REQUESTS - validTimestamps.length,
            resetTime: validTimestamps[0] + TIME_WINDOW_MS
        });

        return true;
    }, [loadState, saveState, cleanTimestamps]);

    // Réinitialiser (pour tests ou admin)
    const reset = useCallback(() => {
        localStorage.removeItem(STORAGE_KEY);
        setState({
            isBlocked: false,
            remainingRequests: MAX_REQUESTS,
            resetTime: null
        });
    }, []);

    // Vérifier l'état au montage
    useEffect(() => {
        checkBlocked();
    }, [checkBlocked]);

    return {
        ...state,
        recordRequest,
        checkBlocked,
        reset
    };
}

export default useRateLimiter;
