import type { User } from '@supabase/supabase-js';
import { deriveEntitlements, type Entitlements, type ProfileRights } from './entitlements';

/**
 * État d'authentification PARTAGÉ par tous les `useAuth` de la page (hooks/useAuth.ts).
 *
 * Pourquoi (rapport « pannes » du 05/10/2026) : chaque instance de useAuth lisait la session et
 * `profiles` pour son compte, au montage puis à chaque événement d'authentification
 * (INITIAL_SESSION, SIGNED_IN…) : 6 à 12 lectures de `profiles` par page vue d'un membre (4
 * instances sur une décision : Navbar, AccountNudge, DecisionPage, DecisionActions).
 *
 * Règles :
 *  - une seule lecture en cours à la fois ; un événement reçu pendant une lecture la fait
 *    reprendre UNE fois à la fin (jamais d'état périmé, jamais deux lectures en parallèle) ;
 *  - `profiles` n'est relu que si l'utilisateur CHANGE (connexion, déconnexion, autre compte),
 *    ou si la lecture précédente a échoué ; un jeton rafraîchi ou un onglet revenu au premier
 *    plan ne relit rien ;
 *  - INITIAL_SESSION est ignoré : la lecture part déjà au premier abonnement ;
 *  - lecture de `profiles` en ÉCHEC : membre toujours connecté (isConnected), droits pro et
 *    admin inconnus donc refusés, et l'indice d'en-tête mémorisé n'est PAS écrasé (sinon un
 *    administrateur perdait « Admin » au premier rendu suivant, cf. lib/indiceSession.ts) ;
 *  - ⛔ le rappel d'onAuthStateChange ne doit jamais attendre la lecture (interblocage avec
 *    l'initialisation de supabase-js, cf. hooks/useAuth.ts) : elle part dans une tâche à part ;
 *  - lecture de la SESSION en échec (verrou d'authentification tenu par un autre onglet plus de 5 s,
 *    cf. authLock.ts) : elle est relancée par une minuterie (1 s, puis 2, 4, 8… jusqu'à 30 s, tant
 *    qu'un composant est abonné) ET dès qu'un nouveau composant s'abonne. Sans cela, une première
 *    lecture en échec laissait `loading` vrai jusqu'au prochain événement d'authentification : un
 *    membre connecté voyait la doctrine « réservée aux membres » (relecture finale du 05/10/2026).
 *    Un événement reçu pendant une lecture qui échoue est repris tout de suite (setTimeout 0).
 */

/** Première relance d'une lecture de session en échec, en ms ; doublée à chaque échec suivant. */
export const RELANCE_SESSION_MS = 1_000;
/** Plafond de l'intervalle entre deux relances, en ms. */
export const RELANCE_SESSION_MAX_MS = 30_000;

export interface EtatAuth extends Entitlements {
    loading: boolean;
    user: User | null;
}

const ANONYME: Entitlements = { isConnected: false, isPro: false, isAdmin: false };

export const ETAT_AUTH_INITIAL: EtatAuth = { loading: true, user: null, ...ANONYME };

export interface DependancesAuth {
    /** Utilisateur de la session courante (getSession), null si aucune. */
    lireUtilisateur: () => Promise<User | null>;
    /** Droits du compte (table profiles) ; `data` null si le compte n'a pas de profil. */
    lireProfil: (uid: string) => PromiseLike<{ data: ProfileRights | null; error: unknown }>;
    /** Abonnement aux événements d'authentification ; rend la fonction de désabonnement. */
    ecouterChangements: (rappel: (evenement: string) => void) => () => void;
    /** Indice d'en-tête pour la prochaine ouverture (lib/indiceSession.ts). */
    memoriserDroits: (uid: string | null, admin: boolean) => void;
}

export interface MagasinAuth {
    lire: () => EtatAuth;
    /** Premier abonné : lecture + écoute des événements ; dernier parti : tout est débranché. */
    abonner: (rappel: () => void) => () => void;
    /** Relit l'état (une seule lecture en cours à la fois). Exposé pour les tests. */
    charger: () => Promise<void>;
}

export function creerEtatAuth(dep: DependancesAuth): MagasinAuth {
    let etat: EtatAuth = ETAT_AUTH_INITIAL;
    const abonnes = new Set<() => void>();
    let enCours: Promise<void> | null = null;
    let aReprendre = false;
    /** Compte dont les droits ont été lus AVEC SUCCÈS (null : à lire). */
    let droitsLusPour: string | null = null;
    let desabonner: (() => void) | null = null;
    let minuterie: ReturnType<typeof setTimeout> | undefined;
    /** Relance après un échec de lecture de la session, et nombre d'échecs consécutifs. */
    let relance: ReturnType<typeof setTimeout> | undefined;
    let echecs = 0;
    /** Vrai tant que la dernière lecture de la session a échoué (état peut-être périmé). */
    let enEchec = false;

    const publier = (nouvel: EtatAuth) => {
        etat = nouvel;
        abonnes.forEach((f) => f());
    };

    const lireUneFois = async () => {
        const user = await dep.lireUtilisateur();
        if (!user) {
            droitsLusPour = null;
            dep.memoriserDroits(null, false);
            if (etat.loading || etat.user || etat.isConnected) publier({ loading: false, user: null, ...ANONYME });
            return;
        }
        if (droitsLusPour === user.id) {
            // Même compte, droits déjà connus : aucune relecture de profiles. L'utilisateur n'est
            // republié que s'il a changé (adresse modifiée…), pas à chaque lecture de la session.
            const avant = etat.user;
            if (etat.loading || avant?.id !== user.id || avant?.email !== user.email || avant?.updated_at !== user.updated_at) {
                publier({ ...etat, loading: false, user });
            }
            return;
        }
        const { data, error } = await dep.lireProfil(user.id);
        if (error) {
            droitsLusPour = null; // relu au prochain événement ou au prochain abonné
            publier({ loading: false, user, isConnected: true, isPro: false, isAdmin: false });
            return;
        }
        droitsLusPour = user.id;
        const droits = deriveEntitlements(data);
        dep.memoriserDroits(user.id, droits.isAdmin);
        publier({ loading: false, user, ...droits });
    };

    const charger = (): Promise<void> => {
        if (enCours) {
            aReprendre = true;
            return enCours;
        }
        clearTimeout(relance);
        enCours = (async () => {
            try {
                do {
                    aReprendre = false;
                    await lireUneFois();
                } while (aReprendre);
                echecs = 0;
                enEchec = false;
            } catch (e) {
                // getSession indisponible (verrou d'authentification, cf. authLock.ts) : l'état
                // reste tel quel, et la lecture est RELANCÉE (minuterie, nouvel abonné, événement).
                console.error('Lecture de la session impossible :', e);
                enEchec = true;
                if (abonnes.size > 0) {
                    // Un événement reçu pendant cette lecture : repris tout de suite. Sinon, attente
                    // croissante (1 s, 2 s, 4 s… 30 s) : un verrou tenu par un autre onglet se libère seul.
                    const attente = aReprendre ? 0 : Math.min(RELANCE_SESSION_MS * 2 ** echecs, RELANCE_SESSION_MAX_MS);
                    echecs++;
                    clearTimeout(relance);
                    relance = setTimeout(() => { charger(); }, attente);
                }
                aReprendre = false;
            } finally {
                enCours = null;
            }
        })();
        return enCours;
    };

    const demarrer = () => {
        charger();
        desabonner = dep.ecouterChangements((evenement) => {
            if (evenement === 'INITIAL_SESSION') return;
            clearTimeout(minuterie);
            minuterie = setTimeout(() => { charger(); }, 0);
        });
    };

    const arreter = () => {
        clearTimeout(minuterie);
        clearTimeout(relance);
        desabonner?.();
        desabonner = null;
    };

    return {
        lire: () => etat,
        abonner: (rappel) => {
            abonnes.add(rappel);
            if (abonnes.size === 1) demarrer();
            // Session ou droits en échec (état encore inconnu, lecture de session ratée, droits du
            // compte connecté non lus) : relus à l'arrivée d'un composant, sans attendre la minuterie.
            else if (!enCours && (etat.loading || enEchec || (etat.user && droitsLusPour !== etat.user.id))) charger();
            return () => {
                abonnes.delete(rappel);
                if (abonnes.size === 0) arreter();
            };
        },
        charger,
    };
}
