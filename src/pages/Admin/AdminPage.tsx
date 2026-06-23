/**
 * LEXENEGAL - Admin Command Center
 *
 * Tableau de bord admin : statistiques, utilisateurs, signalements
 * d'erreurs (user_reports) et surveillance des téléchargements suspects.
 * Organisé en onglets pour la cohérence (Phase C1).
 */

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import {
    LayoutDashboard, Users, FileText, BookOpen, Shield,
    AlertTriangle, Crown, Loader2, LogOut, History, X, Star,
    Flag, Check, RotateCcw, Trash2, ExternalLink
} from 'lucide-react';
import './AdminPage.css';


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
    subscription_tier?: string;
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

interface UserReport {
    id: string;
    created_at: string;
    url: string | null;
    entity_type: string | null;
    entity_id: string | null;
    description: string;
    status: string;
    user_id: string | null;
}

type Tab = 'dashboard' | 'users' | 'reports' | 'security';

const AdminPage: React.FC = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [authorized, setAuthorized] = useState(false);
    const [activeTab, setActiveTab] = useState<Tab>('dashboard');
    const [stats, setStats] = useState<Stats>({ decisions: 0, articles: 0, users: 0, downloads: 0 });
    const [users, setUsers] = useState<User[]>([]);
    const [suspicious, setSuspicious] = useState<SuspiciousDownload[]>([]);
    const [reports, setReports] = useState<UserReport[]>([]);
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
            if (!session) { navigate('/login'); return; }
            setCurrentUser(session.user);

            const { data: profile } = await supabase
                .from('profiles').select('role').eq('id', session.user.id).single();

            if (profile?.role !== 'admin') { navigate('/'); return; }

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
                .select('id, email, full_name, role, subscription_tier, created_at')
                .order('created_at', { ascending: false })
                .limit(50);
            setUsers(usersData || []);

            const { data: suspiciousData } = await supabase
                .from('suspicious_downloads').select('*');
            setSuspicious(suspiciousData || []);

            const { data: reportsData } = await supabase
                .from('user_reports')
                .select('id, created_at, url, entity_type, entity_id, description, status, user_id')
                .order('created_at', { ascending: false })
                .limit(200);
            setReports(reportsData || []);

        } catch (error) {
            console.error('Dashboard load error:', error);
        } finally {
            setLoading(false);
        }
    };

    const toggleUserTier = async (userId: string, currentTier: string | undefined) => {
        const newTier = currentTier === 'pro' ? 'free' : 'pro';
        const { error } = await supabase.rpc('admin_set_subscription_tier', {
            target: userId, new_tier: newTier,
        });
        if (!error) {
            setUsers(users.map(u => u.id === userId ? { ...u, subscription_tier: newTier } : u));
        }
    };

    const setReportStatus = async (id: string, status: string) => {
        const { error } = await supabase.from('user_reports').update({ status }).eq('id', id);
        if (!error) setReports(rs => rs.map(r => r.id === id ? { ...r, status } : r));
    };

    const deleteReport = async (id: string) => {
        const { error } = await supabase.from('user_reports').delete().eq('id', id);
        if (!error) setReports(rs => rs.filter(r => r.id !== id));
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
        try {
            await supabase.auth.signOut();
        } catch (e) {
            console.warn('signOut error (on force la déconnexion):', e);
        }
        window.location.assign('/');
    };

    const pendingReports = reports.filter(r => r.status === 'pending').length;

    if (loading) {
        return (
            <div className="admin-page admin-loading">
                <Loader2 size={48} className="spinner" />
                <p>Chargement du Command Center...</p>
            </div>
        );
    }

    if (!authorized) return null;

    const TABS: { id: Tab; label: string; icon: React.ReactNode; badge?: number }[] = [
        { id: 'dashboard', label: 'Tableau de bord', icon: <LayoutDashboard size={16} /> },
        { id: 'users', label: 'Utilisateurs', icon: <Users size={16} /> },
        { id: 'reports', label: 'Signalements', icon: <Flag size={16} />, badge: pendingReports },
        { id: 'security', label: 'Sécurité', icon: <Shield size={16} />, badge: suspicious.length || undefined },
    ];

    return (
        <div className="admin-page">
            {/* HEADER */}
            <header className="admin-header">
                <div className="admin-header__left">
                    <Shield size={28} />
                    <h1>Command Center</h1>
                </div>
                <div className="admin-header__right">
                    <span className="admin-user"><Crown size={16} />{currentUser?.email}</span>
                    <button className="admin-logout" onClick={handleLogout}><LogOut size={18} /></button>
                </div>
            </header>

            {/* TABS */}
            <nav className="admin-tabs">
                {TABS.map(t => (
                    <button
                        key={t.id}
                        className={`admin-tab ${activeTab === t.id ? 'admin-tab--active' : ''}`}
                        onClick={() => setActiveTab(t.id)}
                    >
                        {t.icon}
                        {t.label}
                        {t.badge ? <span className="admin-tab__badge">{t.badge}</span> : null}
                    </button>
                ))}
            </nav>

            {/* TABLEAU DE BORD */}
            {activeTab === 'dashboard' && (
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
                    <div className="stat-card stat-card--clickable" onClick={() => setActiveTab('users')}>
                        <div className="stat-icon"><Users size={24} /></div>
                        <div className="stat-value">{stats.users.toLocaleString()}</div>
                        <div className="stat-label">Utilisateurs</div>
                    </div>
                    <div className="stat-card stat-card--clickable" onClick={() => setActiveTab('reports')}>
                        <div className="stat-icon"><Flag size={24} /></div>
                        <div className="stat-value">{pendingReports.toLocaleString()}</div>
                        <div className="stat-label">Signalements en attente</div>
                    </div>
                </section>
            )}

            {/* UTILISATEURS */}
            {activeTab === 'users' && (
                <section className="admin-section">
                    <h2><Users size={20} /> Gestion Utilisateurs</h2>
                    <div className="admin-table-wrapper">
                        <table className="admin-table">
                            <thead>
                                <tr>
                                    <th>Nom</th><th>Email</th><th>Rôle</th><th>Inscription</th><th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {users.length === 0 ? (
                                    <tr><td colSpan={5} className="text-center">Aucun utilisateur inscrit</td></tr>
                                ) : (
                                    users.map(user => (
                                        <tr key={user.id}>
                                            <td>{user.full_name || '-'}</td>
                                            <td>{user.email}</td>
                                            <td>
                                                <span className={`role-badge role-badge--${user.role === 'admin' ? 'admin' : (user.subscription_tier === 'pro' ? 'pro' : 'user')}`}>
                                                    {user.role === 'admin' ? 'ADMIN' : user.subscription_tier === 'pro' ? 'PRO' : 'User'}
                                                </span>
                                            </td>
                                            <td>{new Date(user.created_at).toLocaleDateString('fr-FR')}</td>
                                            <td className="action-buttons">
                                                {user.role !== 'admin' && (
                                                    <button className="btn-action btn-action--pro"
                                                        onClick={() => toggleUserTier(user.id, user.subscription_tier)}
                                                        title={user.subscription_tier === 'pro' ? 'Rétrograder' : 'Passer PRO'}>
                                                        <Star size={14} /> PRO
                                                    </button>
                                                )}
                                                <button className="btn-action btn-action--journal"
                                                    onClick={() => viewUserJournal(user)} title="Voir le journal">
                                                    <History size={14} /> Journal
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </section>
            )}

            {/* SIGNALEMENTS */}
            {activeTab === 'reports' && (
                <section className="admin-section">
                    <h2><Flag size={20} /> Signalements d'erreurs</h2>
                    {reports.length === 0 ? (
                        <p className="admin-empty">Aucun signalement pour le moment.</p>
                    ) : (
                        <div className="admin-reports">
                            {reports.map(r => (
                                <div key={r.id} className={`report-row report-row--${r.status}`}>
                                    <div className="report-row__main">
                                        <div className="report-row__top">
                                            <span className={`report-status report-status--${r.status}`}>
                                                {r.status === 'resolved' ? 'Résolu' : 'En attente'}
                                            </span>
                                            {r.entity_type && <span className="report-type">{r.entity_type}</span>}
                                            <span className="report-date">{new Date(r.created_at).toLocaleString('fr-FR')}</span>
                                        </div>
                                        <p className="report-desc">{r.description}</p>
                                        {r.url && (
                                            <a className="report-url" href={r.url} target="_blank" rel="noreferrer">
                                                <ExternalLink size={12} /> {r.url}
                                            </a>
                                        )}
                                    </div>
                                    <div className="report-row__actions">
                                        {r.status === 'pending' ? (
                                            <button className="btn-action btn-action--pro" onClick={() => setReportStatus(r.id, 'resolved')} title="Marquer résolu">
                                                <Check size={14} /> Résolu
                                            </button>
                                        ) : (
                                            <button className="btn-action btn-action--journal" onClick={() => setReportStatus(r.id, 'pending')} title="Rouvrir">
                                                <RotateCcw size={14} /> Rouvrir
                                            </button>
                                        )}
                                        <button className="btn-action btn-action--danger" onClick={() => deleteReport(r.id)} title="Supprimer">
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </section>
            )}

            {/* SÉCURITÉ */}
            {activeTab === 'security' && (
                <section className="admin-section">
                    <h2><AlertTriangle size={20} /> Téléchargements suspects</h2>
                    {suspicious.length === 0 ? (
                        <p className="admin-empty">Aucune activité suspecte détectée.</p>
                    ) : (
                        <div className="admin-table-wrapper">
                            <table className="admin-table">
                                <thead>
                                    <tr><th>IP Hash</th><th>User ID</th><th>Downloads</th><th>Période</th></tr>
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
                        </div>
                    )}
                </section>
            )}

            {/* JOURNAL MODAL */}
            {showJournal && journalUser && (
                <div className="journal-modal-overlay" onClick={() => setShowJournal(false)}>
                    <div className="journal-modal" onClick={e => e.stopPropagation()}>
                        <button className="journal-close" onClick={() => setShowJournal(false)}><X size={20} /></button>
                        <h3><History size={20} /> Journal de {journalUser.email}</h3>
                        {journalLoading ? (
                            <div className="journal-loading"><Loader2 size={24} className="spinner" /></div>
                        ) : journalEntries.length === 0 ? (
                            <p className="journal-empty">Aucune activité enregistrée</p>
                        ) : (
                            <ul className="journal-list">
                                {journalEntries.map(entry => (
                                    <li key={entry.id}>
                                        <span className={`journal-action journal-action--${entry.action}`}>{entry.action}</span>
                                        <span className="journal-resource">{entry.resource_id || '-'}</span>
                                        <span className="journal-time">{new Date(entry.created_at).toLocaleString('fr-FR')}</span>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                </div>
            )}

            {/* FOOTER */}
            <footer className="admin-footer">Source Certifiée: LEXENEGAL.SN</footer>
        </div>
    );
};

export default AdminPage;
