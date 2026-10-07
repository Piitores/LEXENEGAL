/**
 * Retrait de la version serveur (#ssr-keep, cf. src/index.tsx) quand la page React est prête.
 *
 * Extrait d'App.tsx (05/10/2026) pour être testé sans navigateur : le DOM, le MutationObserver et
 * le bandeau sont fournis par l'appelant (components/ChargementInterrompu/SurveillanceVersionServeur).
 *
 * Règles :
 *  - on retire la version serveur dès que plus aucun état « Chargement… » NI « Chargement
 *    interrompu » n'est monté dans #app ;
 *  - « Chargement interrompu » (components/ChargementInterrompu) la GARDE : c'est le meilleur
 *    contenu disponible, et une erreur ne doit jamais faire place à un écran vide ou à
 *    « introuvable » (Soft 404). Un « Réessayer » réussi la retire comme un premier chargement ;
 *  - filet de sécurité, quand la tentative EN COURS dure depuis 20 s : la version serveur n'est
 *    JAMAIS retirée. Page encore en chargement (connexion lente, rafraîchissement de session lent) :
 *    on la GARDE et on montre un bandeau d'INFORMATION, sans bouton (« Chargement en cours… la page
 *    complète s'affichera dès qu'elle sera prête »). Retirer la version serveur ne laissait qu'une
 *    roue, puis « Chargement interrompu » sans aucun texte (rapports « pannes » et « react » du
 *    05/10/2026). ⛔ Jamais de rechargement proposé tant que la page charge : sur une connexion lente
 *    mais vivante, recharger jetait la lecture en cours (prête à 71 s au lieu de 48,8 s, et jamais si
 *    l'on cliquait à chaque bandeau ; relecture finale). « Réessayer », sans rechargement, reste
 *    réservé à « Chargement interrompu », dont le bandeau suffit (jamais deux bandeaux) ;
 *  - un « Réessayer » (passage « interrompu » -> « en chargement ») ouvre une NOUVELLE tentative :
 *    l'échéance de 20 s est réarmée, le bandeau du filet ne paraît pas à l'instant du clic ;
 *  - une page qui PLANTE pendant que la version serveur est affichée (morceau de code d'un ancien
 *    déploiement introuvable, bug) monte aussi « Chargement interrompu » via l'ErrorBoundary
 *    (lib/erreurChargement.ts, 07/10/2026) : jamais « Une erreur inattendue » à la place du texte.
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

/** Filet de sécurité : durée d'une tentative de chargement au-delà de laquelle le bandeau d'information paraît. */
export const FILET_VERSION_SERVEUR_MS = 20_000;

export interface EnvironnementVersionServeur {
    /** Vrai si un élément correspond au sélecteur (document.querySelector). */
    present: (selecteur: string) => boolean;
    /** Branche un observateur des mutations de #app, qui appelle `rappel` à chaque mutation. */
    observer: (rappel: () => void) => { disconnect: () => void };
    /** Retire #ssr-keep et la classe body.ssr-live. */
    retirer: () => void;
    /** Montre (true) ou cache (false) le bandeau d'information du filet de sécurité (sans bouton). */
    bandeau: (visible: boolean) => void;
}

/** Surveille #app et retire la version serveur au bon moment. Rend la fonction de nettoyage. */
export function surveillerVersionServeur(env: EnvironnementVersionServeur): () => void {
    let observateur: { disconnect: () => void } | null = null;
    let minuterie: ReturnType<typeof setTimeout> | undefined;
    let fini = false;
    let echu = false;
    let bandeauVisible = false;
    /** État de la vérification précédente : « Chargement interrompu » monté. */
    let etaitInterrompu = false;

    const montrerBandeau = (visible: boolean) => {
        if (visible === bandeauVisible) return;
        bandeauVisible = visible;
        env.bandeau(visible);
    };
    const terminer = () => {
        if (fini) return;
        fini = true;
        observateur?.disconnect();
        clearTimeout(minuterie);
        montrerBandeau(false);
        env.retirer();
    };
    /** (Ré)arme l'échéance : au montage, puis à chaque nouvelle tentative (« Réessayer »). */
    const armer = () => {
        echu = false;
        clearTimeout(minuterie);
        // Échéance : on ne retire RIEN, on informe si la page charge encore.
        minuterie = setTimeout(() => { echu = true; verifier(); }, FILET_VERSION_SERVEUR_MS);
    };
    const verifier = () => {
        if (fini) return;
        const enChargement = env.present(SELECTEUR_CHARGEMENT);
        const interrompu = env.present(SELECTEUR_INTERROMPU);
        // Page prête (ni chargement ni échec) : seul cas où la version serveur cède la place.
        if (!enChargement && !interrompu) { terminer(); return; }
        // « Réessayer » : nouvelle tentative, nouvelle échéance (pas de bandeau à l'instant du clic).
        if (etaitInterrompu && !interrompu) armer();
        etaitInterrompu = interrompu;
        // Page encore en chargement après l'échéance : bandeau du filet. Page en échec : celui de
        // ChargementInterrompu suffit.
        montrerBandeau(echu && enChargement && !interrompu);
    };

    observateur = env.observer(verifier);
    armer();
    verifier();

    return () => {
        observateur?.disconnect();
        clearTimeout(minuterie);
        montrerBandeau(false);
    };
}
