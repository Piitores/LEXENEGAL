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
 *    l'initialisation de supabase-js, cf. hooks/useAuth.ts) : elle part dans une tâche à part.
 */

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
        enCours = (async () => {
            try {
                do {
                    aReprendre = false;
                    await lireUneFois();
                } while (aReprendre);
            } catch (e) {
                // getSession indisponible (verrou d'authentification, cf. authLock.ts) : l'état
                // reste tel quel, la lecture sera retentée au prochain événement ou abonné.
                console.error('Lecture de la session impossible :', e);
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
        desabonner?.();
        desabonner = null;
    };

    return {
        lire: () => etat,
        abonner: (rappel) => {
            abonnes.add(rappel);
            if (abonnes.size === 1) demarrer();
            // Droits en échec pour le compte connecté : retentés à l'arrivée d'un composant.
            else if (!enCours && etat.user && droitsLusPour !== etat.user.id) charger();
            return () => {
                abonnes.delete(rappel);
                if (abonnes.size === 0) arreter();
            };
        },
        charger,
    };
}
