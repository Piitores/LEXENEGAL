import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Star, FolderPlus, Check, Loader2 } from 'lucide-react';
import './DecisionActions.css';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

interface DecisionActionsProps {
    decisionId: string;
    onNeedUpgrade: () => void;
}

interface Folder {
    id: string;
    name: string;
}

const DecisionActions: React.FC<DecisionActionsProps> = ({ decisionId, onNeedUpgrade }) => {
    const [isPro, setIsPro] = useState(false);
    const [userId, setUserId] = useState<string | null>(null);
    const [isFavorite, setIsFavorite] = useState(false);
    const [loadingFav, setLoadingFav] = useState(false);

    const [folders, setFolders] = useState<Folder[]>([]);
    const [showFolderMenu, setShowFolderMenu] = useState(false);
    const [addingToFolder, setAddingToFolder] = useState<string | null>(null);
    const [addedToFolders, setAddedToFolders] = useState<string[]>([]);

    useEffect(() => {
        checkUserAccess();
    }, [decisionId]);

    const checkUserAccess = async () => {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return;

            setUserId(session.user.id);

            const { data: profile } = await supabase
                .from('profiles')
                .select('subscription_tier, role')
                .eq('id', session.user.id)
                .single();

            const userIsPro = profile?.subscription_tier === 'pro' || profile?.role === 'admin';
            setIsPro(userIsPro);

            if (userIsPro) {
                // Check if already favorite
                const { data: favData } = await supabase
                    .from('favorites')
                    .select('id')
                    .eq('user_id', session.user.id)
                    .eq('decision_id', decisionId)
                    .single();

                setIsFavorite(!!favData);

                // Load user folders
                const { data: foldersData } = await supabase
                    .from('folders')
                    .select('id, name')
                    .eq('user_id', session.user.id)
                    .order('name');

                if (foldersData) setFolders(foldersData);

                // Check which folders already contain this decision
                const { data: existingLinks } = await supabase
                    .from('folder_decisions')
                    .select('folder_id')
                    .eq('decision_id', decisionId);

                if (existingLinks) {
                    setAddedToFolders(existingLinks.map(l => l.folder_id));
                }
            }
        } catch (error) {
            console.error('Access check error:', error);
        }
    };

    const toggleFavorite = async () => {
        if (!isPro) {
            onNeedUpgrade();
            return;
        }
        if (!userId) return;

        setLoadingFav(true);
        try {
            if (isFavorite) {
                await supabase
                    .from('favorites')
                    .delete()
                    .eq('user_id', userId)
                    .eq('decision_id', decisionId);
                setIsFavorite(false);
            } else {
                await supabase
                    .from('favorites')
                    .insert({ user_id: userId, decision_id: decisionId });
                setIsFavorite(true);
            }
        } catch (error) {
            console.error('Favorite toggle error:', error);
        } finally {
            setLoadingFav(false);
        }
    };

    const addToFolder = async (folderId: string) => {
        if (!isPro) {
            onNeedUpgrade();
            return;
        }

        setAddingToFolder(folderId);
        try {
            if (addedToFolders.includes(folderId)) {
                // Remove from folder
                await supabase
                    .from('folder_decisions')
                    .delete()
                    .eq('folder_id', folderId)
                    .eq('decision_id', decisionId);
                setAddedToFolders(prev => prev.filter(id => id !== folderId));
            } else {
                // Add to folder
                await supabase
                    .from('folder_decisions')
                    .insert({ folder_id: folderId, decision_id: decisionId });
                setAddedToFolders(prev => [...prev, folderId]);
            }
        } catch (error) {
            console.error('Folder toggle error:', error);
        } finally {
            setAddingToFolder(null);
        }
    };

    return (
        <div className="decision-actions">
            {/* FAVORITE BUTTON */}
            <button
                className={`action-btn action-favorite ${isFavorite ? 'is-favorite' : ''}`}
                onClick={toggleFavorite}
                disabled={loadingFav}
                title={isFavorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}
            >
                {loadingFav ? (
                    <Loader2 size={16} className="spinner" />
                ) : (
                    <Star size={16} fill={isFavorite ? '#F59E0B' : 'none'} />
                )}
                <span>{isFavorite ? 'Favori' : 'Favoris'}</span>
            </button>

            {/* ADD TO FOLDER */}
            <div className="folder-dropdown">
                <button
                    className="action-btn action-folder"
                    onClick={() => {
                        if (!isPro) {
                            onNeedUpgrade();
                            return;
                        }
                        setShowFolderMenu(!showFolderMenu);
                    }}
                >
                    <FolderPlus size={16} />
                    <span>Dossier</span>
                </button>

                {showFolderMenu && (
                    <div className="folder-menu">
                        {folders.length === 0 ? (
                            <div className="folder-empty">
                                Aucun dossier. <a href="/cabinet">Créer un dossier</a>
                            </div>
                        ) : (
                            <>
                                <div className="folder-menu-title">Ajouter au dossier</div>
                                {folders.map(folder => (
                                    <button
                                        key={folder.id}
                                        className={`folder-option ${addedToFolders.includes(folder.id) ? 'in-folder' : ''}`}
                                        onClick={() => addToFolder(folder.id)}
                                        disabled={addingToFolder === folder.id}
                                    >
                                        {addingToFolder === folder.id ? (
                                            <Loader2 size={14} className="spinner" />
                                        ) : addedToFolders.includes(folder.id) ? (
                                            <Check size={14} />
                                        ) : null}
                                        {folder.name}
                                    </button>
                                ))}
                            </>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default DecisionActions;
