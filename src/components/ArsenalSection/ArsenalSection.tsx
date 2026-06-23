import React, { useState, useRef, useEffect } from 'react';
import {
    Printer, Search, BarChart3, Bell, FileText,
    Send, Loader2, Check, BookOpen
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useTiltEffect } from '../../hooks/useTiltEffect';
import './ArsenalSection.css';


/**
 * TiltCard — Wrapper qui applique l'effet tilt 3D sur n'importe quelle card.
 */
const TiltCard: React.FC<{ className?: string; children: React.ReactNode }> = ({ className, children }) => {
    const tilt = useTiltEffect(6, 1.03);
    return (
        <div
            ref={tilt.ref as React.RefObject<HTMLDivElement>}
            className={className}
            style={tilt.style}
            onMouseMove={tilt.onMouseMove}
            onMouseLeave={tilt.onMouseLeave}
        >
            {children}
        </div>
    );
};

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

const ArsenalSection: React.FC = () => {
    const sectionRef = useRef<HTMLElement>(null);
    const [isVisible, setIsVisible] = useState(false);

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

    useEffect(() => {
        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    setIsVisible(true);
                }
            },
            { threshold: 0.1 }
        );

        if (sectionRef.current) {
            observer.observe(sectionRef.current);
        }

        return () => observer.disconnect();
    }, []);

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
        <section ref={sectionRef} id="arsenal" className={`arsenal-section ${isVisible ? 'visible' : ''}`}>
            <div className="arsenal__container">
                {/* Header */}
                <header className="arsenal__header">
                    <span className="arsenal__badge">L'Arsenal</span>
                    <h2 className="arsenal__title">L'Arsenal du Praticien</h2>
                    <p className="arsenal__subtitle">Les outils qui transforment l'information en avantage stratégique.</p>
                </header>

                {/* Bento Grid */}
                <div className="bento-grid">
                    {/* LARGE BLOCK - PDF Master Edition */}
                    <TiltCard className="bento-card bento-card--large">
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
                    </TiltCard>

                    {/* MEDIUM BLOCK - Recherche Fulgurante */}
                    <TiltCard className="bento-card bento-card--medium">
                        <div className="bento-card__icon">
                            <Search size={28} strokeWidth={1.5} />
                        </div>
                        <h3>Recherche Fulgurante</h3>
                        <p>Accès instantané à l'ensemble du corpus — jurisprudence et articles de loi. Filtres par chambre, matière, date, code.</p>
                        <div className="search-demo">
                            <div className="search-demo__bar">
                                <span>abus de confiance...</span>
                            </div>
                            <div className="search-demo__result">52 décisions</div>
                        </div>
                    </TiltCard>

                    {/* MEDIUM BLOCK - Jurimétrie */}
                    <TiltCard className="bento-card bento-card--medium">
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
                    </TiltCard>

                    {/* SMALL BLOCK - Veille */}
                    <TiltCard className="bento-card bento-card--small">
                        <div className="bento-card__icon">
                            <Bell size={24} strokeWidth={1.5} />
                        </div>
                        <h3>Veille Automatisée</h3>
                        <p>Alertes personnalisées sur vos thématiques.</p>
                    </TiltCard>

                    {/* SMALL BLOCK - Export */}
                    <TiltCard className="bento-card bento-card--small">
                        <div className="bento-card__icon">
                            <FileText size={24} strokeWidth={1.5} />
                        </div>
                        <h3>Export & API</h3>
                        <p>Dossiers PDF prêts à l'emploi, et API sécurisée pour l'intégration dans vos outils internes.</p>
                    </TiltCard>

                    {/* MEDIUM BLOCK - Navigateur de Codes */}
                    <TiltCard className="bento-card bento-card--medium">
                        <div className="bento-card__icon bento-card__icon--gold">
                            <BookOpen size={28} strokeWidth={1.5} />
                        </div>
                        <h3>Navigateur de Codes</h3>
                        <p>Parcourez l'arborescence complète des codes : du Titre jusqu'à l'article, avec les modifications intervenues.</p>
                        <div className="code-tree-demo">
                            <div className="code-tree__node code-tree__node--root">Code du Travail</div>
                            <div className="code-tree__node code-tree__node--title">Titre II — Contrat de travail</div>
                            <div className="code-tree__node code-tree__node--chapter">Chapitre 3 — Rupture</div>
                            <div className="code-tree__node code-tree__node--article">Art. L.52</div>
                        </div>
                    </TiltCard>

                </div>

                {/* CTA - Contact Form */}
                <div id="contact" className="arsenal__cta">
                    <div className="cta__header">
                        <h2>Solliciter un Accès Privilégié</h2>
                        <p>Rejoignez le cercle des praticiens disposant de la mémoire juridique organisée du Sénégal.</p>
                    </div>

                    {sent ? (
                        <div className="cta__success">
                            <div className="cta__success-icon">
                                <Check size={32} />
                            </div>
                            <h3>Demande envoyée avec succès</h3>
                            <p>Notre équipe vous contactera sous 24h pour activer votre accès privilégié.</p>
                        </div>
                    ) : (
                        <form className="cta__form" onSubmit={handleSubmit}>
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

                            <button type="submit" className="cta__submit" disabled={sending}>
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
                </div>
            </div>
        </section>
    );
};

export default ArsenalSection;
