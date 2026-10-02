import { describe, it, expect } from 'vitest';
import { articleUrl, attributionFooter } from '../../hooks/useCopyAttribution';

/*
 * Copie avec attribution. Fusion des codes 2026 (02/10/2026) : en mode daté, l'adresse emportée
 * par la copie porte la version copiée (?ancien=&date=), pour qu'un texte abrogé collé ailleurs ne
 * passe pas pour l'article en vigueur.
 */
describe('articleUrl', () => {
    it('adresse publique de l’article, sans paramètre par défaut', () => {
        expect(articleUrl('code-penal', 'art-14')).toBe('https://www.lexenegal.sn/code/code-penal/art-14');
        expect(articleUrl('ccn-banques', 'art-12')).toBe('https://www.lexenegal.sn/ccn/banques/art-12');
    });

    it('mode daté : la query de la version est ajoutée', () => {
        expect(articleUrl('code-travail', 'art-137', '?ancien=L56&date=2015-03-04'))
            .toBe('https://www.lexenegal.sn/code/code-travail/art-137?ancien=L56&date=2015-03-04');
    });

    it('seule une query string propre est acceptée', () => {
        expect(articleUrl('code-travail', 'art-137', 'javascript:alert(1)')).toBe('https://www.lexenegal.sn/code/code-travail/art-137');
        expect(articleUrl('code-travail', 'art-137', '?a="><b>')).toBe('https://www.lexenegal.sn/code/code-travail/art-137');
    });
});

describe('attributionFooter', () => {
    it('référence et source', () => {
        expect(attributionFooter('Article 137 (version en vigueur le 4 mars 2015, ancien art. L.56)', 'Code du Travail', 'https://x/y'))
            .toBe('\n\n- Article 137 (version en vigueur le 4 mars 2015, ancien art. L.56), Code du Travail\nSource : Lexenegal - https://x/y');
    });
});
