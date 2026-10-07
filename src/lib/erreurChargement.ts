/**
 * Ce que l'ErrorBoundary affiche à la place d'une page qui a planté (components/ErrorBoundary).
 *
 * Diagnostic Search Console du 07/10/2026 : après chaque déploiement, le moteur de rendu de Google
 * (et tout lecteur dont l'onglet est resté ouvert) exécute parfois l'ancienne version du site et
 * réclame des morceaux de code qui n'existent plus (124 fichiers /assets servis en HTML à Googlebot
 * le 04/10), ou Cloudflare en refuse un (429). L'import échoue, l'ErrorBoundary affichait « Une
 * erreur inattendue est survenue » et lib/versionServeur.ts retirait le texte servi par le serveur :
 * Google lisait une page d'erreur de 77 mots sur une adresse en 200, classée « Soft 404 ».
 *
 * Règle : jamais de page d'erreur à la place d'un texte disponible. Version serveur encore affichée
 * (#ssr-keep, premier chargement) ou morceau de code introuvable : « Chargement interrompu » (classe
 * .chargement-interrompu, que versionServeur.ts GARDE, repliée par App.css tant que body.ssr-live),
 * dont le « Réessayer » recharge la page (seul moyen d'obtenir la nouvelle version du site). Sinon
 * (vrai bug, page déjà remplacée par React) : l'écran d'erreur habituel, avec « Signaler ce bug ».
 */

const MOTIFS_CHARGEMENT_MODULE = [
    'failed to fetch dynamically imported module', // Chrome, Edge
    'error loading dynamically imported module', // Firefox
    'importing a module script failed', // Safari
    'unable to preload css', // Vite (CSS d'un morceau de code)
    'is not a valid javascript mime type', // fichier servi en HTML
    'expected a javascript module script', // Chrome, même cas
    'expected a javascript-or-wasm module script',
    'chunkloaderror',
];

/** Vrai si l'erreur vient du chargement d'un morceau de code (import dynamique), pas d'un bug d'affichage. */
export function estErreurChargementModule(erreur: unknown): boolean {
    if (!erreur) return false;
    const e = erreur as { name?: unknown; message?: unknown };
    const texte = `${typeof e.name === 'string' ? e.name : ''} ${typeof e.message === 'string' ? e.message : String(erreur)}`.toLowerCase();
    return MOTIFS_CHARGEMENT_MODULE.some((m) => texte.includes(m));
}

export type AffichageErreur = 'interrompu' | 'erreur';

/** Choix de l'ErrorBoundary : « Chargement interrompu » (texte gardé) ou écran d'erreur. */
export function affichageErreur(erreur: unknown, versionServeurAffichee: boolean): AffichageErreur {
    return versionServeurAffichee || estErreurChargementModule(erreur) ? 'interrompu' : 'erreur';
}
