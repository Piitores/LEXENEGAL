import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { popReturnPath } from '../../lib/authRedirect';
import { Loader2, Check, X, Lock, ArrowRight } from 'lucide-react';
import './AuthPage.css';


type Status = 'loading' | 'success' | 'error' | 'recovery';

/**
 * AuthCallback — point de retour unique pour :
 *  - la confirmation d'e-mail (inscription)
 *  - la connexion Google (OAuth)
 *  - le lien magique (connexion sans mot de passe)
 *  - la réinitialisation du mot de passe (event PASSWORD_RECOVERY → formulaire dédié)
 */
const AuthCallback: React.FC = () => {
    const navigate = useNavigate();
    const [status, setStatus] = useState<Status>('loading');
    const [message, setMessage] = useState('Sécurisation de votre accès à la Mémoire Juridique...');

    // Champs du formulaire de nouveau mot de passe (mode recovery).
    const [password, setPassword] = useState('');
    const [confirm, setConfirm] = useState('');
    const [saving, setSaving] = useState(false);
    const isRecovery = useRef(false);

    useEffect(() => {
        const hash = window.location.hash;

        // Erreur renvoyée par Supabase dans l'URL (PKCE, token expiré…).
        if (hash.includes('error=')) {
            setStatus('error');
            setMessage('Le lien est invalide ou a expiré. Si vous développez en local, testez sur la même adresse (localhost).');
            return;
        }

        let isMounted = true;

        const onSignedIn = (session: any) => {
            if (!isMounted || isRecovery.current) return;
            if (session) {
                setStatus('success');
                setMessage('Votre accès a été validé avec succès !');
                supabase.from('profiles').update({ email_verified: true }).eq('id', session.user.id).then(() => {});
                setTimeout(() => { if (isMounted) navigate(popReturnPath()); }, 1500);
            }
        };

        const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
            if (event === 'PASSWORD_RECOVERY') {
                isRecovery.current = true;
                if (isMounted) {
                    setStatus('recovery');
                    setMessage('Choisissez un nouveau mot de passe pour votre compte.');
                }
            } else if (event === 'SIGNED_IN') {
                onSignedIn(session);
            }
        });

        // Filet de secours si la session est déjà prête (hors recovery).
        supabase.auth.getSession().then(({ data, error }) => {
            if (error) {
                if (isMounted) { setStatus('error'); setMessage(error.message); }
                return;
            }
            if (data.session && !isRecovery.current) {
                onSignedIn(data.session);
            } else if (!data.session) {
                setTimeout(() => {
                    if (isMounted && status === 'loading') {
                        setStatus('error');
                        setMessage('La session a expiré. Veuillez vous reconnecter.');
                    }
                }, 3000);
            }
        });

        return () => { isMounted = false; authListener.subscription.unsubscribe(); };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [navigate]);

    const handleSetPassword = async (e: React.FormEvent) => {
        e.preventDefault();
        if (password.length < 8) { setMessage('Le mot de passe doit contenir au moins 8 caractères.'); return; }
        if (password !== confirm) { setMessage('Les deux mots de passe ne correspondent pas.'); return; }
        setSaving(true);
        try {
            const { error } = await supabase.auth.updateUser({ password });
            if (error) throw error;
            setStatus('success');
            setMessage('Mot de passe mis à jour. Vous êtes connecté.');
            setTimeout(() => navigate(popReturnPath()), 1500);
        } catch (err: any) {
            setMessage(err.message || 'Impossible de mettre à jour le mot de passe.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="auth-page">
            <div className="auth-bg-pattern" />

            <div className="auth-card" style={{ textAlign: 'center' }}>
                <div className="auth-logo">
                    <img src="/email-logo.png" alt="LEXENEGAL" className="auth-logo-img" />
                </div>

                {status !== 'recovery' && (
                    <div className="verify-icon" style={{
                        background: status === 'error'
                            ? 'linear-gradient(135deg, #FEE2E2 0%, #FECACA 100%)'
                            : 'linear-gradient(135deg, #ECFDF5 0%, #D1FAE5 100%)'
                    }}>
                        {status === 'loading' && <Loader2 size={32} className="spinner" style={{ color: '#047857' }} />}
                        {status === 'success' && <Check size={32} style={{ color: '#047857' }} />}
                        {status === 'error' && <X size={32} style={{ color: '#DC2626' }} />}
                    </div>
                )}

                <h1 className="auth-title" style={{ fontSize: '1.5rem' }}>
                    {status === 'loading' && 'Vérification en cours'}
                    {status === 'success' && 'Bienvenue'}
                    {status === 'error' && 'Erreur de vérification'}
                    {status === 'recovery' && 'Nouveau mot de passe'}
                </h1>

                <p className="auth-subtitle">{message}</p>

                {status === 'recovery' && (
                    <form onSubmit={handleSetPassword} className="auth-form" style={{ textAlign: 'left' }}>
                        <div className="input-group">
                            <Lock size={18} className="input-icon" />
                            <input type="password" placeholder="Nouveau mot de passe (min. 8 caractères)" value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} required />
                        </div>
                        <div className="input-group">
                            <Lock size={18} className="input-icon" />
                            <input type="password" placeholder="Confirmez le mot de passe" value={confirm} onChange={(e) => setConfirm(e.target.value)} minLength={8} required />
                        </div>
                        <button type="submit" className="auth-btn-primary" disabled={saving}>
                            {saving ? <Loader2 size={20} className="spinner" /> : <>Mettre à jour <ArrowRight size={18} /></>}
                        </button>
                    </form>
                )}

                {status === 'error' && (
                    <button className="auth-btn-primary" onClick={() => navigate('/login')} style={{ marginTop: '1rem' }}>
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
