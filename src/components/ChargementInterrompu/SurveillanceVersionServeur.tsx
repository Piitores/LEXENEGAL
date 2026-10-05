import React, { useEffect, useState } from 'react';
import { surveillerVersionServeur } from '../../lib/versionServeur';
import { BandeauVersionServeur } from './ChargementInterrompu';

/*
 * Contenu serveur conservé sous React (cf. src/index.tsx) : on le retire dès que plus aucun état
 * « Chargement… » ni « Chargement interrompu » n'est monté dans #app. Au bout de 20 s, une page
 * encore en chargement GARDE la version serveur et reçoit le bandeau « Réessayer » ; « Réessayer »
 * recharge alors la page (aucune tentative de la page n'est accessible d'ici), et la nouvelle page
 * retire la version serveur comme tout premier chargement réussi.
 *
 * Un MutationObserver, et non un minuteur : son rappel s'exécute dans la même tâche que la mise à
 * jour du DOM par React, AVANT le rendu à l'écran. Le navigateur ne peint donc jamais l'état
 * intermédiaire « contenu React + contenu serveur en dessous », qui comptait comme un décalage de
 * mise en page de 0,5 à 1,0. Règles et sélecteurs : lib/versionServeur.ts.
 *
 * Composant à part (et non effet d'App) : l'apparition du bandeau ne fait rendre que lui.
 */
const SurveillanceVersionServeur: React.FC = () => {
    const [bandeau, setBandeau] = useState(false);

    useEffect(() => {
        const keep = document.getElementById('ssr-keep');
        const app = document.getElementById('app');
        if (!keep || !app) return;
        return surveillerVersionServeur({
            present: (selecteur) => !!document.querySelector(selecteur),
            observer: (rappel) => {
                const observateur = new MutationObserver(rappel);
                observateur.observe(app, { childList: true, subtree: true });
                return observateur;
            },
            retirer: () => {
                document.getElementById('ssr-keep')?.remove();
                document.body.classList.remove('ssr-live');
            },
            // Version serveur déjà retirée par une navigation interne (App.tsx, ScrollManager) :
            // rien à proposer, le bandeau n'aurait pas d'objet.
            bandeau: (visible) => setBandeau(visible && !!document.getElementById('ssr-keep')),
        });
    }, []);

    if (!bandeau) return null;
    return (
        <BandeauVersionServeur
            message="Chargement plus long que prévu : version simplifiée affichée."
            onReessayer={() => window.location.reload()}
        />
    );
};

export default SurveillanceVersionServeur;
