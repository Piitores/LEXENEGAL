import React, { useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, Lock, User, ArrowRight, Check, Loader2 } from 'lucide-react';
import './AuthPage.css';

// Supabase Client
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

type AuthMode = 'login' | 'register' | 'verify' | 'success';

const AuthPage: React.FC = () => {
    const [mode, setMode] = useState<AuthMode>('login');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [message, setMessage] = useState<string | null>(null);

    // Form fields
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [fullName, setFullName] = useState('');
    const [phone, setPhone] = useState('');

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            const { data, error } = await supabase.auth.signUp({
                email,
                password,
                options: {
                    data: {
                        full_name: fullName,
                        phone: phone
                    },
                    emailRedirectTo: `${window.location.origin}/auth/callback`
                }
            });

            if (error) throw error;

            // Update profile with phone
            if (data.user) {
                await supabase.from('profiles').update({
                    full_name: fullName,
                    phone: phone
                }).eq('id', data.user.id);
            }

            setMode('verify');
            setMessage('Un email de confirmation vous a été envoyé. Pensez à vérifier vos courriels indésirables (spams).');
        } catch (err: any) {
            setError(err.message || 'Erreur lors de l\'inscription');
        } finally {
            setLoading(false);
        }
    };

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            const { data, error } = await supabase.auth.signInWithPassword({
                email,
                password
            });

            if (error) throw error;

            // Redirect to home or decision page
            window.location.href = '/search';
        } catch (err: any) {
            setError(err.message || 'Identifiants incorrects');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="auth-page">
            {/* BACKGROUND PATTERN */}
            <div className="auth-bg-pattern" />

            {/* MAIN CARD */}
            <motion.div
                className="auth-card"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
            >
                {/* LOGO */}
                <div className="auth-logo">
                    <span className="logo-mark">L</span>
                    <span className="logo-text">LEXENEGAL</span>
                </div>

                {/* TITLE */}
                <h1 className="auth-title">
                    {mode === 'login' && 'Accédez à la Mémoire Juridique'}
                    {mode === 'register' && 'Rejoignez l\'Arsenal'}
                    {mode === 'verify' && 'Vérification en cours'}
                    {mode === 'success' && 'Bienvenue'}
                </h1>

                <p className="auth-subtitle">
                    {mode === 'login' && 'Connectez-vous pour accéder à vos outils privilégiés'}
                    {mode === 'register' && 'Créez votre accès à la jurisprudence organisée du Sénégal'}
                    {mode === 'verify' && 'Sécurisation de votre accès à la Mémoire Juridique...'}
                    {mode === 'success' && 'Votre accès a été validé avec succès'}
                </p>

                {/* ERROR / MESSAGE */}
                <AnimatePresence>
                    {error && (
                        <motion.div
                            className="auth-error"
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                        >
                            {error}
                        </motion.div>
                    )}
                    {message && (
                        <motion.div
                            className="auth-success"
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                        >
                            <Check size={16} /> {message}
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* LOGIN FORM */}
                {mode === 'login' && (
                    <form onSubmit={handleLogin} className="auth-form">
                        <div className="input-group">
                            <Mail size={18} className="input-icon" />
                            <input
                                type="email"
                                placeholder="Adresse email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                            />
                        </div>
                        <div className="input-group">
                            <Lock size={18} className="input-icon" />
                            <input
                                type="password"
                                placeholder="Mot de passe"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                            />
                        </div>

                        <button type="submit" className="auth-btn-primary" disabled={loading}>
                            {loading ? (
                                <Loader2 size={20} className="spinner" />
                            ) : (
                                <>Accéder à l'Arsenal <ArrowRight size={18} /></>
                            )}
                        </button>

                        {/* Google OAuth */}
                        <div className="auth-divider">
                            <span>ou</span>
                        </div>
                        <button
                            type="button"
                            className="auth-btn-google"
                            onClick={async () => {
                                await supabase.auth.signInWithOAuth({
                                    provider: 'google',
                                    options: {
                                        redirectTo: `${window.location.origin}/auth/callback`
                                    }
                                });
                            }}
                        >
                            <svg width="18" height="18" viewBox="0 0 24 24">
                                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                            </svg>
                            Continuer avec Google
                        </button>
                    </form>
                )}

                {/* REGISTER FORM */}
                {mode === 'register' && (
                    <form onSubmit={handleRegister} className="auth-form">
                        <div className="input-group">
                            <User size={18} className="input-icon" />
                            <input
                                type="text"
                                placeholder="Nom complet (ex: Maître Diallo)"
                                value={fullName}
                                onChange={(e) => setFullName(e.target.value)}
                                required
                            />
                        </div>
                        <div className="input-group">
                            <Mail size={18} className="input-icon" />
                            <input
                                type="email"
                                placeholder="Adresse email professionnelle"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                            />
                        </div>
                        <div className="input-group">
                            <Lock size={18} className="input-icon" />
                            <input
                                type="password"
                                placeholder="Mot de passe (min. 8 caractères)"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                minLength={8}
                                required
                            />
                        </div>

                        <button type="submit" className="auth-btn-primary" disabled={loading}>
                            {loading ? (
                                <Loader2 size={20} className="spinner" />
                            ) : (
                                <>Créer mon accès <ArrowRight size={18} /></>
                            )}
                        </button>
                    </form>
                )}

                {/* VERIFY STATE */}
                {mode === 'verify' && (
                    <div className="verify-state">
                        <div className="verify-icon">
                            <Mail size={32} />
                        </div>
                        <p>Consultez votre boîte email <strong>(et vos courriels indésirables / spams)</strong> et cliquez sur le lien de confirmation.</p>
                        <button
                            className="auth-btn-secondary"
                            onClick={() => setMode('login')}
                        >
                            Retour à la connexion
                        </button>
                    </div>
                )}

                {/* TOGGLE MODE */}
                {(mode === 'login' || mode === 'register') && (
                    <div className="auth-toggle">
                        {mode === 'login' ? (
                            <p>
                                Pas encore inscrit ?{' '}
                                <button onClick={() => { setMode('register'); setError(null); }}>
                                    Créer un compte
                                </button>
                            </p>
                        ) : (
                            <p>
                                Déjà inscrit ?{' '}
                                <button onClick={() => { setMode('login'); setError(null); }}>
                                    Se connecter
                                </button>
                            </p>
                        )}
                    </div>
                )}
            </motion.div>

            {/* FOOTER */}
            <div className="auth-footer">
                LEXENEGAL — L'autorité du droit, l'exigence de la précision.
            </div>
        </div>
    );
};

export default AuthPage;
