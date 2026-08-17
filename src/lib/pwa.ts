/**
 * Enregistrement du service worker et gestion des mises à jour.
 *
 * Le service worker lui-même vit dans `public/sw.js` (servi à la racine, donc de
 * portée « / »). Il est écrit à la main pour ne pas court-circuiter le rendu
 * serveur de `api/render.js` — voir l'en-tête de ce fichier.
 *
 * Politique de mise à jour : on n'active JAMAIS une nouvelle version sous les pieds
 * d'un utilisateur en train de lire. Le nouveau service worker reste en attente et
 * c'est l'utilisateur qui déclenche le remplacement depuis le bandeau.
 */

const SW_URL = '/sw.js';

type UpdateHandler = () => void;

let waitingWorker: ServiceWorker | null = null;
let reloading = false;

/** L'application tourne-t-elle en mode installé (écran d'accueil) ? */
export function isStandalone(): boolean {
    if (typeof window === 'undefined') return false;
    if (window.matchMedia?.('(display-mode: standalone)').matches) return true;
    // Safari iOS n'expose pas display-mode : il pose `navigator.standalone`.
    return (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
}

/**
 * Enregistre le service worker après le chargement de la page, pour ne pas
 * concurrencer le premier rendu sur les connexions lentes.
 *
 * @param onUpdateReady appelé quand une nouvelle version attend d'être activée.
 */
export function registerServiceWorker(onUpdateReady?: UpdateHandler): void {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

    // En développement, un service worker ne ferait que masquer le rechargement à chaud.
    if (import.meta.env.DEV) return;

    const signalUpdate = (worker: ServiceWorker) => {
        waitingWorker = worker;
        onUpdateReady?.();
    };

    window.addEventListener('load', () => {
        navigator.serviceWorker
            .register(SW_URL)
            .then((registration) => {
                // Une version en attente existait déjà au chargement.
                if (registration.waiting && navigator.serviceWorker.controller) {
                    signalUpdate(registration.waiting);
                }

                registration.addEventListener('updatefound', () => {
                    const installing = registration.installing;
                    if (!installing) return;
                    installing.addEventListener('statechange', () => {
                        // `controller` non nul ⇒ ce n'est pas la première installation,
                        // donc il s'agit bien d'une mise à jour à proposer.
                        if (installing.state === 'installed' && navigator.serviceWorker.controller) {
                            signalUpdate(installing);
                        }
                    });
                });
            })
            .catch(() => {
                /* Enregistrement impossible (navigation privée, réglages) : le site
                   fonctionne normalement sans service worker. */
            });

        // Le remplacement du contrôleur n'a lieu qu'après un SKIP_WAITING demandé
        // par l'utilisateur : on recharge alors une seule fois.
        navigator.serviceWorker.addEventListener('controllerchange', () => {
            if (reloading) return;
            reloading = true;
            window.location.reload();
        });
    });
}

/** Active la version en attente puis recharge (via `controllerchange`). */
export function applyUpdate(): void {
    if (!waitingWorker) {
        window.location.reload();
        return;
    }
    waitingWorker.postMessage({ type: 'SKIP_WAITING' });
    waitingWorker = null;
}
