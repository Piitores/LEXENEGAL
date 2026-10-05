/**
 * Suppression de compte (fonction edge delete-account) : issue RÉELLE, vérifiée avant d'afficher
 * « Échec ».
 *
 * Pourquoi (rapport « react » du 05/10/2026) : une coupure côté client (délai dépassé, connexion
 * perdue) ne dit rien de ce qu'a fait le serveur. delete-account n'a aucune borne côté serveur et
 * continue : l'écran affichait « Échec de la suppression » pendant que le compte était supprimé ;
 * un nouvel essai recevait 401, et la session locale restait. La fonction a désormais une borne
 * LONGUE (120 s, lib/delaiRequetes.ts) ; sur TOUTE erreur, on demande au serveur d'authentification
 * si le compte existe encore (getUser) avant de conclure. Après un DÉLAI dépassé, un compte encore
 * présent ne prouve rien : la suppression en cascade peut être en cours. L'issue est alors
 * « incertain », jamais « echec ».
 */
import { estDelaiDepasse } from './delaiRequetes';

export type IssueSuppression = 'supprime' | 'echec' | 'incertain';

interface ReponseUtilisateur {
    data: { user: unknown | null } | null;
    error: { name?: string; code?: string; status?: number; message?: string } | null;
}

/** Codes du serveur d'authentification qui signifient « ce compte n'existe plus ». */
const CODES_COMPTE_DISPARU = ['user_not_found', 'session_not_found', 'refresh_token_not_found'];

/** Lit la réponse de getUser() après une suppression dont l'issue est incertaine. */
export function compteEncorePresent(r: ReponseUtilisateur): boolean | null {
    if (r.data?.user && !r.error) return true;
    const e = r.error;
    if (!e) return null;
    // Session effacée par supabase-js (session_not_found) ou compte introuvable : supprimé.
    if (e.name === 'AuthSessionMissingError') return false;
    if (e.code && CODES_COMPTE_DISPARU.includes(e.code)) return false;
    if (e.status === 403 && /sub claim in JWT does not exist/i.test(e.message || '')) return false;
    // Réseau, délai, erreur serveur : on ne sait pas.
    return null;
}

/**
 * Appelle la suppression puis, en cas d'erreur, vérifie l'état du compte.
 * 'supprime' : compte supprimé (vider la session locale) ; 'echec' : le serveur a répondu par une
 * erreur et le compte existe toujours ; 'incertain' : impossible de savoir (réseau, ou délai dépassé
 * alors que la suppression peut être en cours), ne surtout pas affirmer l'échec.
 */
export async function supprimerCompteVerifie(
    supprimer: () => PromiseLike<{ error: unknown }>,
    lireUtilisateur: () => PromiseLike<ReponseUtilisateur>,
): Promise<IssueSuppression> {
    let erreur: unknown;
    try {
        erreur = (await supprimer()).error;
    } catch (e) {
        erreur = e;
    }
    if (!erreur) return 'supprime';
    try {
        const present = compteEncorePresent(await lireUtilisateur());
        if (present === false) return 'supprime';
        // Compte encore là après un délai dépassé : suppression peut-être en cours, on ne conclut pas.
        return present === true && !estDelaiDepasse(erreur) ? 'echec' : 'incertain';
    } catch {
        return 'incertain';
    }
}
