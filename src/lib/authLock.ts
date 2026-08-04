/**
 * authLock — verrou d'authentification BORNÉ dans le temps.
 *
 * ⚠️ Pourquoi ce fichier existe (incident du 2026-08-04).
 *
 * `supabase-js` sérialise ses opérations d'authentification avec un verrou
 * **Web Locks**, nommé d'après la clé de stockage et donc **partagé par TOUS les
 * onglets de l'origine** — c'est voulu : cela empêche deux onglets de rafraîchir
 * le jeton simultanément.
 *
 * Mais la bibliothèque le demande avec `acquireTimeout = -1`, ce qui signifie
 * dans son propre contrat : *attendre indéfiniment*. Il suffit donc qu'un
 * contexte détienne ce verrou sans jamais le rendre — typiquement un onglet
 * **gelé en arrière-plan** par le navigateur pour économiser la mémoire — pour
 * que toute nouvelle page se fige : `getSession()` ne rend jamais la main.
 *
 * Symptôme observé : `/admin` bloqué sur « Chargement du Command Center… »,
 * **sans aucune erreur de console et sans la moindre requête réseau** — d'où la
 * difficulté du diagnostic, puisque ni le serveur ni le réseau ne sont en cause.
 *
 * Ce module remplace l'attente infinie par une attente bornée. Au-delà du délai,
 * on échoue **proprement et visiblement** plutôt que de figer l'interface : un
 * écran qui affiche une erreur se répare d'un rechargement, un écran qui tourne
 * dans le vide ne se répare pas.
 *
 * ⛔ On ne se contente PAS d'exécuter l'opération sans verrou après expiration :
 * ce serait rouvrir la porte aux rafraîchissements concurrents que le verrou
 * existe précisément pour empêcher.
 */

/** Délai d'acquisition par défaut, substitué à l'attente infinie de supabase-js.
 *  Une prise de verrou légitime dure quelques centaines de millisecondes (un
 *  rafraîchissement de jeton) : 5 s laisse une marge large tout en gardant un
 *  échec perceptible plutôt qu'un blocage. */
export const DELAI_ACQUISITION_MS = 5000;

/** Erreur d'acquisition, conforme au contrat `LockFunc` de supabase-js. */
function erreurAcquisition(nom: string, delai: number): Error & { isAcquireTimeout: true } {
    const e = new Error(
        `Verrou d'authentification « ${nom} » indisponible après ${delai} ms. ` +
        `Un autre onglet le détient probablement ; fermez-le puis rechargez la page.`,
    ) as Error & { isAcquireTimeout: true };
    // supabase-js teste cette propriété pour distinguer un verrou occupé d'une
    // vraie panne : sa boucle de rafraîchissement automatique l'ignore alors
    // silencieusement, au lieu de remonter une erreur à l'utilisateur.
    e.isAcquireTimeout = true;
    return e;
}

/**
 * Implémentation de `LockFunc` : acquiert `nom` pour la durée de `fn`.
 *
 * @param nom            Nom du verrou (fourni par supabase-js).
 * @param acquireTimeout Délai demandé. **Négatif = illimité** dans le contrat
 *                       d'origine : c'est ce cas que l'on borne. Une valeur
 *                       positive fournie par l'appelant est respectée telle quelle.
 * @param fn             L'opération à exécuter une fois le verrou obtenu.
 */
export async function lockAuthBorne<R>(
    nom: string,
    acquireTimeout: number,
    fn: () => Promise<R>,
): Promise<R> {
    // Pas de Web Locks (rendu serveur, navigateur ancien) : la bibliothèque
    // fonctionne alors sans verrou, on fait de même plutôt que d'échouer.
    const locks = typeof navigator !== 'undefined' ? (navigator as Navigator).locks : undefined;
    if (!locks) return await fn();

    const delai = acquireTimeout < 0 ? DELAI_ACQUISITION_MS : acquireTimeout;
    const controleur = new AbortController();
    const minuterie = setTimeout(() => controleur.abort(), delai);

    try {
        return (await locks.request(
            nom,
            { mode: 'exclusive', signal: controleur.signal },
            async () => await fn(),
        )) as R;
    } catch (e: unknown) {
        // Le signal n'annule qu'une demande EN ATTENTE (spec Web Locks) : une
        // opération déjà commencée va jusqu'au bout. Un AbortError signifie donc
        // toujours « verrou jamais obtenu », jamais « opération interrompue ».
        if (e instanceof Error && e.name === 'AbortError') {
            throw erreurAcquisition(nom, delai);
        }
        throw e; // erreur de l'opération elle-même : on la laisse passer intacte
    } finally {
        clearTimeout(minuterie);
    }
}
