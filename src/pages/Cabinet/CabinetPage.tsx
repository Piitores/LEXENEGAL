import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    FolderPlus, Star, Search, Bell, BellOff,
    FileText, ChevronRight, Plus, ArrowLeft,
    Loader2, AlertCircle
} from 'lucide-react';
import { createClient } from '@supabase/supabase-js';
import ConversionModal from '../../components/ConversionModal/ConversionModal';
import './CabinetPage.css';

// Supabase
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

interface Folder {
    id: string;
    name: string;
    description: string | null;
    color: string;
    decision_count?: number;
}

interface Favorite {
    id: string;
    decision_id: string;
    created_at: string;
    decision?: {
        reference: string;
        slug: string;
        chambre: string;
        date_decision: string;
    };
}

interface SavedSearch {
    id: string;
    name: string;
    query_params: any;
    alert_enabled: boolean;
}

interface Annotation {
    id: string;
    decision_id: string;
    section_type: string;
    content: string;
    updated_at: string;
    decision?: {
        reference: string;
        slug: string;
    };
}

const CabinetPage: React.FC = () => {
    const navigate = useNavigate();

    // States
    const [loading, setLoading] = useState(true);
    const [isPro, setIsPro] = useState(false);
    const [userName, setUserName] = useState('');
    const [showConversionModal, setShowConversionModal] = useState(false);

    const [folders, setFolders] = useState<Folder[]>([]);
    const [favorites, setFavorites] = useState<Favorite[]>([]);
    const [savedSearches, setSavedSearches] = useState<SavedSearch[]>([]);
    const [annotations, setAnnotations] = useState<Annotation[]>([]);

    const [showNewFolderModal, setShowNewFolderModal] = useState(false);
    const [newFolderName, setNewFolderName] = useState('');
    const [newFolderDesc, setNewFolderDesc] = useState('');

    // Check PRO access
    useEffect(() => {
        const checkAccess = async () => {
            try {
                const { data: { session } } = await supabase.auth.getSession();

                if (!session) {
                    navigate('/login');
                    return;
                }

                const { data: profile } = await supabase
                    .from('profiles')
                    .select('subscription_tier, full_name')
                    .eq('id', session.user.id)
                    .single();

                if (profile?.subscription_tier !== 'pro') {
                    navigate('/solliciter-acces');
                    return;
                }

                setIsPro(true);
                setUserName(profile.full_name || 'Partenaire');
                await loadCabinetData(session.user.id);
            } catch (error) {
                console.error('Access check error:', error);
            } finally {
                setLoading(false);
            }
        };

        checkAccess();
    }, [navigate]);

    const loadCabinetData = async (userId: string) => {
        // Load folders with decision count
        const { data: foldersData } = await supabase
            .from('folders')
            .select('*, folder_decisions(count)')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });

        if (foldersData) {
            setFolders(foldersData.map(f => ({
                ...f,
                decision_count: f.folder_decisions?.[0]?.count || 0
            })));
        }

        // Load recent favorites with decision info
        const { data: favoritesData } = await supabase
            .from('favorites')
            .select(`
                id, decision_id, created_at,
                decisions:decision_id (reference, slug, chambre, date_decision)
            `)
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(5);

        if (favoritesData) {
            setFavorites(favoritesData.map(f => ({
                ...f,
                decision: f.decisions as any
            })));
        }

        // Load saved searches
        const { data: searchesData } = await supabase
            .from('saved_searches')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });

        if (searchesData) {
            setSavedSearches(searchesData);
        }

        // Load recent annotations
        const { data: annotationsData } = await supabase
            .from('user_annotations')
            .select(`
                id, decision_id, section_type, content, updated_at,
                decisions:decision_id (reference, slug)
            `)
            .eq('user_id', userId)
            .order('updated_at', { ascending: false })
            .limit(5);

        if (annotationsData) {
            setAnnotations(annotationsData.map(a => ({
                ...a,
                decision: a.decisions as any
            })));
        }
    };

    const createFolder = async () => {
        if (!newFolderName.trim()) return;

        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        const { data, error } = await supabase
            .from('folders')
            .insert({
                user_id: session.user.id,
                name: newFolderName.trim(),
                description: newFolderDesc.trim() || null
            })
            .select()
            .single();

        if (data && !error) {
            setFolders([{ ...data, decision_count: 0 }, ...folders]);
            setShowNewFolderModal(false);
            setNewFolderName('');
            setNewFolderDesc('');
        }
    };

    const toggleAlert = async (searchId: string, currentState: boolean) => {
        const { error } = await supabase
            .from('saved_searches')
            .update({ alert_enabled: !currentState })
            .eq('id', searchId);

        if (!error) {
            setSavedSearches(savedSearches.map(s =>
                s.id === searchId ? { ...s, alert_enabled: !currentState } : s
            ));
        }
    };

    // Loading state
    if (loading) {
        return (
            <div className="cabinet-page cabinet-loading">
                <Loader2 size={32} className="spinner" />
                <p>Chargement de votre cabinet...</p>
            </div>
        );
    }

    // Non-PRO: Show conversion modal fallback (should be caught by useEffect redirect)
    if (!isPro) {
        return null;
    }

    return (
        <div className="cabinet-page">
            <div className="container">
                {/* BACK */}
                <button className="back-btn" onClick={() => navigate('/search')}>
                    <ArrowLeft size={16} /> Retour aux recherches
                </button>

                {/* HEADER */}
                <header className="cabinet-header">
                    <h1>Bienvenue dans votre Cabinet, <span>{userName}</span></h1>
                    <p>Gérez vos dossiers et votre veille juridique en toute sérénité.</p>
                </header>

                {/* BENTO GRID */}
                <div className="cabinet-bento">

                    {/* BLOC 1: MES DOSSIERS (Grand) */}
                    <motion.section
                        className="bento-block bento-folders"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                    >
                        <div className="block-header">
                            <h2><FileText size={20} /> Mes Dossiers</h2>
                            <button
                                className="btn-new-folder"
                                onClick={() => setShowNewFolderModal(true)}
                            >
                                <Plus size={16} /> Nouveau Dossier
                            </button>
                        </div>

                        {folders.length === 0 ? (
                            <div className="empty-state">
                                <FolderPlus size={48} strokeWidth={1} />
                                <p>Créez votre premier dossier pour organiser vos décisions.</p>
                            </div>
                        ) : (
                            <div className="folders-grid">
                                {folders.map(folder => (
                                    <motion.div
                                        key={folder.id}
                                        className="folder-card"
                                        whileHover={{ scale: 1.02, y: -4 }}
                                        onClick={() => navigate(`/cabinet/dossier/${folder.id}`)}
                                    >
                                        <div
                                            className="folder-icon"
                                            style={{ backgroundColor: `${folder.color}15`, color: folder.color }}
                                        >
                                            <FileText size={24} strokeWidth={1.5} />
                                        </div>
                                        <div className="folder-info">
                                            <h3>{folder.name}</h3>
                                            <span>{folder.decision_count} décision{folder.decision_count !== 1 ? 's' : ''}</span>
                                        </div>
                                        <ChevronRight size={18} className="folder-arrow" />
                                    </motion.div>
                                ))}
                            </div>
                        )}
                    </motion.section>

                    {/* BLOC 2: FAVORIS (Moyen) */}
                    <motion.section
                        className="bento-block bento-favorites"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                    >
                        <div className="block-header">
                            <h2><Star size={20} /> Favoris Récents</h2>
                        </div>

                        {favorites.length === 0 ? (
                            <div className="empty-state">
                                <Star size={32} strokeWidth={1} />
                                <p>Aucun favori pour le moment.</p>
                            </div>
                        ) : (
                            <ul className="favorites-list">
                                {favorites.map(fav => (
                                    <li
                                        key={fav.id}
                                        onClick={() => navigate(`/decision/${fav.decision?.slug}`)}
                                    >
                                        <div className="fav-info">
                                            <span className="fav-ref">{fav.decision?.reference}</span>
                                            <span className="fav-chamber">{fav.decision?.chambre}</span>
                                        </div>
                                        <ChevronRight size={16} />
                                    </li>
                                ))}
                            </ul>
                        )}
                    </motion.section>

                    {/* BLOC 3: RECHERCHES SAUVEGARDÉES (Largeur complète) */}
                    <motion.section
                        className="bento-block bento-searches"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3 }}
                    >
                        <div className="block-header">
                            <h2><Search size={20} /> Veille & Recherches Sauvegardées</h2>
                        </div>

                        {savedSearches.length === 0 ? (
                            <div className="empty-state">
                                <Search size={32} strokeWidth={1} />
                                <p>Sauvegardez vos recherches pour les retrouver rapidement.</p>
                            </div>
                        ) : (
                            <table className="searches-table">
                                <thead>
                                    <tr>
                                        <th>Nom de la recherche</th>
                                        <th>Termes</th>
                                        <th>Alerte Email</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {savedSearches.map(search => (
                                        <tr key={search.id}>
                                            <td className="search-name">{search.name}</td>
                                            <td className="search-query">
                                                {search.query_params?.query || '-'}
                                            </td>
                                            <td>
                                                <button
                                                    className={`toggle-alert ${search.alert_enabled ? 'active' : ''}`}
                                                    onClick={() => toggleAlert(search.id, search.alert_enabled)}
                                                >
                                                    {search.alert_enabled ? (
                                                        <><Bell size={14} /> Activée</>
                                                    ) : (
                                                        <><BellOff size={14} /> Désactivée</>
                                                    )}
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </motion.section>

                    {/* BLOC 4: ANNOTATIONS RÉCENTES */}
                    <motion.section
                        className="bento-block bento-annotations"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.4 }}
                    >
                        <div className="block-header">
                            <h2><FileText size={20} /> Dernières Annotations</h2>
                        </div>

                        {annotations.length === 0 ? (
                            <div className="empty-state">
                                <FileText size={32} strokeWidth={1} />
                                <p>Vous n'avez pas encore annoté de décision.</p>
                            </div>
                        ) : (
                            <div className="annotations-list">
                                {annotations.map(ann => (
                                    <div 
                                        key={ann.id} 
                                        className="annotation-card"
                                        onClick={() => navigate(`/decision/${ann.decision?.slug}#${ann.section_type}`)}
                                    >
                                        <div className="annotation-header">
                                            <span className="annotation-ref">{ann.decision?.reference}</span>
                                            <span className={`annotation-badge badge-${ann.section_type}`}>
                                                {ann.section_type.charAt(0).toUpperCase() + ann.section_type.slice(1)}
                                            </span>
                                        </div>
                                        <p className="annotation-content">
                                            {ann.content.length > 80 ? `${ann.content.substring(0, 80)}...` : ann.content}
                                        </p>
                                        <span className="annotation-date">
                                            {new Date(ann.updated_at).toLocaleDateString('fr-FR')}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </motion.section>
                </div>

                {/* NEW FOLDER MODAL */}
                <AnimatePresence>
                    {showNewFolderModal && (
                        <>
                            <motion.div
                                className="modal-backdrop"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                onClick={() => setShowNewFolderModal(false)}
                            />
                            <motion.div
                                className="new-folder-modal"
                                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            >
                                <h3>Nouveau Dossier</h3>
                                <input
                                    type="text"
                                    placeholder="Nom du dossier (ex: Affaire SOW)"
                                    value={newFolderName}
                                    onChange={(e) => setNewFolderName(e.target.value)}
                                    autoFocus
                                />
                                <textarea
                                    placeholder="Description (optionnel)"
                                    value={newFolderDesc}
                                    onChange={(e) => setNewFolderDesc(e.target.value)}
                                    rows={3}
                                />
                                <div className="modal-actions">
                                    <button
                                        className="btn-cancel"
                                        onClick={() => setShowNewFolderModal(false)}
                                    >
                                        Annuler
                                    </button>
                                    <button
                                        className="btn-create"
                                        onClick={createFolder}
                                        disabled={!newFolderName.trim()}
                                    >
                                        Créer le dossier
                                    </button>
                                </div>
                            </motion.div>
                        </>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
};

export default CabinetPage;
