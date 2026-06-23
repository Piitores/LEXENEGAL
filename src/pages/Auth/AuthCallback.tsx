import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { Loader2, Check, X } from 'lucide-react';
import './AuthPage.css';


/**
 * AuthCallback - Handles email confirmation callback
 * This page is shown after user clicks the email confirmation link
 */
const AuthCallback: React.FC = () => {
    const navigate = useNavigate();
    const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
    const [message, setMessage] = useState('Sécurisation de votre accès à la Mémoire Juridique...');

    useEffect(() => {
        const hash = window.location.hash;
        
        // Si Supabase a détecté une erreur (ex: PKCE mismatch, token expiré), il le met dans l'URL
        if (hash.includes('error=')) {
            setStatus('error');
            setMessage('Le lien est invalide ou a expiré. Si vous développez en local, assurez-vous de tester sur la même adresse (localhost).');
            return;
        }

        let isMounted = true;

        const checkSession = async (session: any) => {
            if (!isMounted) return;
            if (session) {
                setStatus('success');
                setMessage('Votre email a été vérifié avec succès !');

                try {
                    await supabase.from('profiles').update({
                        email_verified: true
                    }).eq('id', session.user.id);
                } catch (e) {
                    console.log('Update profile error:', e);
                }

                setTimeout(() => {
                    if (isMounted) navigate('/search');
                }, 2000);
            }
        };

        // Écouter le changement d'état (quand Supabase finit d'échanger le token de l'URL)
        const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
            if (event === 'SIGNED_IN' || event === 'PASSWORD_RECOVERY') {
                checkSession(session);
            }
        });

        // Vérification de secours au cas où la session est déjà prête
        supabase.auth.getSession().then(({ data, error }) => {
            if (error) {
                if (isMounted) {
                    setStatus('error');
                    setMessage(error.message);
                }
                return;
            }
            if (data.session) {
                checkSession(data.session);
            } else {
                // On attend quelques secondes avant de déclarer une erreur pour laisser le temps à onAuthStateChange de se déclencher
                setTimeout(() => {
                    if (isMounted && status === 'loading') {
                        setStatus('error');
                        setMessage('La session a expiré. Veuillez vous reconnecter.');
                    }
                }, 3000);
            }
        });

        return () => {
            isMounted = false;
            authListener.subscription.unsubscribe();
        };
    }, [navigate, status]);

    return (
        <div className="auth-page">
            <div className="auth-bg-pattern" />

            <div className="auth-card" style={{ textAlign: 'center' }}>
                {/* LOGO */}
                <div className="auth-logo">
                    <span className="logo-mark">L</span>
                    <span className="logo-text">LEXENEGAL</span>
                </div>

                {/* STATUS ICON */}
                <div className="verify-icon" style={{
                    background: status === 'error'
                        ? 'linear-gradient(135deg, #FEE2E2 0%, #FECACA 100%)'
                        : 'linear-gradient(135deg, #ECFDF5 0%, #D1FAE5 100%)'
                }}>
                    {status === 'loading' && <Loader2 size={32} className="spinner" style={{ color: '#047857' }} />}
                    {status === 'success' && <Check size={32} style={{ color: '#047857' }} />}
                    {status === 'error' && <X size={32} style={{ color: '#DC2626' }} />}
                </div>

                {/* TITLE */}
                <h1 className="auth-title" style={{ fontSize: '1.5rem' }}>
                    {status === 'loading' && 'Vérification en cours'}
                    {status === 'success' && 'Bienvenue dans l\'Arsenal'}
                    {status === 'error' && 'Erreur de vérification'}
                </h1>

                {/* MESSAGE */}
                <p className="auth-subtitle">
                    {message}
                </p>

                {/* ERROR ACTIONS */}
                {status === 'error' && (
                    <button
                        className="auth-btn-primary"
                        onClick={() => navigate('/login')}
                        style={{ marginTop: '1rem' }}
                    >
                        Retour à la connexion
                    </button>
                )}
            </div>

            <div className="auth-footer">
                LEXENEGAL — L'autorité du droit, l'exigence de la précision.
            </div>
        </div>
    );
};

export default AuthCallback;
