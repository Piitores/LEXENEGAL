/**
 * LEXENEGAL - Admin Command Center
 *
 * Onglets : Tableau de bord (stats) · Utilisateurs (tier/suspension/suppression)
 * · Contenu (publication is_active) · Signalements · Sécurité (audit + suspects)
 * · API (clés de l'API REST publique api.lexenegal.sn).
 * Tout passe par des RPC/Edge Functions gardées par is_admin().
 */

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import {
    LayoutDashboard, Users, FileText, BookOpen, Shield,
    AlertTriangle, Crown, Loader2, LogOut, History, X, Star,
    Flag, Check, RotateCcw, Trash2, ExternalLink, FolderOpen,
    Ban, Eye, EyeOff, KeyRound, Plus, Copy
} from 'lucide-react';
import './AdminPage.css';

interface Stats { decisions: number; articles: number; users: number; downloads: number; }
interface User {
    id: string; email: string; full_name: string; role: string;
    subscription_tier?: string; suspended?: boolean; created_at: string;
}
interface SuspiciousDownload {
    ip_hash: string; user_id: string; download_count: number;
    first_download: string; last_download: string;
}
interface AuditLogEntry { id: string; created_at: string; action: string; resource_id: string; user_id?: string; }
interface UserReport {
    id: string; created_at: string; url: string | null; entity_type: string | null;
    entity_id: string | null; description: string; status: string; user_id: string | null;
}
interface ContentItem { id: string; title: string; slug: string; category: string; is_active: boolean; }
interface DashStats {
    signups_by_month: { month: string; n: number }[];
    top_decisions: { slug: string; views: number }[];
    by_category: { category: string; n: number }[];
}

/** Une clé de l'API REST publique. `key_prefix` sert à la reconnaître : la clé
 *  complète n'est affichée qu'une fois, à la création (seule son empreinte est stockée). */
interface ApiKey {
    id: string; key_prefix: string; client_name: string; contact_email: string | null;
    plan: string; daily_quota: number; daily_quota_semantic: number; is_active: boolean;
    expires_at: string | null; created_at: string; last_used_at: string | null;
    calls_7d: number; calls_today: number;
}

type Tab = 'dashboard' | 'users' | 'content' | 'reports' | 'security' | 'api';

const AdminPage: React.FC = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [authorized, setAuthorized] = useState(false);
    const [activeTab, setActiveTab] = useState<Tab>('dashboard');
    const [stats, setStats] = useState<Stats>({ decisions: 0, articles: 0, users: 0, downloads: 0 });
    const [dash, setDash] = useState<DashStats | null>(null);
    const [users, setUsers] = useState<User[]>([]);
    const [suspicious, setSuspicious] = useState<SuspiciousDownload[]>([]);
    const [reports, setReports] = useState<UserReport[]>([]);
    const [content, setContent] = useState<ContentItem[]>([]);
    const [audit, setAudit] = useState<AuditLogEntry[]>([]);
    const [auditAction, setAuditAction] = useState<string>('all');
    const [currentUser, setCurrentUser] = useState<any>(null);

    const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
    // Clé fraîchement émise, EN CLAIR. Affichée une seule fois puis oubliée :
    // la base ne conserve que son empreinte, elle est donc irrécupérable ensuite.
    const [nouvelleCle, setNouvelleCle] = useState<string | null>(null);
    const [cleCopiee, setCleCopiee] = useState(false);
    const [formCle, setFormCle] = useState({ client_name: '', contact_email: '', plan: 'essai' });
    const [creationEnCours, setCreationEnCours] = useState(false);

    const [showJournal, setShowJournal] = useState(false);
    const [journalUser, setJournalUser] = useState<User | null>(null);
    const [journalEntries, setJournalEntries] = useState<AuditLogEntry[]>([]);
    const [journalLoading, setJournalLoading] = useState(false);

    useEffect(() => { checkAdminAccess(); }, []);

    const checkAdminAccess = async () => {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) { navigate('/login'); return; }
            setCurrentUser(session.user);
            const { data: profile } = await supabase.from('profiles').select('role').eq('id', session.user.id).single();
            if (profile?.role !== 'admin') { navigate('/'); return; }
            setAuthorized(true);
            loadAll();
        } catch (e) { console.error('Admin check error:', e); navigate('/login'); }
    };

    const loadAll = async () => {
        setLoading(true);
        try {
            const [decisionsRes, articlesRes, usersRes, downloadsRes] = await Promise.all([
                supabase.from('decisions').select('*', { count: 'exact', head: true }),
                supabase.from('articles').select('*', { count: 'exact', head: true }),
                supabase.from('profiles').select('*', { count: 'exact', head: true }),
                supabase.from('audit_log').select('*', { count: 'exact', head: true }).eq('action', 'download_pdf'),
            ]);
            setStats({
                decisions: decisionsRes.count || 0, articles: articlesRes.count || 0,
                users: usersRes.count || 0, downloads: downloadsRes.count || 0,
            });

            const { data: usersData } = await supabase
                .from('profiles')
                .select('id, email, full_name, role, subscription_tier, suspended, created_at')
                .order('created_at', { ascending: false }).limit(100);
            setUsers(usersData || []);

            const { data: suspiciousData } = await supabase.from('suspicious_downloads').select('*');
            setSuspicious(suspiciousData || []);

            const { data: reportsData } = await supabase
                .from('user_reports')
                .select('id, created_at, url, entity_type, entity_id, description, status, user_id')
                .order('created_at', { ascending: false }).limit(200);
            setReports(reportsData || []);

            const { data: contentData } = await supabase
                .from('laws_and_codes')
                .select('id, title, slug, category, is_active')
                .order('category').order('title').limit(500);
            setContent(contentData || []);

            const { data: statsData } = await supabase.rpc('admin_dashboard_stats');
            setDash(statsData as DashStats);

            await loadApiKeys();
            await loadAudit('all');
        } catch (e) { console.error('Dashboard load error:', e); }
        finally { setLoading(false); }
    };

    const loadApiKeys = async () => {
        const { data, error } = await supabase.rpc('admin_api_key_list');
        if (error) { console.error('API keys load error:', error); return; }
        setApiKeys((data as ApiKey[]) || []);
    };

    /**
     * Émet une clé. La RPC la génère EN BASE et ne la renvoie qu'ici, une fois :
     * seule son empreinte sha256 est conservée. Si le client la perd, on n'en
     * fabrique pas de copie — on en émet une nouvelle et on révoque l'ancienne.
     */
    const creerApiKey = async () => {
        if (!formCle.client_name.trim()) { window.alert('Le nom du client est obligatoire.'); return; }
        setCreationEnCours(true);
        try {
            const { data, error } = await supabase.rpc('admin_api_key_create', {
                p_client_name: formCle.client_name.trim(),
                p_contact_email: formCle.contact_email.trim() || null,
                p_plan: formCle.plan,
            });
            if (error) { window.alert("Échec de la création : " + error.message); return; }
            setNouvelleCle((data as { api_key: string }).api_key);
            setCleCopiee(false);
            setFormCle({ client_name: '', contact_email: '', plan: 'essai' });
            await loadApiKeys();
        } finally { setCreationEnCours(false); }
    };

    const copierCle = async () => {
        if (!nouvelleCle) return;
        try { await navigator.clipboard.writeText(nouvelleCle); setCleCopiee(true); }
        catch { window.alert('Copie impossible — sélectionnez la clé et copiez-la à la main.'); }
    };

    const basculerApiKey = async (k: ApiKey) => {
        if (k.is_active && !window.confirm(
            `Révoquer la clé de « ${k.client_name} » ? Ses appels seront refusés immédiatement.`
        )) return;
        const { error } = await supabase.rpc('admin_api_key_set_active', { p_id: k.id, p_active: !k.is_active });
        if (error) { window.alert("Échec : " + error.message); return; }
        setApiKeys(ks => ks.map(x => x.id === k.id ? { ...x, is_active: !k.is_active } : x));
    };

    const loadAudit = async (action: string) => {
        let q = supabase.from('audit_log')
            .select('id, created_at, action, resource_id, user_id')
            .order('created_at', { ascending: false }).limit(100);
        if (action !== 'all') q = q.eq('action', action);
        const { data } = await q;
        setAudit(data || []);
    };

    const toggleUserTier = async (userId: string, currentTier: string | undefined) => {
        const newTier = currentTier === 'pro' ? 'free' : 'pro';
        const { error } = await supabase.rpc('admin_set_subscription_tier', { target: userId, new_tier: newTier });
        if (!error) setUsers(users.map(u => u.id === userId ? { ...u, subscription_tier: newTier } : u));
    };

    const toggleSuspend = async (u: User) => {
        const { error } = await supabase.rpc('admin_set_suspended', { target: u.id, val: !u.suspended });
        if (!error) setUsers(users.map(x => x.id === u.id ? { ...x, suspended: !u.suspended } : x));
    };

    const deleteUser = async (u: User) => {
        if (!window.confirm(`Supprimer définitivement le compte ${u.email} ? Cette action est irréversible.`)) return;
        const { error } = await supabase.functions.invoke('admin-delete-user', { body: { user_id: u.id } });
        if (error) { window.alert("Échec de la suppression : " + error.message); return; }
        setUsers(users.filter(x => x.id !== u.id));
    };

    const toggleActive = async (item: ContentItem) => {
        const { error } = await supabase.rpc('admin_toggle_active', {
            p_table: 'laws_and_codes', p_id: item.id, p_active: !item.is_active,
        });
        if (!error) setContent(content.map(c => c.id === item.id ? { ...c, is_active: !item.is_active } : c));
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
        setJournalUser(user); setShowJournal(true); setJournalLoading(true);
        try {
            const { data } = await supabase.from('audit_log')
                .select('id, created_at, action, resource_id')
                .eq('user_id', user.id).order('created_at', { ascending: false }).limit(10);
            setJournalEntries(data || []);
        } catch (e) { console.error('Journal load error:', e); }
        finally { setJournalLoading(false); }
    };

    const handleLogout = async () => {
        try { await supabase.auth.signOut(); } catch (e) { console.warn(e); }
        window.location.assign('/');
    };

    const pendingReports = reports.filter(r => r.status === 'pending').length;
    const drafts = content.filter(c => !c.is_active).length;

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
        { id: 'content', label: 'Contenu', icon: <BookOpen size={16} />, badge: drafts || undefined },
        { id: 'reports', label: 'Signalements', icon: <Flag size={16} />, badge: pendingReports || undefined },
        { id: 'security', label: 'Sécurité', icon: <Shield size={16} />, badge: suspicious.length || undefined },
        { id: 'api', label: 'API', icon: <KeyRound size={16} />, badge: apiKeys.filter(k => k.is_active).length || undefined },
    ];
    const maxSignup = dash ? Math.max(1, ...dash.signups_by_month.map(s => s.n)) : 1;

    return (
        <div className="admin-page">
            <header className="admin-header">
                <div className="admin-header__left"><Shield size={28} /><h1>Command Center</h1></div>
                <div className="admin-header__right">
                    <span className="admin-user"><Crown size={16} />{currentUser?.email}</span>
                    <button className="admin-logout" onClick={handleLogout}><LogOut size={18} /></button>
                </div>
            </header>

            <nav className="admin-tabs">
                {TABS.map(t => (
                    <button key={t.id} className={`admin-tab ${activeTab === t.id ? 'admin-tab--active' : ''}`} onClick={() => setActiveTab(t.id)}>
                        {t.icon}{t.label}{t.badge ? <span className="admin-tab__badge">{t.badge}</span> : null}
                    </button>
                ))}
            </nav>

            {/* TABLEAU DE BORD */}
            {activeTab === 'dashboard' && (
                <>
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

                    {dash && (
                        <div className="admin-dash-grid">
                            <section className="admin-section admin-card">
                                <h2><Users size={18} /> Inscriptions (6 mois)</h2>
                                <div className="bar-chart">
                                    {dash.signups_by_month.length === 0 ? <p className="admin-empty">Aucune donnée.</p> :
                                        dash.signups_by_month.map(s => (
                                            <div key={s.month} className="bar-col">
                                                <div className="bar-col__val">{s.n}</div>
                                                <div className="bar-col__bar" style={{ height: `${(s.n / maxSignup) * 100}%` }} />
                                                <div className="bar-col__label">{s.month.slice(5)}/{s.month.slice(2, 4)}</div>
                                            </div>
                                        ))}
                                </div>
                            </section>

                            <section className="admin-section admin-card">
                                <h2><FileText size={18} /> Décisions les plus consultées (30j)</h2>
                                {dash.top_decisions.length === 0 ? <p className="admin-empty">Aucune consultation enregistrée.</p> : (
                                    <ul className="top-list">
                                        {dash.top_decisions.map((d, i) => (
                                            <li key={i}>
                                                <a href={`/decision/${d.slug}`} target="_blank" rel="noreferrer">{d.slug}</a>
                                                <span className="top-list__n">{d.views}</span>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </section>

                            <section className="admin-section admin-card">
                                <h2><BookOpen size={18} /> Corpus par catégorie</h2>
                                <ul className="top-list">
                                    {dash.by_category.map((c, i) => (
                                        <li key={i}><span>{c.category}</span><span className="top-list__n">{c.n}</span></li>
                                    ))}
                                </ul>
                            </section>
                        </div>
                    )}
                </>
            )}

            {/* UTILISATEURS */}
            {activeTab === 'users' && (
                <section className="admin-section">
                    <h2><Users size={20} /> Gestion Utilisateurs</h2>
                    <div className="admin-table-wrapper">
                        <table className="admin-table">
                            <thead><tr><th>Nom</th><th>Email</th><th>Rôle</th><th>Inscription</th><th>Actions</th></tr></thead>
                            <tbody>
                                {users.length === 0 ? (
                                    <tr><td colSpan={5} className="text-center">Aucun utilisateur inscrit</td></tr>
                                ) : users.map(user => (
                                    <tr key={user.id} className={user.suspended ? 'row-suspended' : ''}>
                                        <td>{user.full_name || '-'}</td>
                                        <td>{user.email}{user.suspended && <span className="susp-tag">suspendu</span>}</td>
                                        <td>
                                            <span className={`role-badge role-badge--${user.role === 'admin' ? 'admin' : (user.subscription_tier === 'pro' ? 'pro' : 'user')}`}>
                                                {user.role === 'admin' ? 'ADMIN' : user.subscription_tier === 'pro' ? 'PRO' : 'User'}
                                            </span>
                                        </td>
                                        <td>{new Date(user.created_at).toLocaleDateString('fr-FR')}</td>
                                        <td className="action-buttons">
                                            {user.role !== 'admin' && (
                                                <>
                                                    <button className="btn-action btn-action--pro" onClick={() => toggleUserTier(user.id, user.subscription_tier)} title={user.subscription_tier === 'pro' ? 'Rétrograder' : 'Passer PRO'}><Star size={14} /> PRO</button>
                                                    <button className="btn-action btn-action--journal" onClick={() => toggleSuspend(user)} title={user.suspended ? 'Réactiver' : 'Suspendre'}><Ban size={14} /> {user.suspended ? 'Réactiver' : 'Suspendre'}</button>
                                                    <button className="btn-action btn-action--danger" onClick={() => deleteUser(user)} title="Supprimer le compte"><Trash2 size={14} /></button>
                                                </>
                                            )}
                                            <button className="btn-action btn-action--journal" onClick={() => viewUserJournal(user)} title="Voir le journal"><History size={14} /> Journal</button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </section>
            )}

            {/* CONTENU */}
            {activeTab === 'content' && (
                <section className="admin-section">
                    <h2><FolderOpen size={20} /> Publication du contenu <span className="admin-hint">({content.length} textes · {drafts} masqués)</span></h2>
                    <div className="admin-table-wrapper">
                        <table className="admin-table">
                            <thead><tr><th>Titre</th><th>Catégorie</th><th>Statut</th><th>Action</th></tr></thead>
                            <tbody>
                                {content.map(item => (
                                    <tr key={item.id} className={item.is_active ? '' : 'row-suspended'}>
                                        <td><a href={`/code/${item.slug}`} target="_blank" rel="noreferrer">{item.title}</a></td>
                                        <td><span className="cat-badge">{item.category}</span></td>
                                        <td>{item.is_active
                                            ? <span className="report-status report-status--resolved">En ligne</span>
                                            : <span className="report-status report-status--pending">Masqué</span>}</td>
                                        <td>
                                            <button className={`btn-action ${item.is_active ? 'btn-action--journal' : 'btn-action--pro'}`} onClick={() => toggleActive(item)} title={item.is_active ? 'Masquer' : 'Publier'}>
                                                {item.is_active ? <><EyeOff size={14} /> Masquer</> : <><Eye size={14} /> Publier</>}
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <p className="admin-note">La gestion des décisions (volume élevé) se fait via la recherche - à venir dans cet onglet.</p>
                </section>
            )}

            {/* SIGNALEMENTS */}
            {activeTab === 'reports' && (
                <section className="admin-section">
                    <h2><Flag size={20} /> Signalements d'erreurs</h2>
                    {reports.length === 0 ? <p className="admin-empty">Aucun signalement pour le moment.</p> : (
                        <div className="admin-reports">
                            {reports.map(r => (
                                <div key={r.id} className={`report-row report-row--${r.status}`}>
                                    <div className="report-row__main">
                                        <div className="report-row__top">
                                            <span className={`report-status report-status--${r.status}`}>{r.status === 'resolved' ? 'Résolu' : 'En attente'}</span>
                                            {r.entity_type && <span className="report-type">{r.entity_type}</span>}
                                            <span className="report-date">{new Date(r.created_at).toLocaleString('fr-FR')}</span>
                                        </div>
                                        <p className="report-desc">{r.description}</p>
                                        {r.url && <a className="report-url" href={r.url} target="_blank" rel="noreferrer"><ExternalLink size={12} /> {r.url}</a>}
                                    </div>
                                    <div className="report-row__actions">
                                        {r.status === 'pending'
                                            ? <button className="btn-action btn-action--pro" onClick={() => setReportStatus(r.id, 'resolved')} title="Marquer résolu"><Check size={14} /> Résolu</button>
                                            : <button className="btn-action btn-action--journal" onClick={() => setReportStatus(r.id, 'pending')} title="Rouvrir"><RotateCcw size={14} /> Rouvrir</button>}
                                        <button className="btn-action btn-action--danger" onClick={() => deleteReport(r.id)} title="Supprimer"><Trash2 size={14} /></button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </section>
            )}

            {/* SÉCURITÉ */}
            {activeTab === 'security' && (
                <>
                    <section className="admin-section">
                        <h2><AlertTriangle size={20} /> Téléchargements suspects</h2>
                        {suspicious.length === 0 ? <p className="admin-empty">Aucune activité suspecte détectée.</p> : (
                            <div className="admin-table-wrapper">
                                <table className="admin-table">
                                    <thead><tr><th>IP Hash</th><th>User ID</th><th>Downloads</th><th>Période</th></tr></thead>
                                    <tbody>
                                        {suspicious.map((s, i) => (
                                            <tr key={i}><td><code>{s.ip_hash}</code></td><td>{s.user_id || 'Anonymous'}</td><td className="text-danger">{s.download_count}</td><td>{new Date(s.first_download).toLocaleTimeString()}</td></tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </section>

                    <section className="admin-section">
                        <h2><History size={20} /> Journal d'audit
                            <select className="admin-filter" value={auditAction} onChange={e => { setAuditAction(e.target.value); loadAudit(e.target.value); }}>
                                <option value="all">Toutes les actions</option>
                                <option value="view_decision">view_decision</option>
                                <option value="download_pdf">download_pdf</option>
                                <option value="search">search</option>
                            </select>
                        </h2>
                        <div className="admin-table-wrapper">
                            <table className="admin-table">
                                <thead><tr><th>Date</th><th>Action</th><th>Ressource</th><th>Utilisateur</th></tr></thead>
                                <tbody>
                                    {audit.length === 0 ? <tr><td colSpan={4} className="text-center">Aucune entrée.</td></tr> :
                                        audit.map(a => (
                                            <tr key={a.id}>
                                                <td>{new Date(a.created_at).toLocaleString('fr-FR')}</td>
                                                <td><span className={`journal-action journal-action--${a.action}`}>{a.action}</span></td>
                                                <td>{a.resource_id || '-'}</td>
                                                <td>{a.user_id ? a.user_id.slice(0, 8) : 'anon'}</td>
                                            </tr>
                                        ))}
                                </tbody>
                            </table>
                        </div>
                    </section>
                </>
            )}

            {/* API — clés de l'API REST publique (api.lexenegal.sn) */}
            {activeTab === 'api' && (
                <>
                    {/* La clé en clair n'existe QU'ICI et QU'UNE FOIS : la base n'en
                        garde que l'empreinte. D'où l'avertissement explicite. */}
                    {nouvelleCle && (
                        <section className="admin-section admin-card api-nouvelle">
                            <h2><KeyRound size={20} /> Nouvelle clé — à copier maintenant</h2>
                            <p className="api-avertissement">
                                Cette clé ne sera <strong>plus jamais affichée</strong>. Transmettez-la au client
                                par un canal sûr. Si elle est perdue, il faudra en émettre une nouvelle et révoquer celle-ci.
                            </p>
                            <div className="api-cle-boite">
                                <code className="api-cle">{nouvelleCle}</code>
                                <button className="btn-action btn-action--pro" onClick={copierCle}>
                                    <Copy size={14} /> {cleCopiee ? 'Copiée' : 'Copier'}
                                </button>
                            </div>
                            <button className="btn-action btn-action--journal" onClick={() => setNouvelleCle(null)}>
                                <Check size={14} /> J'ai noté la clé
                            </button>
                        </section>
                    )}

                    <section className="admin-section admin-card">
                        <h2><Plus size={20} /> Émettre une clé</h2>
                        <div className="api-form">
                            <input
                                type="text" placeholder="Nom du client (obligatoire)"
                                value={formCle.client_name}
                                onChange={e => setFormCle({ ...formCle, client_name: e.target.value })}
                            />
                            <input
                                type="email" placeholder="E-mail de contact (facultatif)"
                                value={formCle.contact_email}
                                onChange={e => setFormCle({ ...formCle, contact_email: e.target.value })}
                            />
                            <select
                                value={formCle.plan}
                                onChange={e => setFormCle({ ...formCle, plan: e.target.value })}
                            >
                                <option value="essai">Essai — 500 appels/jour, expire à 30 jours</option>
                                <option value="standard">Standard — 10 000 appels/jour</option>
                            </select>
                            <button className="btn-action btn-action--pro" onClick={creerApiKey} disabled={creationEnCours}>
                                {creationEnCours ? <Loader2 size={14} className="spinner" /> : <Plus size={14} />} Créer la clé
                            </button>
                        </div>
                    </section>

                    <section className="admin-section">
                        <h2><KeyRound size={20} /> Clés d'API
                            <span className="admin-hint">({apiKeys.filter(k => k.is_active).length} active(s) sur {apiKeys.length})</span>
                        </h2>
                        {apiKeys.length === 0 ? <p className="admin-empty">Aucune clé émise pour le moment.</p> : (
                            <div className="admin-table-wrapper">
                                <table className="admin-table">
                                    <thead><tr>
                                        <th>Client</th><th>Clé</th><th>Plan</th><th>Aujourd'hui</th>
                                        <th>7 jours</th><th>Expire</th><th>Statut</th><th>Action</th>
                                    </tr></thead>
                                    <tbody>
                                        {apiKeys.map(k => (
                                            <tr key={k.id} className={k.is_active ? '' : 'row-suspended'}>
                                                <td>
                                                    {k.client_name}
                                                    {k.contact_email && <><br /><span className="admin-hint">{k.contact_email}</span></>}
                                                </td>
                                                <td><code>{k.key_prefix}…</code></td>
                                                <td><span className="cat-badge">{k.plan}</span></td>
                                                <td>{k.calls_today} / {k.daily_quota}</td>
                                                <td>{k.calls_7d}</td>
                                                <td>{k.expires_at ? new Date(k.expires_at).toLocaleDateString('fr-FR') : '—'}</td>
                                                <td>{k.is_active
                                                    ? <span className="report-status report-status--resolved">Active</span>
                                                    : <span className="report-status report-status--pending">Révoquée</span>}</td>
                                                <td>
                                                    <button
                                                        className={`btn-action ${k.is_active ? 'btn-action--danger' : 'btn-action--pro'}`}
                                                        onClick={() => basculerApiKey(k)}
                                                        title={k.is_active ? 'Révoquer' : 'Réactiver'}
                                                    >
                                                        {k.is_active ? <><Ban size={14} /> Révoquer</> : <><RotateCcw size={14} /> Réactiver</>}
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                        <p className="admin-note">
                            Documentation pour les clients : <code>https://api.lexenegal.sn/v1/openapi.json</code>.
                            Une révocation prend effet immédiatement ; une réactivation peut demander une minute.
                        </p>
                    </section>
                </>
            )}

            {/* JOURNAL MODAL */}
            {showJournal && journalUser && (
                <div className="journal-modal-overlay" onClick={() => setShowJournal(false)}>
                    <div className="journal-modal" onClick={e => e.stopPropagation()}>
                        <button className="journal-close" onClick={() => setShowJournal(false)}><X size={20} /></button>
                        <h3><History size={20} /> Journal de {journalUser.email}</h3>
                        {journalLoading ? <div className="journal-loading"><Loader2 size={24} className="spinner" /></div>
                            : journalEntries.length === 0 ? <p className="journal-empty">Aucune activité enregistrée</p>
                                : <ul className="journal-list">
                                    {journalEntries.map(entry => (
                                        <li key={entry.id}>
                                            <span className={`journal-action journal-action--${entry.action}`}>{entry.action}</span>
                                            <span className="journal-resource">{entry.resource_id || '-'}</span>
                                            <span className="journal-time">{new Date(entry.created_at).toLocaleString('fr-FR')}</span>
                                        </li>
                                    ))}
                                </ul>}
                    </div>
                </div>
            )}

            <footer className="admin-footer">Source Certifiée: LEXENEGAL.SN</footer>
        </div>
    );
};

export default AdminPage;
