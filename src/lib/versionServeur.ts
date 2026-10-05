/**
 * Retrait de la version serveur (#ssr-keep, cf. src/index.tsx) quand la page React est prête.
 *
 * Extrait d'App.tsx (05/10/2026) pour être testé sans navigateur : le DOM et le MutationObserver
 * sont fournis par l'appelant.
 *
 * Règles :
 *  - on retire la version serveur dès que plus aucun état « Chargement… » NI « Chargement
 *    interrompu » n'est monté dans #app ;
 *  - « Chargement interrompu » (components/ChargementInterrompu) la GARDE : c'est le meilleur
 *    contenu disponible, et une erreur ne doit jamais faire place à un écran vide ou à
 *    « introuvable » (Soft 404). Un « Réessayer » réussi la retire comme un premier chargement ;
 *  - filet de sécurité : au bout de 20 s, on la retire si un état « Chargement… » est encore
 *    monté (chargement qui ne finirait jamais), mais PAS si la page est en échec.
 *
 * ⚠️ Le rappel doit venir d'un MutationObserver, jamais d'un minuteur : il s'exécute dans la même
 * tâche que la mise à jour du DOM par React, AVANT le rendu à l'écran. Le navigateur ne peint donc
 * jamais l'état intermédiaire « contenu React + contenu serveur en dessous », qui comptait comme
 * un décalage de mise en page de 0,5 à 1,0.
 * ⚠️ Tout nouvel état de chargement d'une page SSR va dans SELECTEUR_CHARGEMENT ET dans le bloc
 * body.ssr-live d'App.css.
 */

export const SELECTEUR_CHARGEMENT = [
    '#app .route-fallback',
    '#app .code-loading',
    '#app .article-loading',
    '#app .decisionPage .loading-bar-container',
    '#app .theme-page__loading',
    '#app .guides-page__loading',
    '#app .juris-hub__loading',
    // « > .spinner » : ConventionsListPage réutilise .corpus-loading pour « Aucune convention… »,
    // qui n'est pas un chargement.
    '#app .corpus-loading > .spinner',
    '#app .doctrine-detail__container > .doctrine-loading',
].join(', ');

export const SELECTEUR_INTERROMPU = '#app .chargement-interrompu';

/** Filet de sécurité : délai au-delà duquel un chargement sans fin cède la place à React. */
export const FILET_VERSION_SERVEUR_MS = 20_000;

export interface EnvironnementVersionServeur {
    /** Vrai si un élément correspond au sélecteur (document.querySelector). */
    present: (selecteur: string) => boolean;
    /** Branche un observateur des mutations de #app, qui appelle `rappel` à chaque mutation. */
    observer: (rappel: () => void) => { disconnect: () => void };
    /** Retire #ssr-keep et la classe body.ssr-live. */
    retirer: () => void;
}

/** Surveille #app et retire la version serveur au bon moment. Rend la fonction de nettoyage. */
export function surveillerVersionServeur(env: EnvironnementVersionServeur): () => void {
    let observateur: { disconnect: () => void } | null = null;
    let minuterie: ReturnType<typeof setTimeout> | undefined;
    let fini = false;

    const terminer = () => {
        if (fini) return;
        fini = true;
        observateur?.disconnect();
        clearTimeout(minuterie);
        env.retirer();
    };
    const verifier = () => {
        if (!env.present(`${SELECTEUR_CHARGEMENT}, ${SELECTEUR_INTERROMPU}`)) terminer();
    };

    observateur = env.observer(verifier);
    // Page en échec à l'échéance : la version serveur reste, l'observateur reste branché.
    minuterie = setTimeout(() => { if (!env.present(SELECTEUR_INTERROMPU)) terminer(); }, FILET_VERSION_SERVEUR_MS);
    verifier();

    return () => {
        observateur?.disconnect();
        clearTimeout(minuterie);
    };
}
