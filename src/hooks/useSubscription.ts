/**
 * useSubscription Hook
 * Gère le statut d'abonnement et les crédits de téléchargement
 */

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';

// Supabase Client (utilise les variables d'environnement Vite)
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Types
export interface UserProfile {
    id: string;
    email: string;
    full_name: string | null;
    subscription_tier: 'free' | 'trial' | 'pro';
    trial_started_at: string | null;
    trial_ends_at: string | null;
}

export interface SubscriptionState {
    isLoading: boolean;
    isAuthenticated: boolean;
    user: UserProfile | null;
    canDownload: boolean;
    downloadsToday: number;
    remainingDownloads: number;
    trialDaysRemaining: number;
    isPro: boolean;
    isTrialActive: boolean;
    isTrialExpired: boolean;
}

const MAX_FREE_DOWNLOADS = 3;

export function useSubscription() {
    const [state, setState] = useState<SubscriptionState>({
        isLoading: true,
        isAuthenticated: false,
        user: null,
        canDownload: false,
        downloadsToday: 0,
        remainingDownloads: 0,
        trialDaysRemaining: 0,
        isPro: false,
        isTrialActive: false,
        isTrialExpired: false
    });

    // Charger le profil utilisateur
    const loadProfile = useCallback(async () => {
        try {
            const { data: { session } } = await supabase.auth.getSession();

            if (!session?.user) {
                setState(prev => ({
                    ...prev,
                    isLoading: false,
                    isAuthenticated: false,
                    canDownload: false
                }));
                return;
            }

            // Récupérer le profil
            const { data: profile, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', session.user.id)
                .single();

            if (error || !profile) {
                console.error('Error loading profile:', error);
                setState(prev => ({ ...prev, isLoading: false }));
                return;
            }

            // Récupérer les téléchargements du jour
            const today = new Date().toISOString().split('T')[0];
            const { data: credits } = await supabase
                .from('download_credits')
                .select('downloads_today')
                .eq('user_id', session.user.id)
                .eq('download_date', today)
                .single();

            const downloadsToday = credits?.downloads_today || 0;

            // Calculer les jours restants
            const trialEnds = profile.trial_ends_at ? new Date(profile.trial_ends_at) : null;
            const now = new Date();
            const trialDaysRemaining = trialEnds
                ? Math.max(0, Math.ceil((trialEnds.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
                : 0;

            // Déterminer les droits
            const isPro = profile.subscription_tier === 'pro';
            const isTrialActive = profile.subscription_tier === 'trial' && trialDaysRemaining > 0;
            const isTrialExpired = profile.subscription_tier === 'trial' && trialDaysRemaining <= 0;

            const canDownload = isPro || (isTrialActive && downloadsToday < MAX_FREE_DOWNLOADS);
            const remainingDownloads = isPro ? Infinity : Math.max(0, MAX_FREE_DOWNLOADS - downloadsToday);

            setState({
                isLoading: false,
                isAuthenticated: true,
                user: profile as UserProfile,
                canDownload,
                downloadsToday,
                remainingDownloads,
                trialDaysRemaining,
                isPro,
                isTrialActive,
                isTrialExpired
            });

        } catch (error) {
            console.error('useSubscription error:', error);
            setState(prev => ({ ...prev, isLoading: false }));
        }
    }, []);

    // Incrémenter le compteur de téléchargements
    const recordDownload = useCallback(async (): Promise<boolean> => {
        if (!state.user) return false;

        try {
            const today = new Date().toISOString().split('T')[0];

            // Upsert: insert ou update
            const { error } = await supabase
                .from('download_credits')
                .upsert({
                    user_id: state.user.id,
                    download_date: today,
                    downloads_today: state.downloadsToday + 1
                }, {
                    onConflict: 'user_id,download_date'
                });

            if (error) {
                console.error('Error recording download:', error);
                return false;
            }

            // Mettre à jour l'état local
            setState(prev => ({
                ...prev,
                downloadsToday: prev.downloadsToday + 1,
                remainingDownloads: Math.max(0, prev.remainingDownloads - 1),
                canDownload: prev.isPro || prev.downloadsToday + 1 < MAX_FREE_DOWNLOADS
            }));

            return true;
        } catch (error) {
            console.error('recordDownload error:', error);
            return false;
        }
    }, [state.user, state.downloadsToday]);

    // Écouter les changements d'authentification
    useEffect(() => {
        loadProfile();

        const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
            loadProfile();
        });

        return () => {
            subscription.unsubscribe();
        };
    }, [loadProfile]);

    return {
        ...state,
        refresh: loadProfile,
        recordDownload,
        supabase  // Exposer le client pour d'autres opérations
    };
}

export default useSubscription;
