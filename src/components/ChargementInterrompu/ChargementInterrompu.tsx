import React from 'react';
import { createPortal } from 'react-dom';
import { RefreshCw, WifiOff } from 'lucide-react';
import './ChargementInterrompu.css';

/*
 * « Chargement interrompu » + « Réessayer » : remplace la roue sans fin quand une requête échoue
 * ou dépasse son délai maximal (lib/delaiRequetes.ts). « Réessayer » relance les requêtes de la
 * page (le parent incrémente un compteur de tentatives), sans recharger toute l'application.
 *
 * ⛔ Jamais « introuvable » ici : une erreur n'est pas une absence (Soft 404, cf. lib/reprise.ts).
 * ⛔ Aucun <SEO> / Helmet : l'en-tête du rendu serveur (api/render.js) reste celui de la page.
 *
 * Version serveur encore affichée (body.ssr-live, cf. src/index.tsx) : elle RESTE, c'est le
 * meilleur contenu disponible. Le bloc de page ci-dessous est alors replié à hauteur 0 (App.css)
 * et SurveillanceVersionServeur ne retire pas #ssr-keep tant qu'il est monté ; un bandeau fixe,
 * hors du flux (aucun décalage de mise en page), propose « Réessayer ». Un « Réessayer » réussi
 * remplace la version serveur par la page React, comme un premier chargement.
 *
 * `encart` : échec d'un bloc SECONDAIRE dans une page chargée (texte d'une lettre de doctrine,
 * décisions citant un article). Compact, sans bandeau et sans effet sur la version serveur.
 */
interface Props {
    onReessayer: () => void;
    /** Remplace une page entière : hauteur d'écran, comme l'état « Chargement… » qu'il remplace. */
    pleineHauteur?: boolean;
    encart?: boolean;
}

const ChargementInterrompu: React.FC<Props> = ({ onReessayer, pleineHauteur = false, encart = false }) => {
    if (encart) {
        return (
            <div className="chargement-interrompu-encart" role="status">
                <span>Chargement interrompu.</span>
                <button type="button" onClick={onReessayer}>
                    <RefreshCw size={14} aria-hidden="true" /> Réessayer
                </button>
            </div>
        );
    }

    return (
        <>
            <div
                className={`chargement-interrompu${pleineHauteur ? ' chargement-interrompu--pleine-hauteur' : ''}`}
                role="status"
            >
                <WifiOff size={44} strokeWidth={1.5} className="chargement-interrompu__icone" aria-hidden="true" />
                <h2 className="chargement-interrompu__titre">Chargement interrompu</h2>
                <p className="chargement-interrompu__texte">
                    La connexion a été interrompue avant la fin du chargement.
                </p>
                <button type="button" className="chargement-interrompu__bouton" onClick={onReessayer}>
                    <RefreshCw size={16} aria-hidden="true" /> Réessayer
                </button>
            </div>
            <BandeauVersionServeur message="Chargement interrompu : version simplifiée affichée." onReessayer={onReessayer} />
        </>
    );
};

/**
 * Bandeau fixe, visible SEULEMENT tant que la version serveur est affichée (CSS : body.ssr-live).
 * Partagé par ChargementInterrompu (avec « Réessayer », sans rechargement) et par le filet de 20 s
 * (lib/versionServeur.ts : simple information, SANS bouton, la page charge encore).
 */
export const BandeauVersionServeur: React.FC<{ message: string; onReessayer?: () => void }> = ({ message, onReessayer }) => (
    typeof document !== 'undefined' ? createPortal(
        <div className={`chargement-interrompu-bandeau${onReessayer ? '' : ' chargement-interrompu-bandeau--info'}`} role="status">
            <span>{message}</span>
            {onReessayer && <button type="button" onClick={onReessayer}>Réessayer</button>}
        </div>,
        document.body,
    ) : null
);

export default ChargementInterrompu;
