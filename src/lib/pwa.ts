/**
 * Enregistrement du service worker et gestion des mises à jour.
 *
 * Le service worker lui-même vit dans `public/sw.js` (servi à la racine, donc de
 * portée « / »). Il est écrit à la main pour ne pas court-circuiter le rendu
 * serveur de `api/render.js` - voir l'en-tête de ce fichier.
 *
 * Politique de mise à jour : on n'active JAMAIS une nouvelle version sous les pieds
 * d'un utilisateur en train de lire. Le nouveau service worker reste en attente et
 * c'est l'utilisateur qui déclenche le remplacement depuis le bandeau.
 */

/**
 * ⛔ SERVICE WORKER DÉSACTIVÉ (décision du 05/10/2026) : `registerServiceWorker` n'enregistre rien.
 *
 * Constat : en production, le service worker n'a en pratique JAMAIS été enregistré. L'écouteur
 * « load » était ajouté par l'effet d'UpdateBanner APRÈS l'événement load (trace : load à 408 ms,
 * écouteur à 429 ms), donc jamais appelé. C'était un accident de minutage, pas une décision.
 * Le premier rendu synchrone (flushSync, src/index.tsx) a avancé l'effet AVANT load : le service
 * worker s'installait à la première visite, son `clients.claim()` déclenchait `controllerchange`
 * et la page se rechargeait toute seule (2 documents par première visite, écran blanc entre deux
 * en 4G lente ; rapport « pannes » du 05/10/2026).
 *
 * Décision : garder le comportement réel de la production, AUCUN service worker, et le dire ici
 * plutôt que de dépendre de l'ordre des événements. L'activer est une décision à part : passer
 * cette constante à true, puis remesurer la première visite (1 seul document attendu, LCP et CLS
 * mesurés sur ce document) et éprouver public/sw.js (cache des pages HTML, /offline.html,
 * préchargement de navigation), qui n'a jamais servi en production.
 */
export const SERVICE_WORKER_ACTIF = false;

const SW_URL = '/sw.js';

type UpdateHandler = () => void;

/** Le strict nécessaire de `navigator.serviceWorker` (remplaçable dans les tests). */
export interface ConteneurServiceWorker {
    readonly controller: ServiceWorker | null;
    register: (url: string) => Promise<ServiceWorkerRegistration>;
    addEventListener: (type: 'controllerchange', ecouteur: () => void) => void;
}

/** Commandes rendues par `brancherServiceWorker`. */
export interface SessionServiceWorker {
    /** Mise à jour demandée par le lecteur (bouton « Mettre à jour » du bandeau). */
    appliquerMiseAJour: () => void;
}

let session: SessionServiceWorker | null = null;

/** L'application tourne-t-elle en mode installé (écran d'accueil) ? */
export function isStandalone(): boolean {
    if (typeof window === 'undefined') return false;
    if (window.matchMedia?.('(display-mode: standalone)').matches) return true;
    // Safari iOS n'expose pas display-mode : il pose `navigator.standalone`.
    return (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
}

/**
 * Enregistre le service worker une fois la page chargée, pour ne pas concurrencer le premier
 * rendu sur les connexions lentes. Sans effet tant que SERVICE_WORKER_ACTIF vaut false.
 *
 * @param onUpdateReady appelé quand une nouvelle version attend d'être activée.
 */
export function registerServiceWorker(onUpdateReady?: UpdateHandler): void {
    if (!SERVICE_WORKER_ACTIF) return;
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

    // En développement, un service worker ne ferait que masquer le rechargement à chaud.
    if (import.meta.env.DEV) return;

    const demarrer = () => {
        session = brancherServiceWorker(navigator.serviceWorker, onUpdateReady, () => window.location.reload());
    };
    // Déterministe : l'événement load a pu passer avant l'appel (c'était le cas en production).
    if (document.readyState === 'complete') demarrer();
    else window.addEventListener('load', demarrer, { once: true });
}

/**
 * Enregistre `public/sw.js` sur `conteneur` et suit ses mises à jour. Exporté pour les tests.
 *
 * Rechargement : SEULEMENT après une mise à jour demandée par le lecteur (`appliquerMiseAJour`).
 * Une première installation (aucun contrôleur au départ) déclenche aussi `controllerchange`, à
 * cause du `clients.claim()` de public/sw.js : elle ne doit JAMAIS recharger la page.
 */
export function brancherServiceWorker(
    conteneur: ConteneurServiceWorker,
    onUpdateReady: UpdateHandler | undefined,
    recharger: () => void,
): SessionServiceWorker {
    let enAttente: ServiceWorker | null = null;
    let miseAJourDemandee = false;
    let rechargementLance = false;

    const signalerMiseAJour = (worker: ServiceWorker) => {
        enAttente = worker;
        onUpdateReady?.();
    };

    conteneur
        .register(SW_URL)
        .then((registration) => {
            // Une version en attente existait déjà au chargement.
            if (registration.waiting && conteneur.controller) {
                signalerMiseAJour(registration.waiting);
            }

            registration.addEventListener('updatefound', () => {
                const installing = registration.installing;
                if (!installing) return;
                installing.addEventListener('statechange', () => {
                    // `controller` non nul : ce n'est pas la première installation,
                    // donc il s'agit bien d'une mise à jour à proposer.
                    if (installing.state === 'installed' && conteneur.controller) {
                        signalerMiseAJour(installing);
                    }
                });
            });
        })
        .catch(() => {
            /* Enregistrement impossible (navigation privée, réglages) : le site
               fonctionne normalement sans service worker. */
        });

    conteneur.addEventListener('controllerchange', () => {
        // Première installation (clients.claim) ou remplacement que le lecteur n'a pas demandé :
        // on ne recharge pas sous ses yeux.
        if (!miseAJourDemandee || rechargementLance) return;
        rechargementLance = true;
        recharger();
    });

    return {
        appliquerMiseAJour: () => {
            miseAJourDemandee = true;
            if (!enAttente) {
                rechargementLance = true;
                recharger();
                return;
            }
            // Le remplacement du contrôleur (controllerchange) déclenche alors UN rechargement.
            enAttente.postMessage({ type: 'SKIP_WAITING' });
            enAttente = null;
        },
    };
}

/** Active la version en attente puis recharge (via `controllerchange`). */
export function applyUpdate(): void {
    if (session) session.appliquerMiseAJour();
    else window.location.reload();
}
