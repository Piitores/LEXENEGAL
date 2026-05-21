import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { createClient } from '@supabase/supabase-js';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Loader2, BookOpen, ChevronRight, X, Building, Calendar, FileText } from 'lucide-react';
import './DoctrinePage.css';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

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
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [showAuthModal, setShowAuthModal] = useState(false);

    useEffect(() => {
        checkAuth();
        fetchDoctrines();
    }, []);

    const checkAuth = async () => {
        const { data: { session } } = await supabase.auth.getSession();
        setIsAuthenticated(!!session);
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
            setSelectedDoctrine(doctrine);
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

    const formatDate = (dateStr: string) => {
        if (!dateStr) return 'Date inconnue';
        return new Date(dateStr).toLocaleDateString('fr-FR', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
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
                                className="doctrine-card"
                                onClick={() => handleDoctrineClick(item)}
                            >
                                <div className="doctrine-card__header">
                                    <div className="doctrine-card__meta">
                                        <span className="doctrine-card__date">
                                            <Calendar size={14} />
                                            {formatDate(item.date)}
                                        </span>
                                        <span>•</span>
                                        <span className="doctrine-card__ref">
                                            {item.reference_complete || `Lettre n° ${item.numero}`}
                                        </span>
                                    </div>
                                </div>
                                
                                <div className="doctrine-card__body">
                                    <h3>{item.objet || "Sans objet"}</h3>
                                    <p className="doctrine-card__excerpt">
                                        {item.content_raw.substring(0, 200)}...
                                    </p>
                                </div>

                                <div className="doctrine-card__footer">
                                    <div className="doctrine-card__service">
                                        <Building size={14} />
                                        <span>{item.service_emetteur || "DGID"}</span>
                                    </div>
                                    <div className="doctrine-card__action">
                                        Lire la lettre <ChevronRight size={16} />
                                    </div>
                                </div>
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
