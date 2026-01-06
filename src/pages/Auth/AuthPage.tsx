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
            setMessage('Un email de confirmation vous a été envoyé.');
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
                        <p>Consultez votre boîte email et cliquez sur le lien de confirmation.</p>
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
