// Une seule adresse publique par texte et par article (règle : src/lib/urls.ts).
// Enveloppe les routes d'un texte : si l'adresse consultée est une ancienne forme
// (/code/ccn-banques, /convention/…, /ccn/ccn-banques), on la REMPLACE dans l'historique
// par la forme publique, en gardant ?node=… et l'ancre. Côté serveur, vercel.json fait
// la même chose en 301 ; ceci couvre la navigation interne, qui ne repasse pas par Vercel.
import React from 'react';
import { Navigate, useLocation, useParams } from 'react-router-dom';
import { adresseCanonique } from '../../lib/routeTexte';

const AdresseCanonique: React.FC<{ children?: React.ReactNode }> = ({ children }) => {
    const params = useParams();
    const { pathname, search, hash } = useLocation();
    const cible = adresseCanonique(pathname, params);
    if (cible) return <Navigate replace to={`${cible}${search}${hash}`} />;
    return <>{children}</>;
};

export default AdresseCanonique;
