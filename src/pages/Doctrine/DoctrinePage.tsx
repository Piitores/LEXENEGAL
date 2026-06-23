import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Loader2, BookOpen, ChevronRight, X, Building, Calendar, FileText } from 'lucide-react';
import './DoctrinePage.css';


interface DoctrineItem {
    id: string;
    numero: string;
    annee: number;
    date: string;
    service_emetteur: string;
    reference_complete: string;
    objet: string;
    content_raw: string;
}

const DoctrinePage: React.FC = () => {
    const navigate = useNavigate();
    const [doctrines, setDoctrines] = useState<DoctrineItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedDoctrine, setSelectedDoctrine] = useState<DoctrineItem | null>(null);
    const [expandedId, setExpandedId] = useState<string | null>(null);
    // En dev local on débloque la consultation (import.meta.env.DEV = false en prod).
    const [isAuthenticated, setIsAuthenticated] = useState(import.meta.env.DEV);
    const [showAuthModal, setShowAuthModal] = useState(false);

    useEffect(() => {
        checkAuth();
        fetchDoctrines();
    }, []);

    const checkAuth = async () => {
        const { data: { session } } = await supabase.auth.getSession();
        setIsAuthenticated(!!session || import.meta.env.DEV);
    };

    const fetchDoctrines = async () => {
        try {
            const { data, error } = await supabase
                .from('doctrine')
                .select('*')
                .order('annee', { ascending: false })
                .order('date', { ascending: false });

            if (error) throw error;
            setDoctrines(data || []);
        } catch (error) {
            console.error('Error fetching doctrines:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleDoctrineClick = (doctrine: DoctrineItem) => {
        if (!isAuthenticated) {
            setShowAuthModal(true);
        } else {
            // Accordéon : on déplie/replie la doctrine sous sa carte (repliée par défaut).
            setExpandedId((prev) => (prev === doctrine.id ? null : doctrine.id));
        }
    };

    const filteredDoctrines = useMemo(() => {
        if (!searchQuery) return doctrines;
        const query = searchQuery.toLowerCase();
        return doctrines.filter(d => 
            (d.objet && d.objet.toLowerCase().includes(query)) ||
            (d.numero && d.numero.toLowerCase().includes(query)) ||
            (d.reference_complete && d.reference_complete.toLowerCase().includes(query))
        );
    }, [doctrines, searchQuery]);

    // La date est parfois absente du champ `date` mais TOUJOURS présente dans la
    // référence (« … DU 18 SEPTEMBRE 2009 ») → on la récupère là en repli.
    const MOIS_FR: Record<string, number> = {
        janvier: 0, fevrier: 1, 'février': 1, mars: 2, avril: 3, mai: 4, juin: 5,
        juillet: 6, aout: 7, 'août': 7, septembre: 8, octobre: 9, novembre: 10, decembre: 11, 'décembre': 11,
    };
    const formatDate = (dateStr?: string | null, ref?: string | null) => {
        let d = dateStr ? new Date(dateStr) : null;
        if ((!d || isNaN(d.getTime())) && ref) {
            // Date dans la référence, après « le » ou « du ». Les extractions PDF
            // ajoutent des césures (« 200 4 », « novembr e ») → on retire TOUS les
            // espaces dans la zone date puis on découpe jour + mois + année.
            const m = ref.match(/\b(?:le|du)\s+(\d[\s\dA-Za-zÀ-ÿ]{3,40})/i);
            if (m) {
                const compact = m[1].replace(/\s+/g, '');
                const mm = compact.match(/^(\d{1,2})([A-Za-zÀ-ÿ]+?)(\d{4})/);
                if (mm) {
                    const mo = MOIS_FR[mm[2].toLowerCase()];
                    if (mo != null) d = new Date(Number(mm[3]), mo, Number(mm[1]));
                }
            }
        }
        if (!d || isNaN(d.getTime())) return 'Date inconnue';
        return d.toLocaleDateString('fr-FR', { year: 'numeric', month: 'long', day: 'numeric' });
    };

    return (
        <div className="doctrine-page">
            <header className="doctrine-hero">
                <div className="doctrine-hero__container">
                    <div className="doctrine-hero__emblem">
                        <BookOpen size={40} strokeWidth={1.5} />
                    </div>
                    <h1>Doctrine Fiscale</h1>
                    <p>Accédez à l'intégralité des circulaires, notes et lettres de la DGID.</p>

                    <div className="doctrine-search">
                        <Search size={20} />
                        <input
                            type="text"
                            placeholder="Rechercher par objet, référence ou numéro..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                </div>
            </header>

            <section className="doctrine-content">
                {loading ? (
                    <div className="doctrine-loading">
                        <Loader2 size={40} className="spinner" />
                        <p>Chargement de la doctrine fiscale...</p>
                    </div>
                ) : (
                    <div className="doctrine-list">
                        {filteredDoctrines.map((item) => (
                            <div
                                key={item.id}
                                className={`doctrine-card${expandedId === item.id ? ' open' : ''}`}
                            >
                                <div className="doctrine-card__summary" onClick={() => handleDoctrineClick(item)}>
                                    <div className="doctrine-card__header">
                                        <div className="doctrine-card__meta">
                                            <span className="doctrine-card__date">
                                                <Calendar size={14} />
                                                {formatDate(item.date, item.reference_complete)}
                                            </span>
                                            <span>•</span>
                                            <span className="doctrine-card__ref">
                                                {item.reference_complete || `Lettre n° ${item.numero}`}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="doctrine-card__body">
                                        <h3>{item.objet || "Sans objet"}</h3>
                                    </div>

                                    <div className="doctrine-card__footer">
                                        <div className="doctrine-card__service">
                                            <Building size={14} />
                                            <span>{item.service_emetteur || "DGID"}</span>
                                        </div>
                                        <div className="doctrine-card__action">
                                            {expandedId === item.id ? 'Replier' : 'Lire la lettre'}
                                            <ChevronRight size={16} className="doctrine-card__chevron" />
                                        </div>
                                    </div>
                                </div>

                                {expandedId === item.id && (
                                    <div className="doctrine-card__content">
                                        {item.content_raw.split('\n').map((paragraph, idx) => (
                                            paragraph.trim() ? <p key={idx}>{paragraph}</p> : <br key={idx} />
                                        ))}
                                    </div>
                                )}
                            </div>
                        ))}
                        
                        {filteredDoctrines.length === 0 && (
                            <div className="empty-state" style={{ textAlign: 'center', padding: '4rem', color: '#6b7280' }}>
                                <FileText size={48} style={{ margin: '0 auto 1rem', opacity: 0.5 }} />
                                <h3>Aucune doctrine trouvée</h3>
                                <p>Essayez de modifier vos termes de recherche.</p>
                            </div>
                        )}
                    </div>
                )}
            </section>

            {/* Sidebar Lecture Doctrine */}
            <AnimatePresence>
                {selectedDoctrine && (
                    <motion.div 
                        className="doctrine-reader-overlay"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setSelectedDoctrine(null)}
                    >
                        <motion.div 
                            className="doctrine-reader-sidebar"
                            initial={{ x: '100%' }}
                            animate={{ x: 0 }}
                            exit={{ x: '100%' }}
                            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                            onClick={e => e.stopPropagation()}
                        >
                            <div className="doctrine-reader__header">
                                <div className="doctrine-reader__title-area">
                                    <h2>{selectedDoctrine.reference_complete}</h2>
                                    <span>Du {formatDate(selectedDoctrine.date)}</span>
                                </div>
                                <button 
                                    className="doctrine-reader__close"
                                    onClick={() => setSelectedDoctrine(null)}
                                >
                                    <X size={24} />
                                </button>
                            </div>
                            <div className="doctrine-reader__content">
                                <h3 style={{ marginBottom: '1.5rem', fontFamily: 'var(--font-heading)' }}>
                                    Objet : {selectedDoctrine.objet}
                                </h3>
                                {selectedDoctrine.content_raw.split('\n').map((paragraph, idx) => (
                                    paragraph.trim() ? <p key={idx}>{paragraph}</p> : <br key={idx} />
                                ))}
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Auth Modal (Simple Fallback) */}
            <AnimatePresence>
                {showAuthModal && (
                    <motion.div 
                        className="auth-modal-overlay"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        onClick={() => setShowAuthModal(false)}
                    >
                        <motion.div 
                            className="auth-modal-content"
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            style={{ background: 'white', padding: '2rem', borderRadius: '12px', maxWidth: '400px', textAlign: 'center' }}
                            onClick={e => e.stopPropagation()}
                        >
                            <BookOpen size={48} color="#047857" style={{ margin: '0 auto 1rem' }} />
                            <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem', fontFamily: 'var(--font-heading)' }}>Contenu Réservé</h2>
                            <p style={{ color: '#4b5563', marginBottom: '1.5rem', lineHeight: 1.5 }}>
                                La consultation de la doctrine fiscale nécessite d'être connecté à votre compte Lexenegal.
                            </p>
                            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
                                <button 
                                    onClick={() => setShowAuthModal(false)}
                                    style={{ padding: '0.75rem 1.5rem', border: '1px solid #d1d5db', background: 'white', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}
                                >
                                    Fermer
                                </button>
                                <button 
                                    onClick={() => navigate('/login')}
                                    style={{ padding: '0.75rem 1.5rem', border: 'none', background: '#047857', color: 'white', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}
                                >
                                    Se connecter
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default DoctrinePage;
