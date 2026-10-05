/**
 * pauseSession - session MASQUÉE à supabase-js après un rafraîchissement resté sans réponse.
 *
 * Pourquoi (relecture finale du 05/10/2026, membre au jeton expiré, point d'authentification muet) :
 * borner le rafraîchissement à 60 s (lib/delaiRequetes.ts) ne suffisait pas. Après son échec,
 * supabase-js GARDE la session (erreur réessayable, aucune déconnexion), et CHAQUE getSession()
 * suivant la relit, la trouve expirée et relance un rafraîchissement de 60 s ; or chaque lecture
 * PostgREST commence par un getSession(), et ces appels passent l'un après l'autre sous le verrou
 * d'authentification. Mesuré avec le client réel : 3 lectures d'une page rendues à 180, 240 et 300 s,
 * celles d'une navigation interne à 420-540 s, et le même refresh_token renvoyé toutes les 60 s.
 *
 * Remède : quand un rafraîchissement dépasse son délai, la session stockée est masquée (getItem rend
 * null) pendant PAUSE_SESSION_MS. getSession() rend alors aussitôt « aucune session » : les lectures
 * partent avec la clé publique (le contenu public s'affiche, ou « Chargement interrompu » si tout le
 * réseau est mort), sans nouveau rafraîchissement. La session n'est PAS effacée : à la fin de la
 * pause, la boucle de rafraîchissement de supabase-js (toutes les 30 s) retente une fois, et le membre
 * retrouve son compte dès que le serveur répond (ou au rechargement de la page). Toute écriture ou
 * suppression de la session (connexion, déconnexion) met fin à la pause.
 *
 * Même remède quand le rafraîchissement ÉCHOUE TOUT DE SUITE (contrôle du 06/10/2026) : hors ligne,
 * refus de connexion, ou réponse 502/503/504 de l'authentification. supabase-js le relance alors
 * pendant environ 25 s (attentes de 0,2 à 12,8 s), garde la session, et le getSession() suivant
 * recommence : 2 min de roue après une navigation interne hors ligne, page jamais prête quand seule
 * l'authentification tombe. Cf. avecPauseSurEchec.
 */

import { estRafraichissement, urlDe } from './delaiRequetes';

/** Durée du masquage après un rafraîchissement sans réponse, en ms. */
export const PAUSE_SESSION_MS = 120_000;

let finPause = 0;

/** Rafraîchissement sans réponse : la session est masquée pendant PAUSE_SESSION_MS. */
export function suspendreSession(maintenant = Date.now()): void {
    finPause = maintenant + PAUSE_SESSION_MS;
}

/** Vrai pendant la pause. */
export function sessionSuspendue(maintenant = Date.now()): boolean {
    return maintenant < finPause;
}

/** Fin de la pause (session écrite ou effacée, ou tests). */
export function reprendreSession(): void {
    finPause = 0;
}

export interface StockageSession {
    getItem: (cle: string) => string | null;
    setItem: (cle: string, valeur: string) => void;
    removeItem: (cle: string) => void;
}

/** Clé de la session de supabase-js (`sb-<ref>-auth-token`), à l'exclusion de ses annexes (-code-verifier, -user). */
const estCleSession = (cle: string) => /-auth-token$/.test(cle);

/** Stockage de supabase-js qui masque la session pendant la pause ; tout le reste est transmis tel quel. */
export function stockageAvecPause(base: StockageSession): StockageSession {
    return {
        getItem: (cle) => (estCleSession(cle) && sessionSuspendue() ? null : base.getItem(cle)),
        setItem: (cle, valeur) => {
            if (estCleSession(cle)) reprendreSession();
            base.setItem(cle, valeur);
        },
        removeItem: (cle) => {
            if (estCleSession(cle)) reprendreSession();
            base.removeItem(cle);
        },
    };
}

/**
 * Statuts que supabase-js tient pour une panne passagère du serveur d'authentification
 * (NETWORK_ERROR_CODES d'auth-js) : il garde la session et relance le rafraîchissement.
 * Les autres échecs (400 « refresh token already used »…) effacent la session : pas de pause.
 */
const STATUTS_PANNE_PASSAGERE = [502, 503, 504];

/**
 * Enveloppe `fetchDeBase` : un rafraîchissement de session qui échoue (requête rejetée, ou réponse
 * 502/503/504) suspend la session. Les tentatives suivantes de supabase-js pour CE rafraîchissement
 * vont au bout (elles ne relisent pas le stockage) ; si l'une aboutit, la session écrite met fin à
 * la pause. Le délai dépassé des EN-TÊTES arrive aussi ici en rejet ; celui du CORPS n'est vu que par
 * le rappel `surDelaiDepasse` d'avecDelaiMaximal (supabase.ts), qui reste donc nécessaire.
 */
export function avecPauseSurEchec(fetchDeBase: typeof fetch): typeof fetch {
    return (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
        const requete = fetchDeBase(input, init);
        if (!estRafraichissement(urlDe(input))) return requete;
        return requete.then(
            (reponse) => {
                if (STATUTS_PANNE_PASSAGERE.includes(reponse.status)) suspendreSession();
                return reponse;
            },
            (erreur) => {
                suspendreSession();
                throw erreur;
            },
        );
    };
}

/**
 * Stockage par défaut de supabase-js : localStorage s'il est utilisable (il ne l'est pas en navigation
 * privée sur certains Safari, ni quand le navigateur bloque les données de site), sinon la mémoire.
 */
export function stockageNavigateur(): StockageSession {
    try {
        const ls = globalThis.localStorage;
        const essai = '__lx_essai_stockage__';
        ls.setItem(essai, essai);
        ls.removeItem(essai);
        return ls;
    } catch {
        const memoire = new Map<string, string>();
        return {
            getItem: (cle) => memoire.get(cle) ?? null,
            setItem: (cle, valeur) => { memoire.set(cle, valeur); },
            removeItem: (cle) => { memoire.delete(cle); },
        };
    }
}
