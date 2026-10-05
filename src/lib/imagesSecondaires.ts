import type { ImgHTMLAttributes } from 'react';

/**
 * Images SECONDAIRES (logo de l'en-tête, filigrane des décisions) : elles ne doivent retarder ni le LCP
 * (toujours le texte de la version serveur) ni l'événement load.
 *
 * Pourquoi (rapport « pannes » du 05/10/2026) : le premier rendu est synchrone (flushSync, src/index.tsx),
 * donc les images de l'arbre React sont demandées AVANT l'événement load et le retiennent. En 4G lente
 * (décision, profil neuf), load passait de 3,7 s (production) à 11,5 s : /icon-512.png (123 Ko) pour un
 * logo de 44 px, puis /lexenegal_new_logo.svg (1,2 Mo, PNG intégré) pour un filigrane à 3 % d'opacité.
 * Google Analytics n'étant chargé qu'à load (index.html), un visiteur lent parti avant n'était pas compté.
 *
 * `fetchpriority` en MINUSCULES : React 18 ne connaît pas `fetchPriority` (avertissement en
 * développement) ; un attribut inconnu en minuscules passe tel quel dans le DOM.
 */
export const PRIORITE_BASSE = { fetchpriority: 'low' } as unknown as ImgHTMLAttributes<HTMLImageElement>;
