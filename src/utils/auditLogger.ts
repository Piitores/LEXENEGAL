/**
 * LEXENEGAL - Audit Logger
 * 
 * Utilitaire pour logger les actions utilisateur dans audit_log
 * Surveille les tentatives de téléchargement massif
 */

import { supabase } from '../lib/supabase';


export type AuditAction =
    | 'view_decision'
    | 'download_pdf'
    | 'search'
    | 'view_code'
    | 'view_article';

interface AuditMetadata {
    query?: string;
    results_count?: number;
    [key: string]: any;
}

/**
 * Hash simple pour l'IP (RGPD compliant - pas de stockage d'IP brute)
 * Utilise un fingerprint basé sur le navigateur à la place de l'IP réelle
 */
function getBrowserFingerprint(): string {
    const data = [
        navigator.userAgent,
        navigator.language,
        screen.width,
        screen.height,
        new Date().getTimezoneOffset()
    ].join('|');

    // Simple hash
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
        const char = data.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(16).substring(0, 12);
}

/**
 * Logger une action utilisateur
 * @param action - Type d'action (view_decision, download_pdf, etc.)
 * @param resourceId - ID ou slug de la ressource concernée
 * @param metadata - Données additionnelles (optionnel)
 */
export async function logAction(
    action: AuditAction,
    resourceId?: string,
    metadata?: AuditMetadata
): Promise<void> {
    try {
        // Récupérer l'utilisateur connecté (si disponible)
        const { data: { session } } = await supabase.auth.getSession();
        const userId = session?.user?.id || null;

        // Insérer le log
        const { error } = await supabase
            .from('audit_log')
            .insert({
                user_id: userId,
                action,
                resource_id: resourceId || null,
                ip_hash: getBrowserFingerprint(),
                user_agent: navigator.userAgent.substring(0, 200),
                metadata: metadata || null
            });

        if (error) {
            // Silently fail - don't break the app for logging issues
            console.warn('Audit log failed:', error.message);
        }
    } catch (e) {
        // Silently fail
        console.warn('Audit log error:', e);
    }
}

/**
 * Logger une consultation de décision
 */
export function logViewDecision(decisionSlug: string): void {
    logAction('view_decision', decisionSlug);
}

/**
 * Logger un téléchargement PDF
 */
export function logDownloadPdf(decisionSlug: string): void {
    logAction('download_pdf', decisionSlug);
}

/**
 * Logger une recherche
 */
export function logSearch(query: string, resultsCount: number): void {
    logAction('search', undefined, { query, results_count: resultsCount });
}

/**
 * Logger une consultation de code
 */
export function logViewCode(codeSlug: string): void {
    logAction('view_code', codeSlug);
}

/**
 * Logger une consultation d'article
 */
export function logViewArticle(codeSlug: string, articleSlug: string): void {
    logAction('view_article', `${codeSlug}/${articleSlug}`);
}

export default {
    logAction,
    logViewDecision,
    logDownloadPdf,
    logSearch,
    logViewCode,
    logViewArticle
};
