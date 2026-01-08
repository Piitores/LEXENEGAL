/**
 * LEXENEGAL - Admin Command Center
 * 
 * Dashboard administrateur avec stats, gestion utilisateurs
 * et surveillance des téléchargements suspects
 */

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createClient } from '@supabase/supabase-js';
import {
    BarChart3, Users, FileText, BookOpen, Shield,
    AlertTriangle, Crown, Loader2, LogOut, History, X, Star
} from 'lucide-react';
import './AdminPage.css';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

interface Stats {
    decisions: number;
    articles: number;
    users: number;
    downloads: number;
}

interface User {
    id: string;
    email: string;
    full_name: string;
    role: string;
    created_at: string;
}

interface SuspiciousDownload {
    ip_hash: string;
    user_id: string;
    download_count: number;
    first_download: string;
    last_download: string;
}

interface AuditLogEntry {
    id: string;
    created_at: string;
    action: string;
    resource_id: string;
}

const AdminPage: React.FC = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [authorized, setAuthorized] = useState(false);
    const [stats, setStats] = useState<Stats>({ decisions: 0, articles: 0, users: 0, downloads: 0 });
    const [users, setUsers] = useState<User[]>([]);
    const [suspicious, setSuspicious] = useState<SuspiciousDownload[]>([]);
    const [currentUser, setCurrentUser] = useState<any>(null);

    // Journal modal state
    const [showJournal, setShowJournal] = useState(false);
    const [journalUser, setJournalUser] = useState<User | null>(null);
    const [journalEntries, setJournalEntries] = useState<AuditLogEntry[]>([]);
    const [journalLoading, setJournalLoading] = useState(false);

    useEffect(() => {
        checkAdminAccess();
    }, []);

    const checkAdminAccess = async () => {
        try {
            const { data: { session } } = await supabase.auth.getSession();

            if (!session) {
                navigate('/login');
                return;
            }

            setCurrentUser(session.user);

            const { data: profile } = await supabase
                .from('profiles')
                .select('role')
                .eq('id', session.user.id)
                .single();

            if (profile?.role !== 'admin') {
                navigate('/');
                return;
            }

            setAuthorized(true);
            loadDashboardData();
        } catch (error) {
            console.error('Admin check error:', error);
            navigate('/login');
        }
    };

    const loadDashboardData = async () => {
        setLoading(true);
        try {
            const [decisionsRes, articlesRes, usersRes, downloadsRes] = await Promise.all([
                supabase.from('decisions').select('*', { count: 'exact', head: true }),
                supabase.from('articles').select('*', { count: 'exact', head: true }),
                supabase.from('profiles').select('*', { count: 'exact', head: true }),
                supabase.from('audit_log').select('*', { count: 'exact', head: true }).eq('action', 'download_pdf')
            ]);

            setStats({
                decisions: decisionsRes.count || 0,
                articles: articlesRes.count || 0,
                users: usersRes.count || 0,
                downloads: downloadsRes.count || 0
            });

            const { data: usersData } = await supabase
                .from('profiles')
                .select('id, email, full_name, role, created_at')
                .order('created_at', { ascending: false })
                .limit(50);

            setUsers(usersData || []);

            const { data: suspiciousData } = await supabase
                .from('suspicious_downloads')
                .select('*');

            setSuspicious(suspiciousData || []);

        } catch (error) {
            console.error('Dashboard load error:', error);
        } finally {
            setLoading(false);
        }
    };

    const toggleUserRole = async (userId: string, currentRole: string) => {
        const newRole = currentRole === 'pro' ? 'user' : 'pro';

        const { error } = await supabase
            .from('profiles')
            .update({ role: newRole })
            .eq('id', userId);

        if (!error) {
            setUsers(users.map(u =>
                u.id === userId ? { ...u, role: newRole } : u
            ));
        }
    };

    const viewUserJournal = async (user: User) => {
        setJournalUser(user);
        setShowJournal(true);
        setJournalLoading(true);

        try {
            const { data } = await supabase
                .from('audit_log')
                .select('id, created_at, action, resource_id')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false })
                .limit(10);

            setJournalEntries(data || []);
        } catch (error) {
            console.error('Journal load error:', error);
        } finally {
            setJournalLoading(false);
        }
    };

    const handleLogout = async () => {
        await supabase.auth.signOut();
        navigate('/');
    };

    if (loading) {
        return (
            <div className="admin-page admin-loading">
                <Loader2 size={48} className="spinner" />
                <p>Chargement du Command Center...</p>
            </div>
        );
    }

    if (!authorized) {
        return null;
    }

    return (
        <div className="admin-page">
            {/* HEADER */}
            <header className="admin-header">
                <div className="admin-header__left">
                    <Shield size={28} />
                    <h1>Command Center</h1>
                </div>
                <div className="admin-header__right">
                    <span className="admin-user">
                        <Crown size={16} />
                        {currentUser?.email}
                    </span>
                    <button className="admin-logout" onClick={handleLogout}>
                        <LogOut size={18} />
                    </button>
                </div>
            </header>

            {/* STATS CARDS - Clickable */}
            <section className="admin-stats">
                <div className="stat-card stat-card--primary stat-card--clickable" onClick={() => navigate('/search')}>
                    <div className="stat-icon"><FileText size={24} /></div>
                    <div className="stat-value">{stats.decisions.toLocaleString()}</div>
                    <div className="stat-label">Décisions</div>
                </div>
                <div className="stat-card stat-card--secondary stat-card--clickable" onClick={() => navigate('/codes')}>
                    <div className="stat-icon"><BookOpen size={24} /></div>
                    <div className="stat-value">{stats.articles.toLocaleString()}</div>
                    <div className="stat-label">Articles</div>
                </div>
                <div className="stat-card">
                    <div className="stat-icon"><Users size={24} /></div>
                    <div className="stat-value">{stats.users.toLocaleString()}</div>
                    <div className="stat-label">Utilisateurs</div>
                </div>
                <div className="stat-card">
                    <div className="stat-icon"><BarChart3 size={24} /></div>
                    <div className="stat-value">{stats.downloads.toLocaleString()}</div>
                    <div className="stat-label">Téléchargements</div>
                </div>
            </section>

            {/* SUSPICIOUS DOWNLOADS ALERT */}
            {suspicious.length > 0 && (
                <section className="admin-alert">
                    <div className="alert-header">
                        <AlertTriangle size={20} />
                        <h3>Activité Suspecte Détectée</h3>
                    </div>
                    <table className="admin-table">
                        <thead>
                            <tr>
                                <th>IP Hash</th>
                                <th>User ID</th>
                                <th>Downloads</th>
                                <th>Période</th>
                            </tr>
                        </thead>
                        <tbody>
                            {suspicious.map((s, i) => (
                                <tr key={i}>
                                    <td><code>{s.ip_hash}</code></td>
                                    <td>{s.user_id || 'Anonymous'}</td>
                                    <td className="text-danger">{s.download_count}</td>
                                    <td>{new Date(s.first_download).toLocaleTimeString()}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </section>
            )}

            {/* USERS MANAGEMENT */}
            <section className="admin-section">
                <h2><Users size={20} /> Gestion Utilisateurs</h2>
                <div className="admin-table-wrapper">
                    <table className="admin-table">
                        <thead>
                            <tr>
                                <th>Nom</th>
                                <th>Email</th>
                                <th>Rôle</th>
                                <th>Inscription</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {users.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="text-center">Aucun utilisateur inscrit</td>
                                </tr>
                            ) : (
                                users.map(user => (
                                    <tr key={user.id}>
                                        <td>{user.full_name || '-'}</td>
                                        <td>{user.email}</td>
                                        <td>
                                            <span className={`role-badge role-badge--${user.role || 'user'}`}>
                                                {user.role === 'pro' ? 'PRO' : user.role === 'admin' ? 'ADMIN' : 'User'}
                                            </span>
                                        </td>
                                        <td>{new Date(user.created_at).toLocaleDateString('fr-FR')}</td>
                                        <td className="action-buttons">
                                            {user.role !== 'admin' && (
                                                <button
                                                    className="btn-action btn-action--pro"
                                                    onClick={() => toggleUserRole(user.id, user.role)}
                                                    title={user.role === 'pro' ? 'Rétrograder' : 'Passer PRO'}
                                                >
                                                    <Star size={14} />
                                                    PRO
                                                </button>
                                            )}
                                            <button
                                                className="btn-action btn-action--journal"
                                                onClick={() => viewUserJournal(user)}
                                                title="Voir le journal"
                                            >
                                                <History size={14} />
                                                Journal
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </section>

            {/* JOURNAL MODAL */}
            {showJournal && journalUser && (
                <div className="journal-modal-overlay" onClick={() => setShowJournal(false)}>
                    <div className="journal-modal" onClick={e => e.stopPropagation()}>
                        <button className="journal-close" onClick={() => setShowJournal(false)}>
                            <X size={20} />
                        </button>
                        <h3><History size={20} /> Journal de {journalUser.email}</h3>
                        {journalLoading ? (
                            <div className="journal-loading">
                                <Loader2 size={24} className="spinner" />
                            </div>
                        ) : journalEntries.length === 0 ? (
                            <p className="journal-empty">Aucune activité enregistrée</p>
                        ) : (
                            <ul className="journal-list">
                                {journalEntries.map(entry => (
                                    <li key={entry.id}>
                                        <span className={`journal-action journal-action--${entry.action}`}>
                                            {entry.action}
                                        </span>
                                        <span className="journal-resource">{entry.resource_id || '-'}</span>
                                        <span className="journal-time">
                                            {new Date(entry.created_at).toLocaleString('fr-FR')}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                </div>
            )}

            {/* FOOTER */}
            <footer className="admin-footer">
                Source Certifiée: LEXENEGAL.SN
            </footer>
        </div>
    );
};

export default AdminPage;

