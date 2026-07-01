import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
    ArrowLeft, User, Mail, Phone, Lock, ShieldCheck,
    BadgeCheck, LogOut, Trash2, Loader2, Check, AlertTriangle
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import './AccountSettingsPage.css';

type Feedback = { type: 'ok' | 'err'; text: string } | null;

const AccountSettingsPage: React.FC = () => {
    const navigate = useNavigate();

    const [loading, setLoading] = useState(true);
    const [userId, setUserId] = useState<string>('');
    const [currentEmail, setCurrentEmail] = useState('');
    const [tier, setTier] = useState<string>('free');
    const [createdAt, setCreatedAt] = useState<string | null>(null);

    // Profil
    const [fullName, setFullName] = useState('');
    const [phone, setPhone] = useState('');
    const [savingProfile, setSavingProfile] = useState(false);
    const [profileMsg, setProfileMsg] = useState<Feedback>(null);

    // E-mail
    const [newEmail, setNewEmail] = useState('');
    const [savingEmail, setSavingEmail] = useState(false);
    const [emailMsg, setEmailMsg] = useState<Feedback>(null);

    // Mot de passe
    const [pwd, setPwd] = useState('');
    const [pwd2, setPwd2] = useState('');
    const [savingPwd, setSavingPwd] = useState(false);
    const [pwdMsg, setPwdMsg] = useState<Feedback>(null);

    // Suppression
    const [confirmDelete, setConfirmDelete] = useState(false);
    const [deleteConfirmText, setDeleteConfirmText] = useState('');
    const [deleting, setDeleting] = useState(false);
    const [deleteMsg, setDeleteMsg] = useState<Feedback>(null);

    useEffect(() => {
        const load = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) { navigate('/login'); return; }
            setUserId(session.user.id);
            setCurrentEmail(session.user.email || '');
            const { data: profile } = await supabase
                .from('profiles')
                .select('full_name, phone, subscription_tier, created_at')
                .eq('id', session.user.id)
                .single();
            if (profile) {
                setFullName(profile.full_name || '');
                setPhone(profile.phone || '');
                setTier(profile.subscription_tier || 'free');
                setCreatedAt(profile.created_at || null);
            }
            setLoading(false);
        };
        load();
    }, [navigate]);

    const saveProfile = async (e: React.FormEvent) => {
        e.preventDefault();
        setSavingProfile(true);
        setProfileMsg(null);
        const { error } = await supabase
            .from('profiles')
            .update({ full_name: fullName.trim(), phone: phone.trim() })
            .eq('id', userId);
        setProfileMsg(error
            ? { type: 'err', text: "Échec de l'enregistrement. Réessayez." }
            : { type: 'ok', text: 'Profil enregistré.' });
        setSavingProfile(false);
    };

    const changeEmail = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newEmail.trim()) return;
        setSavingEmail(true);
        setEmailMsg(null);
        const { error } = await supabase.auth.updateUser({ email: newEmail.trim() });
        if (error) {
            setEmailMsg({ type: 'err', text: error.message || "Échec de la modification." });
        } else {
            setEmailMsg({ type: 'ok', text: `Un e-mail de confirmation a été envoyé à ${newEmail.trim()}. La modification sera effective après confirmation.` });
            setNewEmail('');
        }
        setSavingEmail(false);
    };

    const changePassword = async (e: React.FormEvent) => {
        e.preventDefault();
        if (pwd.length < 8) { setPwdMsg({ type: 'err', text: 'Le mot de passe doit contenir au moins 8 caractères.' }); return; }
        if (pwd !== pwd2) { setPwdMsg({ type: 'err', text: 'Les deux mots de passe ne correspondent pas.' }); return; }
        setSavingPwd(true);
        setPwdMsg(null);
        const { error } = await supabase.auth.updateUser({ password: pwd });
        if (error) {
            setPwdMsg({ type: 'err', text: error.message || 'Échec de la modification.' });
        } else {
            setPwdMsg({ type: 'ok', text: 'Mot de passe mis à jour.' });
            setPwd(''); setPwd2('');
        }
        setSavingPwd(false);
    };

    const deleteAccount = async () => {
        if (deleteConfirmText.trim().toUpperCase() !== 'SUPPRIMER') return;
        setDeleting(true);
        setDeleteMsg(null);
        try {
            const { error } = await supabase.functions.invoke('delete-account', { method: 'POST' });
            if (error) throw error;
            // Compte + données effacés : on vide la session locale et on renvoie à l'accueil.
            try { await supabase.auth.signOut({ scope: 'local' }); } catch { /* session déjà invalide */ }
            window.location.assign('/?compte=supprime');
        } catch (err: any) {
            setDeleteMsg({ type: 'err', text: "Échec de la suppression. Réessayez, ou écrivez à contact@lexenegal.sn." });
            setDeleting(false);
        }
    };

    const logout = async () => {
        try { await supabase.auth.signOut({ scope: 'local' }); } catch { /* ignore */ }
        window.location.assign('/');
    };

    const FeedbackLine: React.FC<{ msg: Feedback }> = ({ msg }) =>
        msg ? (
            <p className={`set-feedback set-feedback--${msg.type}`}>
                {msg.type === 'ok' ? <Check size={15} /> : <AlertTriangle size={15} />} {msg.text}
            </p>
        ) : null;

    if (loading) {
        return (
            <div className="settings-page settings-loading">
                <Loader2 size={32} className="spinner" />
                <p>Chargement de vos paramètres…</p>
            </div>
        );
    }

    const isPro = tier === 'pro';

    return (
        <div className="settings-page">
            <div className="container settings-container">
                <button className="back-btn" onClick={() => navigate('/cabinet')}>
                    <ArrowLeft size={16} /> Retour au Cabinet
                </button>

                <header className="settings-header">
                    <h1>Paramètres du compte</h1>
                    <p>Gérez vos informations, votre connexion et votre compte.</p>
                </header>

                {/* PROFIL */}
                <motion.section className="settings-card" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
                    <h2><User size={18} /> Profil</h2>
                    <form onSubmit={saveProfile} className="settings-form">
                        <label className="set-field">
                            <span>Nom complet</span>
                            <div className="set-input"><User size={16} /><input type="text" value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Ex : Maître Diallo" /></div>
                        </label>
                        <label className="set-field">
                            <span>Téléphone</span>
                            <div className="set-input"><Phone size={16} /><input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="Ex : +221 77 000 00 00" /></div>
                        </label>
                        <FeedbackLine msg={profileMsg} />
                        <button type="submit" className="set-btn" disabled={savingProfile}>
                            {savingProfile ? <Loader2 size={16} className="spinner" /> : 'Enregistrer'}
                        </button>
                    </form>
                </motion.section>

                {/* CONNEXION & SÉCURITÉ */}
                <motion.section className="settings-card" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
                    <h2><ShieldCheck size={18} /> Connexion & sécurité</h2>

                    <form onSubmit={changeEmail} className="settings-form">
                        <label className="set-field">
                            <span>Adresse e-mail</span>
                            <div className="set-input set-input--readonly"><Mail size={16} /><input type="email" value={currentEmail} readOnly /></div>
                        </label>
                        <label className="set-field">
                            <span>Nouvelle adresse e-mail</span>
                            <div className="set-input"><Mail size={16} /><input type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="nouvelle@adresse.sn" /></div>
                        </label>
                        <FeedbackLine msg={emailMsg} />
                        <button type="submit" className="set-btn set-btn--ghost" disabled={savingEmail || !newEmail.trim()}>
                            {savingEmail ? <Loader2 size={16} className="spinner" /> : "Modifier l'e-mail"}
                        </button>
                    </form>

                    <div className="set-divider" />

                    <form onSubmit={changePassword} className="settings-form">
                        <p className="set-help">Définissez ou modifiez votre mot de passe (utile aussi si vous vous connectez via Google et souhaitez ajouter un mot de passe).</p>
                        <label className="set-field">
                            <span>Nouveau mot de passe</span>
                            <div className="set-input"><Lock size={16} /><input type="password" value={pwd} onChange={e => setPwd(e.target.value)} minLength={8} placeholder="Min. 8 caractères" /></div>
                        </label>
                        <label className="set-field">
                            <span>Confirmez</span>
                            <div className="set-input"><Lock size={16} /><input type="password" value={pwd2} onChange={e => setPwd2(e.target.value)} minLength={8} placeholder="Répétez le mot de passe" /></div>
                        </label>
                        <FeedbackLine msg={pwdMsg} />
                        <button type="submit" className="set-btn set-btn--ghost" disabled={savingPwd || !pwd || !pwd2}>
                            {savingPwd ? <Loader2 size={16} className="spinner" /> : 'Modifier le mot de passe'}
                        </button>
                    </form>
                </motion.section>

                {/* COMPTE (lecture seule) */}
                <motion.section className="settings-card" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
                    <h2><BadgeCheck size={18} /> Compte</h2>
                    <div className="set-readonly-grid">
                        <div><span className="set-label">Statut</span><span className={`set-badge ${isPro ? 'set-badge--pro' : ''}`}>{isPro ? 'PRO' : 'Gratuit'}</span></div>
                        <div><span className="set-label">Membre depuis</span><span>{createdAt ? new Date(createdAt).toLocaleDateString('fr-FR', { year: 'numeric', month: 'long', day: 'numeric' }) : '—'}</span></div>
                    </div>
                </motion.section>

                {/* ZONE SENSIBLE */}
                <motion.section className="settings-card settings-card--danger" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
                    <h2><AlertTriangle size={18} /> Zone sensible</h2>
                    <div className="set-danger-row">
                        <div>
                            <strong>Se déconnecter</strong>
                            <p>Fermer votre session sur cet appareil.</p>
                        </div>
                        <button className="set-btn set-btn--ghost" onClick={logout}><LogOut size={15} /> Déconnexion</button>
                    </div>

                    <div className="set-divider" />

                    <div className="set-danger-row">
                        <div>
                            <strong>Supprimer mon compte</strong>
                            <p>Action <strong>irréversible</strong> : votre compte et toutes vos données (favoris, dossiers, annotations, recherches sauvegardées) seront définitivement effacés.</p>
                        </div>
                        {!confirmDelete && (
                            <button className="set-btn set-btn--danger" onClick={() => setConfirmDelete(true)}><Trash2 size={15} /> Supprimer…</button>
                        )}
                    </div>
                    {confirmDelete && (
                        <div className="set-delete-confirm">
                            <label className="set-field">
                                <span>Pour confirmer, tapez <strong>SUPPRIMER</strong> ci-dessous</span>
                                <div className="set-input"><Trash2 size={16} /><input type="text" value={deleteConfirmText} onChange={e => setDeleteConfirmText(e.target.value)} placeholder="SUPPRIMER" autoFocus /></div>
                            </label>
                            <div className="set-confirm">
                                <button className="set-btn set-btn--danger" onClick={deleteAccount} disabled={deleting || deleteConfirmText.trim().toUpperCase() !== 'SUPPRIMER'}>
                                    {deleting ? <Loader2 size={15} className="spinner" /> : 'Supprimer définitivement mon compte'}
                                </button>
                                <button className="set-btn set-btn--ghost" onClick={() => { setConfirmDelete(false); setDeleteConfirmText(''); }} disabled={deleting}>Annuler</button>
                            </div>
                        </div>
                    )}
                    <FeedbackLine msg={deleteMsg} />
                </motion.section>
            </div>
        </div>
    );
};

export default AccountSettingsPage;
