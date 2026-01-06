import React, { useState } from 'react';
import { ArrowLeft, Printer, Search, BarChart3, Bell, FileText, Lock, Send, Loader2, Check } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { createClient } from '@supabase/supabase-js';
import './ProPage.css';

// Supabase Client
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

const FONCTIONS = [
    'Avocat',
    'Magistrat',
    'Juriste d\'entreprise',
    'Notaire',
    'Huissier',
    'Étudiant en droit',
    'Universitaire',
    'Autre'
];

const ProPage: React.FC = () => {
    const navigate = useNavigate();

    // Contact form state
    const [formState, setFormState] = useState({
        nom: '',
        fonction: '',
        organisation: '',
        email: '',
        message: ''
    });
    const [sending, setSending] = useState(false);
    const [sent, setSent] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSending(true);
        setError(null);

        try {
            const { error } = await supabase.functions.invoke('send-contact-email', {
                body: formState
            });

            if (error) throw error;

            setSent(true);
            setFormState({ nom: '', fonction: '', organisation: '', email: '', message: '' });
        } catch (err: any) {
            setError(err.message || 'Erreur lors de l\'envoi');
        } finally {
            setSending(false);
        }
    };

    return (
        <div className="pro-page">
            <div className="container">
                <button className="back-btn" onClick={() => navigate('/')}>
                    <ArrowLeft size={16} /> Retour
                </button>

                {/* HERO */}
                <header className="pro-hero">
                    <span className="pro-badge">L'Arsenal</span>
                    <h1>L'Arsenal du Praticien</h1>
                    <p>Les outils qui transforment l'information en avantage stratégique.</p>
                </header>

                {/* BENTO GRID */}
                <div className="bento-grid">
                    {/* LARGE BLOCK - PDF Master Edition */}
                    <div className="bento-card bento-card--large">
                        <div className="bento-card__icon">
                            <Printer size={32} strokeWidth={1.5} />
                        </div>
                        <h3>PDF Master Edition</h3>
                        <p>Décisions formatées pour l'impression professionnelle, avec composition intégrale, structure claire et filigrane certifié Lexenegal.</p>
                        <div className="bento-card__preview">
                            <div className="pdf-preview">
                                <div className="pdf-preview__header">
                                    <span>LEXENEGAL</span>
                                    <span>Édition Certifiée</span>
                                </div>
                                <div className="pdf-preview__title">Arrêt n° 04</div>
                                <div className="pdf-preview__lines">
                                    <span></span>
                                    <span></span>
                                    <span></span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* MEDIUM BLOCK - Recherche Fulgurante */}
                    <div className="bento-card bento-card--medium">
                        <div className="bento-card__icon">
                            <Search size={28} strokeWidth={1.5} />
                        </div>
                        <h3>Recherche Fulgurante</h3>
                        <p>Accès instantané à l'ensemble du corpus. Filtres par chambre, matière, date.</p>
                        <div className="search-demo">
                            <div className="search-demo__bar">
                                <span>abus de confiance...</span>
                            </div>
                            <div className="search-demo__result">52 décisions</div>
                        </div>
                    </div>

                    {/* MEDIUM BLOCK - Jurimétrie */}
                    <div className="bento-card bento-card--medium">
                        <div className="bento-card__icon bento-card__icon--gold">
                            <BarChart3 size={28} strokeWidth={1.5} />
                        </div>
                        <h3>Jurimétrie</h3>
                        <p>Analysez les tendances par chambre, matière et période. Anticipez l'aléa judiciaire.</p>
                        <div className="chart-demo">
                            <div className="chart-bar" style={{ height: '40%' }}></div>
                            <div className="chart-bar" style={{ height: '60%' }}></div>
                            <div className="chart-bar" style={{ height: '80%' }}></div>
                            <div className="chart-bar chart-bar--highlight" style={{ height: '100%' }}></div>
                            <div className="chart-bar" style={{ height: '70%' }}></div>
                        </div>
                    </div>

                    {/* SMALL BLOCK - Veille */}
                    <div className="bento-card bento-card--small">
                        <div className="bento-card__icon">
                            <Bell size={24} strokeWidth={1.5} />
                        </div>
                        <h3>Veille Automatisée</h3>
                        <p>Alertes personnalisées sur vos thématiques.</p>
                    </div>

                    {/* SMALL BLOCK - Export */}
                    <div className="bento-card bento-card--small">
                        <div className="bento-card__icon">
                            <FileText size={24} strokeWidth={1.5} />
                        </div>
                        <h3>Export Dossiers</h3>
                        <p>Dossiers de jurisprudence en PDF.</p>
                    </div>

                    {/* SMALL BLOCK - API */}
                    <div className="bento-card bento-card--small">
                        <div className="bento-card__icon">
                            <Lock size={24} strokeWidth={1.5} />
                        </div>
                        <h3>API Sécurisée</h3>
                        <p>Intégration dans vos outils internes.</p>
                    </div>
                </div>

                {/* CONTACT FORM */}
                <section id="contact" className="contact-section">
                    <div className="contact-header">
                        <h2>Solliciter un Accès Privilégié</h2>
                        <p>Rejoignez le cercle des praticiens disposant de la mémoire juridique organisée du Sénégal.</p>
                    </div>

                    {sent ? (
                        <div className="contact-success">
                            <div className="contact-success__icon">
                                <Check size={32} />
                            </div>
                            <h3>Demande envoyée avec succès</h3>
                            <p>Notre équipe vous contactera sous 24h pour activer votre accès privilégié.</p>
                        </div>
                    ) : (
                        <form className="contact-form" onSubmit={handleSubmit}>
                            <div className="form-row">
                                <div className="form-group">
                                    <label htmlFor="nom">Nom complet *</label>
                                    <input
                                        type="text"
                                        id="nom"
                                        value={formState.nom}
                                        onChange={(e) => setFormState({ ...formState, nom: e.target.value })}
                                        placeholder="Maître Diallo"
                                        required
                                    />
                                </div>
                                <div className="form-group">
                                    <label htmlFor="fonction">Fonction *</label>
                                    <select
                                        id="fonction"
                                        value={formState.fonction}
                                        onChange={(e) => setFormState({ ...formState, fonction: e.target.value })}
                                        required
                                    >
                                        <option value="">Sélectionnez...</option>
                                        {FONCTIONS.map(f => (
                                            <option key={f} value={f}>{f}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className="form-row">
                                <div className="form-group">
                                    <label htmlFor="organisation">Organisation</label>
                                    <input
                                        type="text"
                                        id="organisation"
                                        value={formState.organisation}
                                        onChange={(e) => setFormState({ ...formState, organisation: e.target.value })}
                                        placeholder="Cabinet, Tribunal, Entreprise..."
                                    />
                                </div>
                                <div className="form-group">
                                    <label htmlFor="email">Email professionnel *</label>
                                    <input
                                        type="email"
                                        id="email"
                                        value={formState.email}
                                        onChange={(e) => setFormState({ ...formState, email: e.target.value })}
                                        placeholder="contact@cabinet.sn"
                                        required
                                    />
                                </div>
                            </div>

                            <div className="form-group form-group--full">
                                <label htmlFor="message">Message</label>
                                <textarea
                                    id="message"
                                    value={formState.message}
                                    onChange={(e) => setFormState({ ...formState, message: e.target.value })}
                                    placeholder="Décrivez vos besoins ou posez vos questions..."
                                    rows={4}
                                />
                            </div>

                            {error && (
                                <div className="form-error">{error}</div>
                            )}

                            <button type="submit" className="contact-submit" disabled={sending}>
                                {sending ? (
                                    <Loader2 size={20} className="spinner" />
                                ) : (
                                    <>
                                        <Send size={18} />
                                        Envoyer ma demande
                                    </>
                                )}
                            </button>
                        </form>
                    )}
                </section>
            </div>
        </div>
    );
};

export default ProPage;
