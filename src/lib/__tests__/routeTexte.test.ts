import { describe, it, expect } from 'vitest';
import { adresseCanonique, lireAdresseArticle, slugDuTexte } from '../routeTexte';

describe('slugDuTexte', () => {
    it('retrouve le slug en base depuis chaque forme de route', () => {
        expect(slugDuTexte({ slug: 'code-penal' })).toBe('code-penal');
        expect(slugDuTexte({ codeSlug: 'cocc', articleSlug: 'art-1' })).toBe('cocc');
        expect(slugDuTexte({ segment: 'banques' })).toBe('ccn-banques');
        expect(slugDuTexte({ segment: 'ccni-2019' })).toBe('ccni-2019');
        expect(slugDuTexte({})).toBeUndefined();
    });
});

describe('adresseCanonique', () => {
    it('laisse en place une adresse déjà publique', () => {
        expect(adresseCanonique('/code/code-penal', { slug: 'code-penal' })).toBeNull();
        expect(adresseCanonique('/code/code-penal/art-14', { codeSlug: 'code-penal', articleSlug: 'art-14' })).toBeNull();
        expect(adresseCanonique('/ccn/banques', { segment: 'banques' })).toBeNull();
        expect(adresseCanonique('/ccn/banques/art-12', { segment: 'banques', articleSlug: 'art-12' })).toBeNull();
        expect(adresseCanonique('/ccn/ccni-2019', { segment: 'ccni-2019' })).toBeNull();
    });

    it('ne redirige pas pour une barre finale ou un caractère encodé', () => {
        expect(adresseCanonique('/code/code-penal/', { slug: 'code-penal' })).toBeNull();
        expect(adresseCanonique('/code/cp/article-307%20bis', { codeSlug: 'cp', articleSlug: 'article-307 bis' })).toBeNull();
    });

    it('envoie les anciennes adresses des conventions sous /ccn/', () => {
        expect(adresseCanonique('/code/ccn-banques', { slug: 'ccn-banques' })).toBe('/ccn/banques');
        expect(adresseCanonique('/code/ccn-banques/art-12', { codeSlug: 'ccn-banques', articleSlug: 'art-12' }))
            .toBe('/ccn/banques/art-12');
        expect(adresseCanonique('/convention/ccn-banques', { slug: 'ccn-banques' })).toBe('/ccn/banques');
        expect(adresseCanonique('/convention/ccni-2019/art-3', { codeSlug: 'ccni-2019', articleSlug: 'art-3' }))
            .toBe('/ccn/ccni-2019/art-3');
        expect(adresseCanonique('/ccn/ccn-banques', { segment: 'ccn-banques' })).toBe('/ccn/banques');
    });

    it('ramène sous /code/ un texte qui n’est pas une convention', () => {
        expect(adresseCanonique('/convention/code-penal', { slug: 'code-penal' })).toBe('/code/code-penal');
    });

    it('la cible d’une redirection est elle-même canonique (pas de boucle)', () => {
        const cible = adresseCanonique('/code/ccn-banques/art-12', { codeSlug: 'ccn-banques', articleSlug: 'art-12' });
        expect(adresseCanonique(cible!, { segment: 'banques', articleSlug: 'art-12' })).toBeNull();
    });
});

describe('lireAdresseArticle', () => {
    it('lit un renvoi /code/ et un renvoi /ccn/', () => {
        expect(lireAdresseArticle('/code/cocc/art-12')).toEqual({ codeSlug: 'cocc', articleSlug: 'art-12' });
        expect(lireAdresseArticle('https://www.lexenegal.sn/ccn/banques/art-3?x=1'))
            .toEqual({ codeSlug: 'ccn-banques', articleSlug: 'art-3' });
        expect(lireAdresseArticle('/ccn/ccni-2019/art-1')).toEqual({ codeSlug: 'ccni-2019', articleSlug: 'art-1' });
    });

    it('ignore ce qui n’est pas un article', () => {
        expect(lireAdresseArticle('/code/cocc')).toBeNull();
        expect(lireAdresseArticle('/decision/abc')).toBeNull();
        expect(lireAdresseArticle('')).toBeNull();
    });
});
