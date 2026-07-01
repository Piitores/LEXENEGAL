import React, { useState, useRef, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { popReturnPath } from '../../lib/authRedirect';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, Lock, User, ArrowRight, Check, Loader2, Wand2, KeyRound } from 'lucide-react';
import './AuthPage.css';


type AuthMode = 'login' | 'register' | 'magic' | 'forgot' | 'verify' | 'success';

// Bouton « Continuer avec Google » — logo officiel.
const GoogleButton: React.FC<{ label: string; onClick: () => void; disabled?: boolean }> = ({ label, onClick, disabled }) => (
    <button type="button" className="auth-btn-google" onClick={onClick} disabled={disabled}>
        <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
        </svg>
        {label}
    </button>
);

const AuthPage: React.FC = () => {
    const location = useLocation();
    const navigate = useNavigate();
    // Le mode initial dépend de la route : /signup → inscription, /login → connexion.
    const [mode, setMode] = useState<AuthMode>(location.pathname === '/signup' ? 'register' : 'login');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [message, setMessage] = useState<string | null>(null);

    // Form fields
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [fullName, setFullName] = useState('');

    const isRegistering = useRef(false);

    // OTP State (code à 6 chiffres envoyé par e-mail)
    const [otp, setOtp] = useState(['', '', '', '', '', '']);
    const otpRefs = useRef<(HTMLInputElement | null)[]>([]);
    const [resendIn, setResendIn] = useState(0); // compte à rebours avant de pouvoir renvoyer

    // Suit la route : /login ↔ /signup (via la navbar) bascule le mode de base,
    // sans écraser un sous-mode en cours (magic/forgot/verify/success).
    useEffect(() => {
        if (mode !== 'login' && mode !== 'register') return;
        setMode(location.pathname === '/signup' ? 'register' : 'login');
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [location.pathname]);

    // Si l'utilisateur est déjà connecté, inutile d'afficher la page de connexion.
    useEffect(() => {
        let active = true;
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (active && session) navigate('/', { replace: true });
        });
        return () => { active = false; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Décrément du compte à rebours de renvoi de code.
    useEffect(() => {
        if (resendIn <= 0) return;
        const t = setTimeout(() => setResendIn((s) => s - 1), 1000);
        return () => clearTimeout(t);
    }, [resendIn]);

    const resetFeedback = () => { setError(null); setMessage(null); };

    // Bascule de mode en nettoyant les messages.
    const goTo = (m: AuthMode) => { setMode(m); resetFeedback(); };

    // ---- Google (connexion ET inscription, même bouton) ----
    const handleGoogle = async () => {
        setLoading(true);
        resetFeedback();
        try {
            const { error } = await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: { redirectTo: `${window.location.origin}/auth/callback` }
            });
            if (error) throw error;
            // Redirection gérée par Google puis /auth/callback.
        } catch (err: any) {
            setError(err.message || 'Connexion Google indisponible pour le moment.');
            setLoading(false);
        }
    };

    // ---- Lien magique (connexion sans mot de passe) ----
    const handleMagicLink = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        resetFeedback();
        try {
            const { error } = await supabase.auth.signInWithOtp({
                email,
                options: { emailRedirectTo: `${window.location.origin}/auth/callback` }
            });
            if (error) throw error;
            setMessage('Lien envoyé. Ouvrez votre boîte mail et cliquez sur « Se connecter à LEXENEGAL ».');
        } catch (err: any) {
            setError(err.message || "Impossible d'envoyer le lien. Réessayez.");
        } finally {
            setLoading(false);
        }
    };

    // ---- Mot de passe oublié (envoi du lien de réinitialisation) ----
    const handleForgot = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        resetFeedback();
        try {
            const { error } = await supabase.auth.resetPasswordForEmail(email, {
                redirectTo: `${window.location.origin}/auth/callback`
            });
            if (error) throw error;
            setMessage('Si un compte existe pour cette adresse, un e-mail de réinitialisation vient de partir.');
        } catch (err: any) {
            setError(err.message || "Impossible d'envoyer l'e-mail. Réessayez.");
        } finally {
            setLoading(false);
        }
    };

    // ---- OTP ----
    const handleOtpChange = (index: number, value: string) => {
        if (!/^\d*$/.test(value)) return;
        const newOtp = [...otp];
        newOtp[index] = value.slice(-1);
        setOtp(newOtp);
        if (value && index < 5) otpRefs.current[index + 1]?.focus();
    };

    const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Backspace' && !otp[index] && index > 0) {
            otpRefs.current[index - 1]?.focus();
        }
    };

    const handleOtpPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
        const digits = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
        if (!digits) return;
        e.preventDefault();
        const arr = ['', '', '', '', '', ''];
        for (let i = 0; i < digits.length; i++) arr[i] = digits[i];
        setOtp(arr);
        otpRefs.current[Math.min(digits.length, 5)]?.focus();
    };

    const handleResend = async () => {
        if (resendIn > 0) return;
        resetFeedback();
        try {
            const { error } = await supabase.auth.resend({ type: 'signup', email });
            if (error) throw error;
            setMessage('Nouveau code envoyé.');
            setResendIn(30);
        } catch (err: any) {
            setError(err.message || "Impossible de renvoyer le code.");
        }
    };

    const handleVerifyOtp = async () => {
        const token = otp.join('');
        if (token.length !== 6) {
            setError('Veuillez saisir les 6 chiffres du code.');
            setMessage(null);
            return;
        }
        setLoading(true);
        setError(null);
        setMessage(null);
        try {
            const { data, error } = await supabase.auth.verifyOtp({ email, token, type: 'signup' });
            if (error) throw error;
            if (data.session) {
                await supabase.from('profiles').update({ email_verified: true }).eq('id', data.session.user.id);
                setMode('success');
                setMessage('Votre compte a été vérifié avec succès !');
                setTimeout(() => navigate(popReturnPath()), 1500);
            }
        } catch (err: any) {
            setError('Code de vérification invalide ou expiré.');
        } finally {
            setLoading(false);
        }
    };

    // ---- Inscription (e-mail + mot de passe) ----
    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        if (isRegistering.current) return;
        isRegistering.current = true;
        setLoading(true);
        setError(null);
        try {
            const { data, error } = await supabase.auth.signUp({
                email,
                password,
                options: { data: { full_name: fullName } }
            });
            if (error) throw error;

            if (data.user) {
                await supabase.from('profiles').update({ full_name: fullName }).eq('id', data.user.id);
            }

            if (data.session) {
                // Confirmation e-mail désactivée : session directe.
                setMode('success');
                setMessage('Bienvenue dans votre mémoire juridique.');
                setTimeout(() => navigate(popReturnPath()), 1000);
            } else {
                setMode('verify');
                setMessage('Saisissez le code de sécurité reçu par e-mail.');
            }
        } catch (err: any) {
            setError(err.message || "Erreur lors de l'inscription");
        } finally {
            setLoading(false);
            isRegistering.current = false;
        }
    };

    // ---- Connexion (e-mail + mot de passe) ----
    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        try {
            const { data, error } = await supabase.auth.signInWithPassword({ email, password });
            if (error) throw error;

            // Blocage des comptes suspendus (levier admin).
            if (data.user) {
                const { data: prof } = await supabase
                    .from('profiles').select('suspended').eq('id', data.user.id).single();
                if (prof?.suspended) {
                    await supabase.auth.signOut();
                    throw new Error("Ce compte a été suspendu. Contactez l'administrateur.");
                }
            }
            navigate(popReturnPath());
        } catch (err: any) {
            setError(err.message || 'Identifiants incorrects');
        } finally {
            setLoading(false);
        }
    };

    const titles: Record<AuthMode, string> = {
        login: 'Accédez à la Mémoire Juridique',
        register: 'Rejoignez LEXENEGAL',
        magic: 'Connexion par e-mail',
        forgot: 'Mot de passe oublié',
        verify: 'Vérification de sécurité',
        success: 'Bienvenue',
    };
    const subtitles: Record<AuthMode, string> = {
        login: 'Connectez-vous pour accéder à vos outils privilégiés',
        register: 'Créez votre accès à la mémoire juridique organisée du Sénégal',
        magic: 'Recevez un lien de connexion sécurisé, sans mot de passe',
        forgot: 'Indiquez votre e-mail : nous vous enverrons un lien pour en choisir un nouveau',
        verify: 'Un code de sécurité a été envoyé à votre adresse e-mail.',
        success: 'Votre accès a été validé avec succès',
    };

    return (
        <div className="auth-page">
            <div className="auth-bg-pattern" />

            <motion.div
                className="auth-card"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
            >
                {/* LOGO */}
                <div className="auth-logo">
                    <img src="/email-logo.png" alt="LEXENEGAL" className="auth-logo-img" />
                </div>

                <h1 className="auth-title">{titles[mode]}</h1>
                <p className="auth-subtitle">{subtitles[mode]}</p>

                {/* ERROR / MESSAGE */}
                <AnimatePresence>
                    {error && (
                        <motion.div className="auth-error" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
                            {error}
                        </motion.div>
                    )}
                    {message && (
                        <motion.div className="auth-success" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
                            <Check size={16} /> {message}
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* LOGIN */}
                {mode === 'login' && (
                    <>
                        <GoogleButton label="Continuer avec Google" onClick={handleGoogle} disabled={loading} />
                        <div className="auth-divider"><span>ou</span></div>
                        <form onSubmit={handleLogin} className="auth-form">
                            <div className="input-group">
                                <Mail size={18} className="input-icon" />
                                <input type="email" placeholder="Adresse email" value={email} onChange={(e) => setEmail(e.target.value)} required />
                            </div>
                            <div className="input-group">
                                <Lock size={18} className="input-icon" />
                                <input type="password" placeholder="Mot de passe" value={password} onChange={(e) => setPassword(e.target.value)} required />
                            </div>
                            <button type="submit" className="auth-btn-primary" disabled={loading}>
                                {loading ? <Loader2 size={20} className="spinner" /> : <>Se connecter <ArrowRight size={18} /></>}
                            </button>
                        </form>
                        <div className="auth-links">
                            <button type="button" className="auth-link" onClick={() => goTo('forgot')}>
                                <KeyRound size={14} /> Mot de passe oublié ?
                            </button>
                            <button type="button" className="auth-link" onClick={() => goTo('magic')}>
                                <Wand2 size={14} /> Recevoir un lien de connexion
                            </button>
                        </div>
                    </>
                )}

                {/* REGISTER */}
                {mode === 'register' && (
                    <>
                        <GoogleButton label="S'inscrire avec Google" onClick={handleGoogle} disabled={loading} />
                        <div className="auth-divider"><span>ou</span></div>
                        <form onSubmit={handleRegister} className="auth-form">
                            <div className="input-group">
                                <User size={18} className="input-icon" />
                                <input type="text" placeholder="Nom complet (ex: Maître Diallo)" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
                            </div>
                            <div className="input-group">
                                <Mail size={18} className="input-icon" />
                                <input type="email" placeholder="Adresse email professionnelle" value={email} onChange={(e) => setEmail(e.target.value)} required />
                            </div>
                            <div className="input-group">
                                <Lock size={18} className="input-icon" />
                                <input type="password" placeholder="Mot de passe (min. 8 caractères)" value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} required />
                            </div>
                            <button type="submit" className="auth-btn-primary" disabled={loading}>
                                {loading ? <Loader2 size={20} className="spinner" /> : <>Créer mon accès <ArrowRight size={18} /></>}
                            </button>
                        </form>
                    </>
                )}

                {/* MAGIC LINK */}
                {mode === 'magic' && (
                    <form onSubmit={handleMagicLink} className="auth-form">
                        <div className="input-group">
                            <Mail size={18} className="input-icon" />
                            <input type="email" placeholder="Adresse email" value={email} onChange={(e) => setEmail(e.target.value)} required />
                        </div>
                        <button type="submit" className="auth-btn-primary" disabled={loading}>
                            {loading ? <Loader2 size={20} className="spinner" /> : <>Recevoir mon lien <ArrowRight size={18} /></>}
                        </button>
                        <button type="button" className="auth-link auth-link--center" onClick={() => goTo('login')}>Retour à la connexion</button>
                    </form>
                )}

                {/* FORGOT PASSWORD */}
                {mode === 'forgot' && (
                    <form onSubmit={handleForgot} className="auth-form">
                        <div className="input-group">
                            <Mail size={18} className="input-icon" />
                            <input type="email" placeholder="Adresse email" value={email} onChange={(e) => setEmail(e.target.value)} required />
                        </div>
                        <button type="submit" className="auth-btn-primary" disabled={loading}>
                            {loading ? <Loader2 size={20} className="spinner" /> : <>Envoyer le lien <ArrowRight size={18} /></>}
                        </button>
                        <button type="button" className="auth-link auth-link--center" onClick={() => goTo('login')}>Retour à la connexion</button>
                    </form>
                )}

                {/* VERIFY OTP */}
                {mode === 'verify' && (
                    <div className="verify-state">
                        <div className="otp-container">
                            {otp.map((digit, index) => (
                                <input
                                    key={index}
                                    ref={el => otpRefs.current[index] = el}
                                    type="text"
                                    inputMode="numeric"
                                    pattern="\d*"
                                    maxLength={1}
                                    className="otp-input"
                                    value={digit}
                                    onChange={e => handleOtpChange(index, e.target.value)}
                                    onKeyDown={e => handleOtpKeyDown(index, e)}
                                    onPaste={handleOtpPaste}
                                    autoFocus={index === 0}
                                />
                            ))}
                        </div>

                        <button
                            className="auth-btn-primary"
                            onClick={handleVerifyOtp}
                            disabled={loading || otp.join('').length !== 6}
                            style={{ marginTop: '1.5rem', width: '100%' }}
                        >
                            {loading ? <Loader2 size={20} className="spinner" /> : 'Valider le code'}
                        </button>

                        <div className="auth-links auth-links--verify">
                            <button type="button" className="auth-link" onClick={handleResend} disabled={resendIn > 0}>
                                {resendIn > 0 ? `Renvoyer le code (${resendIn}s)` : 'Renvoyer le code'}
                            </button>
                            <button type="button" className="auth-link" onClick={() => goTo('login')}>Annuler</button>
                        </div>
                    </div>
                )}

                {/* TOGGLE MODE (uniquement sur les écrans de base) */}
                {(mode === 'login' || mode === 'register') && (
                    <div className="auth-toggle">
                        {mode === 'login' ? (
                            <p>Pas encore inscrit ?{' '}
                                <button onClick={() => goTo('register')}>Créer un compte</button>
                            </p>
                        ) : (
                            <p>Déjà inscrit ?{' '}
                                <button onClick={() => goTo('login')}>Se connecter</button>
                            </p>
                        )}
                    </div>
                )}
            </motion.div>

            <div className="auth-footer">
                LEXENEGAL — L'autorité du droit, l'exigence de la précision.
            </div>
        </div>
    );
};

export default AuthPage;
