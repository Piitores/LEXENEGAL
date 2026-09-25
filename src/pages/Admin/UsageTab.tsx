/**
 * LEXENEGAL - Admin : onglet Usage
 *
 * L'usage réel du connecteur MCP (ouvert sans clé) et de l'API REST (à clé),
 * pour décider sur des chiffres et non sur des impressions. Les données viennent
 * de la RPC `admin_usage_stats()` (gardée is_admin()), chargée par AdminPage.
 */

import React, { useState } from 'react';
import {
    Activity, Clock, Info, KeyRound, MessageSquare, Monitor,
    Plug, Route, Search, Wrench
} from 'lucide-react';
import {
    STATUT_CLE, accord, formatDateFr, formatDateHeureFr, formatSemaine, ilYA,
    libelleClient, libelleDomaine, libelleOutil, preparerBarres, semaineSuivie,
    type SemaineUsage, type StatutCle
} from './usageFormat';

/** Forme exacte du JSON renvoyé par `admin_usage_stats()`. */
export interface UsageStats {
    generated_at: string;
    mcp: {
        /** Premier enregistrement `mcp_usage` ; null tant que le nouveau serveur MCP n'est pas en ligne. */
        tracking_since: string | null;
        sessions_7d: number; sessions_30d: number; sessions_total: number;
        calls_7d: number; calls_30d: number; calls_total: number;
        errors_30d: number;
        searches_7d: number; searches_30d: number; searches_total: number;
        searches_since: string;
        last_activity_at: string | null;
        by_week: { week: string; searches: number; other_calls: number; sessions: number }[];
        by_tool: { tool: string; n: number; errors: number }[];
        by_client: { client: string; sessions: number; last_at: string }[];
    };
    api: {
        keys_total: number; keys_usable: number;
        calls_7d: number; calls_30d: number; calls_total: number; semantic_total: number;
        last_call_at: string | null;
        by_week: { week: string; searches: number; other_calls: number }[];
        by_key: {
            client_name: string; key_prefix: string; plan: string; status: StatutCle;
            created_at: string; expires_at: string | null;
            calls_total: number; calls_30d: number; semantic_total: number;
            first_call_at: string | null; last_call_at: string | null;
        }[];
        by_endpoint: { endpoint: string; n: number }[];
    };
    recent_searches: {
        at: string; source: 'mcp' | 'api'; surface: 'decisions' | 'articles' | 'doctrine';
        query: string; result_count: number | null;
    }[];
}

const LIBELLE_AUTRES = "Autres appels (lectures d'articles, de décisions...)";

/** Tuile chiffrée (stat-card). `texte` réduit la taille pour une date. */
const Tuile: React.FC<{ icone: React.ReactNode; valeur: string; libelle: string; detail?: string; texte?: boolean }> =
    ({ icone, valeur, libelle, detail, texte }) => (
        <div className="stat-card">
            <div className="stat-icon">{icone}</div>
            <div className={`stat-value ${texte ? 'stat-value--texte' : ''}`}>{valeur}</div>
            <div className="stat-label">{libelle}</div>
            {detail && <div className="admin-hint">{detail}</div>}
        </div>
    );

/**
 * Barres empilées par semaine : recherches en bas, autres appels au-dessus.
 * Survol d'une barre -> le détail s'affiche sous le graphique (par défaut : la
 * semaine en cours). Le tableau repliable donne les mêmes chiffres sans survol :
 * c'est lui que le clavier et les lecteurs d'écran atteignent.
 */
interface GraphiqueProps {
    semaines: SemaineUsage[];
    titre: string;
    note?: string;
    /**
     * MCP seulement : autres appels et connexions ne sont connus que depuis
     * cette date (null = pas encore) ; avant, on affiche « - » et non 0.
     * Absent (API) : tout est suivi.
     */
    suiviDepuis?: string | null;
}

const GraphiqueSemaines: React.FC<GraphiqueProps> = ({ semaines, titre, note, suiviDepuis }) => {
    const [actif, setActif] = useState<number | null>(null);
    const barres = preparerBarres(semaines);
    if (barres.length === 0) return <p className="admin-empty">Aucune donnée pour le moment.</p>;

    const suivie = (semaine: string) => suiviDepuis === undefined || semaineSuivie(semaine, suiviDepuis);
    const lue = barres[actif ?? barres.length - 1];
    const autresLus = suivie(lue.semaine) ? accord(lue.autres, 'autre appel', 'autres appels') : 'autres appels non suivis';
    const avecConnexions = semaines.some(s => s.sessions !== undefined);

    return (
        <>
            <div className="usage-legende">
                <span><i className="usage-pastille usage-pastille--recherches" />Recherches</span>
                <span><i className="usage-pastille usage-pastille--autres" />{LIBELLE_AUTRES}</span>
            </div>
            <div
                className="usage-chart" role="img"
                aria-label={`${titre}. Chiffres détaillés dans le tableau « Voir les chiffres semaine par semaine ».`}
                onMouseLeave={() => setActif(null)}
            >
                {barres.map((b, i) => (
                    <div
                        key={b.semaine}
                        className={`usage-chart__col ${actif === i ? 'usage-chart__col--actif' : ''}`}
                        onMouseEnter={() => setActif(i)}
                    >
                        <div className="usage-chart__plot">
                            {b.total > 0 && (
                                <div className="usage-chart__stack" style={{ height: `${b.hauteur}%` }}>
                                    <span className="usage-chart__val">{b.total}</span>
                                    {b.autres > 0 && <div className="usage-chart__seg usage-chart__seg--autres" style={{ flexGrow: b.autres }} />}
                                    {b.recherches > 0 && <div className="usage-chart__seg usage-chart__seg--recherches" style={{ flexGrow: b.recherches }} />}
                                </div>
                            )}
                        </div>
                        <div className={`bar-col__label ${b.libelleMobile ? '' : 'usage-chart__label--secondaire'}`}>{b.libelle}</div>
                    </div>
                ))}
            </div>
            <p className="usage-chart__lecture">
                <strong>Semaine du {formatSemaine(lue.semaine, true)}</strong> : {accord(lue.recherches, 'recherche', 'recherches')}, {autresLus}
            </p>
            {note && <p className="admin-note">{note}</p>}
            <details className="usage-details">
                <summary>Voir les chiffres semaine par semaine</summary>
                <div className="admin-table-wrapper">
                    <table className="admin-table">
                        <thead><tr>
                            <th>Semaine du</th>
                            {avecConnexions && <th>Connexions</th>}
                            <th>Recherches</th><th>Autres appels</th><th>Total</th>
                        </tr></thead>
                        <tbody>
                            {[...semaines].reverse().map(s => {
                                const ok = suivie(s.week);
                                return (
                                    <tr key={s.week}>
                                        <td>{formatSemaine(s.week, true)}</td>
                                        {avecConnexions && <td>{ok ? (s.sessions ?? 0) : '-'}</td>}
                                        <td>{s.searches}</td>
                                        <td>{ok ? s.other_calls : '-'}</td>
                                        <td>{ok ? s.searches + s.other_calls : '-'}</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </details>
        </>
    );
};

const UsageTab: React.FC<{ stats: UsageStats | null }> = ({ stats }) => {
    if (!stats) {
        return (
            <section className="admin-section">
                <p className="admin-empty">Statistiques indisponibles pour le moment.</p>
            </section>
        );
    }
    const { mcp, api } = stats;
    const recentes = stats.recent_searches ?? [];

    return (
        <div className="usage-tab">
            <div className="admin-card usage-intro">
                <Info size={18} />
                <p>
                    Le connecteur MCP est ouvert sans clé : on ne sait donc pas <strong>qui</strong> l'utilise.
                    On compte les connexions (un logiciel comme Claude ou ChatGPT qui charge le connecteur,
                    en général à l'ouverture d'une conversation, puis la réutilise un moment) et les appels
                    d'outils (chaque fois que l'IA consulte vraiment Lexenegal). On reconnaît le logiciel
                    utilisé, mais pas les personnes : les connexions de claude.ai passent toutes par les
                    serveurs d'Anthropic et apparaissent sous le même logiciel, quel que soit l'utilisateur.
                    Le bon indicateur d'usage réel est donc le nombre d'appels d'outils. L'API REST, elle, est à clé : chaque appel est
                    rattaché à un client.
                </p>
            </div>

            {/* CONNECTEUR MCP */}
            <section className="admin-section">
                <h2><Plug size={20} /> Connecteur MCP</h2>
                <div className="admin-stats usage-stats">
                    {/* Tant que le suivi n'a pas démarré, 0 serait lu comme une mesure : « Non suivi ». */}
                    {mcp.tracking_since ? (
                        <>
                            <Tuile icone={<MessageSquare size={24} />} valeur={mcp.sessions_30d.toLocaleString('fr-FR')}
                                libelle="Connexions (30 j)" detail={`${mcp.sessions_total.toLocaleString('fr-FR')} au total`} />
                            <Tuile icone={<Wrench size={24} />} valeur={mcp.calls_30d.toLocaleString('fr-FR')}
                                libelle="Appels d'outils (30 j)"
                                detail={mcp.errors_30d > 0 ? `dont ${accord(mcp.errors_30d, 'erreur', 'erreurs')}` : `${mcp.calls_total.toLocaleString('fr-FR')} au total`} />
                        </>
                    ) : (
                        <>
                            <Tuile icone={<MessageSquare size={24} />} valeur="Non suivi" texte libelle="Connexions (30 j)" />
                            <Tuile icone={<Wrench size={24} />} valeur="Non suivi" texte libelle="Appels d'outils (30 j)" />
                        </>
                    )}
                    <Tuile icone={<Search size={24} />} valeur={mcp.searches_30d.toLocaleString('fr-FR')}
                        libelle="Recherches (30 j)" detail={`${mcp.searches_total.toLocaleString('fr-FR')} au total`} />
                    <Tuile icone={<Clock size={24} />} valeur={formatDateFr(mcp.last_activity_at, 'Aucune')} texte
                        libelle="Dernière activité" detail={ilYA(mcp.last_activity_at)} />
                </div>
                <p className="admin-note">
                    {mcp.tracking_since
                        ? `Connexions et appels suivis depuis le ${formatDateFr(mcp.tracking_since)}.`
                        : 'Connexions et appels : suivi actif dès la mise en ligne du nouveau serveur MCP.'}
                    {mcp.searches_since && <><br />Recherches enregistrées depuis le {formatDateFr(mcp.searches_since)}.</>}
                </p>

                <h3><Activity size={16} /> Activité par semaine</h3>
                <GraphiqueSemaines
                    semaines={mcp.by_week ?? []}
                    titre="Connecteur MCP : recherches et autres appels par semaine"
                    suiviDepuis={mcp.tracking_since ?? null}
                    note={mcp.tracking_since
                        ? `Avant le ${formatDateFr(mcp.tracking_since)}, seules les recherches étaient enregistrées.`
                        : "Pour l'instant, seules les recherches sont enregistrées : autres appels et connexions ne sont pas encore suivis."}
                />

                <div className="admin-dash-grid usage-grid">
                    <div className="admin-card">
                        <h3><Wrench size={16} /> Par outil (90 jours)</h3>
                        {(mcp.by_tool ?? []).length === 0 ? <p className="admin-empty">Aucun appel enregistré pour l'instant.</p> : (
                            <div className="admin-table-wrapper">
                                <table className="admin-table">
                                    <thead><tr><th>Outil</th><th>Appels</th><th>Erreurs</th></tr></thead>
                                    <tbody>
                                        {mcp.by_tool.map(t => (
                                            <tr key={t.tool}>
                                                <td title={t.tool}>{libelleOutil(t.tool)}</td>
                                                <td>{t.n}</td>
                                                <td className={t.errors > 0 ? 'text-danger' : ''}>{t.errors}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                    <div className="admin-card">
                        <h3><Monitor size={16} /> Logiciels clients (90 jours)</h3>
                        {(mcp.by_client ?? []).length === 0 ? <p className="admin-empty">Aucune connexion enregistrée pour l'instant.</p> : (
                            <ul className="top-list">
                                {mcp.by_client.map(c => {
                                    const libelle = libelleClient(c.client);
                                    return (
                                        <li key={c.client}>
                                            <span className="usage-client">
                                                <strong>{libelle}</strong>
                                                <span className="admin-hint">
                                                    {libelle !== c.client ? `${c.client} · ` : ''}dernière le {formatDateFr(c.last_at)}
                                                </span>
                                            </span>
                                            <span className="top-list__n">{accord(c.sessions, 'connexion', 'connexions')}</span>
                                        </li>
                                    );
                                })}
                            </ul>
                        )}
                    </div>
                </div>
            </section>

            {/* API REST */}
            <section className="admin-section">
                <h2><KeyRound size={20} /> API REST (clés)</h2>
                <div className="admin-stats usage-stats">
                    <Tuile icone={<Activity size={24} />} valeur={api.calls_30d.toLocaleString('fr-FR')}
                        libelle="Appels (30 j)" detail={`${api.calls_7d.toLocaleString('fr-FR')} sur 7 jours`} />
                    <Tuile icone={<Search size={24} />} valeur={api.calls_total.toLocaleString('fr-FR')}
                        libelle="Appels au total" detail={`dont ${accord(api.semantic_total, 'recherche sémantique', 'recherches sémantiques')}`} />
                    <Tuile icone={<KeyRound size={24} />} valeur={`${api.keys_usable} / ${api.keys_total}`}
                        libelle="Clés utilisables" detail="actives et non expirées" />
                    <Tuile icone={<Clock size={24} />} valeur={formatDateFr(api.last_call_at, 'Aucun')} texte
                        libelle="Dernier appel" detail={ilYA(api.last_call_at)} />
                </div>

                <h3><Activity size={16} /> Activité par semaine</h3>
                <GraphiqueSemaines semaines={api.by_week ?? []} titre="API REST : recherches et autres appels par semaine" />

                <h3><KeyRound size={16} /> Par clé</h3>
                {(api.by_key ?? []).length === 0 ? <p className="admin-empty">Aucune clé émise pour le moment.</p> : (
                    <div className="admin-table-wrapper">
                        <table className="admin-table">
                            <thead><tr>
                                <th>Client</th><th>Clé</th><th>Plan</th><th>Statut</th><th>Total</th><th>30 j</th>
                                <th>dont sémantiques (total)</th><th>Premier appel</th><th>Dernier appel</th><th>Expire</th>
                            </tr></thead>
                            <tbody>
                                {api.by_key.map(k => {
                                    const statut = STATUT_CLE[k.status] ?? { libelle: k.status, classe: '' };
                                    return (
                                        <tr key={`${k.key_prefix}-${k.created_at}`} className={k.status === 'active' ? '' : 'row-suspended'}>
                                            <td>{k.client_name}</td>
                                            <td><code>{k.key_prefix}…</code></td>
                                            <td><span className="cat-badge">{k.plan}</span></td>
                                            <td><span className={`report-status ${statut.classe}`}>{statut.libelle}</span></td>
                                            <td>{k.calls_total}</td>
                                            <td>{k.calls_30d}</td>
                                            <td>{k.semantic_total}</td>
                                            <td>{formatDateFr(k.first_call_at, 'Jamais')}</td>
                                            <td>{formatDateFr(k.last_call_at, 'Jamais')}</td>
                                            <td>{formatDateFr(k.expires_at, 'Jamais')}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}

                <h3><Route size={16} /> Par route (90 jours)</h3>
                {(api.by_endpoint ?? []).length === 0 ? <p className="admin-empty">Aucun appel enregistré pour l'instant.</p> : (
                    <ul className="top-list">
                        {api.by_endpoint.map(e => (
                            <li key={e.endpoint}><code className="usage-route">{e.endpoint}</code><span className="top-list__n">{accord(e.n, 'appel', 'appels')}</span></li>
                        ))}
                    </ul>
                )}
            </section>

            {/* DERNIÈRES RECHERCHES */}
            <section className="admin-section">
                <h2><Search size={20} /> Dernières recherches (MCP et API)</h2>
                {recentes.length === 0 ? <p className="admin-empty">Aucune recherche enregistrée pour l'instant.</p> : (
                    <ul className="top-list">
                        {recentes.map((r, i) => (
                            <li key={`${r.at}-${i}`}>
                                <div className="usage-recherche">
                                    <div className="report-row__top">
                                        <span className="report-date">{formatDateHeureFr(r.at)}</span>
                                        <span className="cat-badge">{r.source === 'api' ? 'API' : 'MCP'}</span>
                                        <span className="report-type">{libelleDomaine(r.surface)}</span>
                                    </div>
                                    <p className="usage-recherche__texte">{r.query}</p>
                                </div>
                                {r.result_count !== null && r.result_count !== undefined && (
                                    r.result_count === 0
                                        ? <span className="usage-zero" title="Recherche restée sans réponse">Aucun résultat</span>
                                        : <span className="top-list__n">{accord(r.result_count, 'résultat', 'résultats')}</span>
                                )}
                            </li>
                        ))}
                    </ul>
                )}
                <p className="admin-note">
                    Une recherche « Aucun résultat » peut signaler un manque dans le fonds, ou une question mal formulée.
                </p>
            </section>

            <p className="admin-note">Chiffres calculés le {formatDateHeureFr(stats.generated_at)}.</p>
        </div>
    );
};

export default UsageTab;
