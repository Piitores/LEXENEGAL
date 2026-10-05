/**
 * indiceSession - état de connexion lu en SYNCHRONE, pour le PREMIER rendu de l'en-tête.
 *
 * Pourquoi (relevé du 05/10/2026) : `useAuth` attend `getSession()` (asynchrone, sous le
 * verrou Web Locks de supabase-js) PUIS la requête réseau `profiles` avant de connaître
 * l'utilisateur. Pendant ce temps l'en-tête montrait « Connexion » à un membre connecté,
 * puis basculait sur l'avatar (et « Admin ») : le bouton change de largeur et, la loupe
 * étant poussée à droite par `margin-left: auto`, TOUS les liens de l'en-tête glissaient
 * (jusqu'à 197 px pour un administrateur, mesuré à 1440 px).
 *
 * supabase-js range pourtant la session dans localStorage (`sb-<ref>-auth-token`) : on la
 * lit ici directement, sans réseau ni verrou, uniquement pour CHOISIR L'AFFICHAGE. Aucun
 * droit n'en découle : l'accès réel reste établi par `useAuth` (getSession + profiles) et
 * protégé par la RLS côté base. Un indice faux (session révoquée ailleurs) se corrige dès
 * la réponse de `useAuth`, comme avant.
 */

const URL_SUPABASE: string = import.meta.env.VITE_SUPABASE_URL || '';

/** Clé de stockage par défaut de supabase-js v2 : `sb-<ref du projet>-auth-token`. */
export const CLE_SESSION: string = (() => {
    try { return `sb-${new URL(URL_SUPABASE).hostname.split('.')[0]}-auth-token`; } catch { return ''; }
})();

/** Droits d'affichage mémorisés à la dernière lecture de `profiles` (pour « Admin »). */
export const CLE_DROITS_ENTETE = 'lexenegal_entete_droits';

export interface IndiceSession {
    /** Une session est stockée : l'en-tête affiche l'avatar plutôt que « Connexion ». */
    connecte: boolean;
    /** Partie locale de l'adresse, comme dans le menu avatar. */
    nom: string;
    /** Dernier rôle connu pour CE compte : afficher le lien « Admin » dès le départ. */
    admin: boolean;
}

const ANONYME: IndiceSession = { connecte: false, nom: '', admin: false };

type Lecteur = Pick<Storage, 'getItem'>;

function stockageParDefaut(): Lecteur | null {
    try { return typeof window !== 'undefined' ? window.localStorage : null; } catch { return null; }
}

/** Lecture synchrone ; ne lève jamais (stockage bloqué, JSON abîmé : on rend « anonyme »). */
export function lireIndiceSession(stockage: Lecteur | null = stockageParDefaut()): IndiceSession {
    try {
        if (!stockage || !CLE_SESSION) return ANONYME;
        const brut = stockage.getItem(CLE_SESSION);
        if (!brut) return ANONYME;
        const s = JSON.parse(brut);
        // Même contrôle que supabase-js (_isValidSession). Un jeton d'accès expiré n'est pas
        // un motif d'anonymat : supabase-js le rafraîchit avec le refresh_token.
        if (!s || typeof s !== 'object' || !s.access_token || !s.refresh_token || !('expires_at' in s)) return ANONYME;
        const uid: string | null = typeof s.user?.id === 'string' ? s.user.id : null;
        const email: string = typeof s.user?.email === 'string' ? s.user.email : '';
        let admin = false;
        const d = JSON.parse(stockage.getItem(CLE_DROITS_ENTETE) || 'null');
        if (d && uid && d.uid === uid) admin = d.admin === true;
        return { connecte: true, nom: email.split('@')[0], admin };
    } catch {
        return ANONYME;
    }
}

/** Appelé par `useAuth` après lecture de `profiles` (uid null = anonyme : on efface). */
export function memoriserDroitsEntete(uid: string | null, admin: boolean): void {
    try {
        if (uid) window.localStorage.setItem(CLE_DROITS_ENTETE, JSON.stringify({ uid, admin }));
        else window.localStorage.removeItem(CLE_DROITS_ENTETE);
    } catch { /* stockage indisponible : l'indice restera sans « Admin », sans conséquence */ }
}
