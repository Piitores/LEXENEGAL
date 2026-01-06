import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createClient } from '@supabase/supabase-js';
import { Loader2, Check, X } from 'lucide-react';
import './AuthPage.css';

// Supabase Client
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * AuthCallback - Handles email confirmation callback
 * This page is shown after user clicks the email confirmation link
 */
const AuthCallback: React.FC = () => {
    const navigate = useNavigate();
    const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
    const [message, setMessage] = useState('Sécurisation de votre accès à la Mémoire Juridique...');

    useEffect(() => {
        const handleCallback = async () => {
            try {
                // Get the session from URL hash
                const { data, error } = await supabase.auth.getSession();

                if (error) {
                    throw error;
                }

                if (data.session) {
                    // User is authenticated
                    setStatus('success');
                    setMessage('Votre email a été vérifié avec succès !');

                    // Update profile email_verified
                    await supabase.from('profiles').update({
                        email_verified: true
                    }).eq('id', data.session.user.id);

                    // Trigger welcome email (optional - via Edge Function)
                    try {
                        const profile = await supabase
                            .from('profiles')
                            .select('full_name')
                            .eq('id', data.session.user.id)
                            .single();

                        await supabase.functions.invoke('send-welcome-email', {
                            body: {
                                email: data.session.user.email,
                                fullName: profile.data?.full_name || 'Partenaire'
                            }
                        });
                    } catch (emailError) {
                        console.log('Welcome email skipped:', emailError);
                    }

                    // Redirect after 2 seconds
                    setTimeout(() => {
                        navigate('/search');
                    }, 2000);
                } else {
                    setStatus('error');
                    setMessage('La session a expiré. Veuillez vous reconnecter.');
                }
            } catch (err: any) {
                console.error('Callback error:', err);
                setStatus('error');
                setMessage(err.message || 'Une erreur est survenue');
            }
        };

        handleCallback();
    }, [navigate]);

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
