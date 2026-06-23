import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Shield, ArrowRight, Loader2, CheckCircle2, User, Phone, Mail, Briefcase, MessageSquare } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import './AccessRequestPage.css';


const AccessRequestPage: React.FC = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const [error, setError] = useState('');

    const [formData, setFormData] = useState({
        nom: '',
        email: '',
        telephone: '',
        profession: '',
        message: ''
    });

    useEffect(() => {
        // Pré-remplir l'email et le nom si l'utilisateur est connecté
        const loadUser = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (session?.user) {
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('full_name')
                    .eq('id', session.user.id)
                    .single();

                setFormData(prev => ({
                    ...prev,
                    email: session.user.email || '',
                    nom: profile?.full_name || ''
                }));
            }
        };
        loadUser();
    }, []);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const response = await supabase.functions.invoke('send-contact-email', {
                body: {
                    nom: formData.nom,
                    email: formData.email,
                    telephone: formData.telephone,
                    fonction: formData.profession,
                    organisation: formData.profession, // Fallback if organisation is required by the original function
                    message: formData.message || "Demande d'accès Premium LEXENEGAL"
                }
            });

            if (response.error) {
                throw new Error(response.error.message || "Erreur lors de l'envoi");
            }

            setSuccess(true);
        } catch (err: any) {
            setError(err.message || 'Une erreur est survenue. Veuillez réessayer.');
        } finally {
            setLoading(false);
        }
    };

    if (success) {
        return (
            <div className="access-page">
                <div className="access-container">
                    <motion.div 
                        className="access-success"
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                    >
                        <div className="success-icon">
                            <CheckCircle2 size={48} />
                        </div>
                        <h2>Demande envoyée !</h2>
                        <p>
                            Merci pour votre confiance. Notre équipe va examiner votre demande et 
                            activera votre accès privilégié très rapidement.
                        </p>
                        <button className="btn-primary" onClick={() => navigate('/search')}>
                            Retour à la recherche
                        </button>
                    </motion.div>
                </div>
            </div>
        );
    }

    return (
        <div className="access-page">
            <div className="access-container">
                <motion.div 
                    className="access-card"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                >
                    <div className="access-header">
                        <div className="access-icon-wrapper">
                            <Shield size={32} />
                        </div>
                        <h1>Accès Privilégié</h1>
                        <p>
                            Rejoignez l'Arsenal Pro LEXENEGAL. 
                            Remplissez ce formulaire et notre équipe activera votre compte sous 24h.
                        </p>
                    </div>

                    <form className="access-form" onSubmit={handleSubmit}>
                        {error && <div className="form-error">{error}</div>}

                        <div className="form-group">
                            <label>Nom complet *</label>
                            <div className="input-with-icon">
                                <User size={18} />
                                <input 
                                    type="text" 
                                    name="nom"
                                    required 
                                    placeholder="Maître Aminata Fall"
                                    value={formData.nom}
                                    onChange={handleChange}
                                />
                            </div>
                        </div>

                        <div className="form-row">
                            <div className="form-group">
                                <label>Email professionnel *</label>
                                <div className="input-with-icon">
                                    <Mail size={18} />
                                    <input 
                                        type="email" 
                                        name="email"
                                        required 
                                        placeholder="avocat@cabinet.sn"
                                        value={formData.email}
                                        onChange={handleChange}
                                    />
                                </div>
                            </div>

                            <div className="form-group">
                                <label>Téléphone *</label>
                                <div className="input-with-icon">
                                    <Phone size={18} />
                                    <input 
                                        type="tel" 
                                        name="telephone"
                                        required 
                                        placeholder="+221 77 000 00 00"
                                        value={formData.telephone}
                                        onChange={handleChange}
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="form-group">
                            <label>Profession *</label>
                            <div className="input-with-icon">
                                <Briefcase size={18} />
                                <select 
                                    name="profession" 
                                    required
                                    value={formData.profession}
                                    onChange={handleChange}
                                >
                                    <option value="" disabled>Sélectionnez votre profession</option>
                                    <option value="Avocat">Avocat</option>
                                    <option value="Magistrat">Magistrat</option>
                                    <option value="Juriste d'entreprise">Juriste d'entreprise</option>
                                    <option value="Notaire / Huissier">Notaire / Huissier</option>
                                    <option value="Étudiant en Droit">Étudiant en Droit</option>
                                    <option value="Autre">Autre</option>
                                </select>
                            </div>
                        </div>

                        <div className="form-group">
                            <label>Besoin spécifique (Optionnel)</label>
                            <div className="textarea-wrapper">
                                <MessageSquare size={18} className="textarea-icon" />
                                <textarea 
                                    name="message"
                                    placeholder="Avez-vous des attentes particulières ?"
                                    rows={3}
                                    value={formData.message}
                                    onChange={handleChange}
                                />
                            </div>
                        </div>

                        <button 
                            type="submit" 
                            className="btn-submit"
                            disabled={loading}
                        >
                            {loading ? (
                                <><Loader2 size={18} className="spin" /> Envoi en cours...</>
                            ) : (
                                <>Envoyer la demande <ArrowRight size={18} /></>
                            )}
                        </button>
                    </form>
                </motion.div>
            </div>
        </div>
    );
};

export default AccessRequestPage;
