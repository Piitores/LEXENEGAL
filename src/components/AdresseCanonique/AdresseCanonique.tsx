// Une seule adresse publique par texte et par article (règle : src/lib/urls.ts).
// Enveloppe les routes d'un texte : si l'adresse consultée est une ancienne forme
// (/code/ccn-banques, /convention/…, /ccn/ccn-banques), on la REMPLACE dans l'historique
// par la forme publique, en gardant ?node=… et l'ancre. Côté serveur, vercel.json fait
// la même chose en 301 ; ceci couvre la navigation interne, qui ne repasse pas par Vercel.
//
// Fusion des codes 2026 (02/10/2026) : /code/code-travail-2026[/…] mène à /code/code-travail[/…]
// (resp. code-securite-sociale-2026 → code-securite-sociale-senegal), paramètres (?date=,
// ?ancien=) et ancre conservés, MAIS seulement une fois le slug retiré de la base : avant la
// migration de données, code-travail désigne encore le code de 1997 et rien ne doit changer.
// La vérification (une lecture, mise en cache) ne concerne que ces deux slugs ; la page
// s'affiche pendant ce temps, comme avant.
import React, { useEffect, useState } from 'react';
import { Navigate, useLocation, useParams } from 'react-router-dom';
import { adresseCanonique, slugDuTexte, TEXTES_FUSIONNES } from '../../lib/routeTexte';
import { chargerTextesRetires } from '../../lib/articlesDuCode';

const AUCUN: ReadonlySet<string> = new Set();

const AdresseCanonique: React.FC<{ children?: React.ReactNode }> = ({ children }) => {
    const params = useParams();
    const { pathname, search, hash } = useLocation();
    const slug = slugDuTexte(params);
    const aVerifier = !!slug && Object.prototype.hasOwnProperty.call(TEXTES_FUSIONNES, slug);
    const [retires, setRetires] = useState<ReadonlySet<string>>(AUCUN);

    useEffect(() => {
        if (!aVerifier) return;
        let actif = true;
        chargerTextesRetires().then((r) => { if (actif) setRetires(r); });
        return () => { actif = false; };
    }, [aVerifier]);

    const cible = adresseCanonique(pathname, params, aVerifier ? retires : AUCUN);
    if (cible) return <Navigate replace to={`${cible}${search}${hash}`} />;
    return <>{children}</>;
};

export default AdresseCanonique;
