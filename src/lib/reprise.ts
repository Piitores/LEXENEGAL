import { estDelaiDepasse } from './delaiRequetes';

/**
 * Relance une fois une requête Supabase qui a échoué pour une raison technique (coupure réseau,
 * base momentanément chargée).
 *
 * Pourquoi : une page qui affiche « introuvable » sur une simple erreur passagère est classée
 * « Soft 404 » par Google (constaté le 30/09/2026 sur /jurisprudence/theme/droit-ohada). Une
 * erreur n'est donc JAMAIS un « introuvable » : seule une réponse sans erreur et sans donnée l'est.
 *
 * Exception : un DÉLAI DÉPASSÉ n'est pas relancé (cf. delaiRequetes.ts). Le lecteur a déjà attendu
 * 15 s ; une seconde tentative doublerait l'attente devant une roue, alors que l'écran « Chargement
 * interrompu » lui rend la main tout de suite, avec « Réessayer ».
 */
export async function avecReprise<T extends { error: unknown }>(
    requete: () => PromiseLike<T>,
    delaiMs = 1500,
): Promise<T> {
    const premiere = await requete();
    if (!premiere.error || estDelaiDepasse(premiere.error)) return premiere;
    await new Promise((ok) => setTimeout(ok, delaiMs));
    return requete();
}

/**
 * Attend `promesse` au plus `ms` millisecondes, sans l'annuler : `{ fini: true, valeur }` si elle a
 * abouti à temps, sinon `{ fini: false }` (elle continue, l'appelant peut s'y raccrocher).
 *
 * Usage : une donnée SECONDAIRE qu'on aimerait afficher d'un bloc avec la page (pas de décalage
 * de mise en page quand elle arrive juste après), mais qui ne doit jamais retenir le texte
 * principal plus que ce délai (lettre de doctrine et ses articles visés, 05/10/2026).
 */
export function attendreAuPlus<T>(promesse: Promise<T>, ms: number): Promise<{ fini: true; valeur: T } | { fini: false }> {
    return new Promise((resoudre, rejeter) => {
        const minuterie = setTimeout(() => resoudre({ fini: false }), ms);
        promesse.then(
            (valeur) => { clearTimeout(minuterie); resoudre({ fini: true, valeur }); },
            (erreur) => { clearTimeout(minuterie); rejeter(erreur); },
        );
    });
}
