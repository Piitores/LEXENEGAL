import { describe, it, expect } from 'vitest';
import { adresseCanonique, lireAdresseArticle, slugDuTexte, textesRetires, TEXTES_FUSIONNES } from '../routeTexte';

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

describe('textes retirés par la fusion des codes 2026', () => {
    // Avant la migration de données, code-travail-2026 existe : rien ne change.
    const avant = textesRetires(['code-travail', 'code-travail-2026', 'code-securite-sociale-senegal', 'code-securite-sociale-2026']);
    // Après : les deux lignes 2026 ont disparu, leurs adresses mènent au texte fusionné.
    const apres = textesRetires(['code-travail', 'code-securite-sociale-senegal']);

    it('un slug n’est retiré que s’il a quitté la base', () => {
        expect([...avant]).toEqual([]);
        expect([...apres].sort()).toEqual(['code-securite-sociale-2026', 'code-travail-2026']);
        expect(TEXTES_FUSIONNES['code-travail-2026']).toBe('code-travail');
    });

    it('avant la migration : les adresses 2026 restent en place', () => {
        expect(adresseCanonique('/code/code-travail-2026/art-137', { codeSlug: 'code-travail-2026', articleSlug: 'art-137' }, avant)).toBeNull();
        expect(slugDuTexte({ slug: 'code-travail-2026' }, avant)).toBe('code-travail-2026');
        expect(adresseCanonique('/code/code-travail-2026', { slug: 'code-travail-2026' })).toBeNull();
    });

    it('après la migration : texte et article mènent au texte fusionné', () => {
        expect(adresseCanonique('/code/code-travail-2026', { slug: 'code-travail-2026' }, apres)).toBe('/code/code-travail');
        expect(adresseCanonique('/code/code-travail-2026/art-137', { codeSlug: 'code-travail-2026', articleSlug: 'art-137' }, apres))
            .toBe('/code/code-travail/art-137');
        expect(adresseCanonique('/code/code-securite-sociale-2026/art-7', { codeSlug: 'code-securite-sociale-2026', articleSlug: 'art-7' }, apres))
            .toBe('/code/code-securite-sociale-senegal/art-7');
        expect(slugDuTexte({ codeSlug: 'code-travail-2026' }, apres)).toBe('code-travail');
    });

    it('la cible est canonique (pas de boucle) et les autres textes ne bougent pas', () => {
        expect(adresseCanonique('/code/code-travail/art-137', { codeSlug: 'code-travail', articleSlug: 'art-137' }, apres)).toBeNull();
        expect(adresseCanonique('/code/code-penal/art-14', { codeSlug: 'code-penal', articleSlug: 'art-14' }, apres)).toBeNull();
    });
});

describe('lireAdresseArticle', () => {
    it('lit un renvoi /code/ et un renvoi /ccn/', () => {
        expect(lireAdresseArticle('/code/cocc/art-12')).toEqual({ codeSlug: 'cocc', articleSlug: 'art-12', date: null, ancien: null });
        expect(lireAdresseArticle('https://www.lexenegal.sn/ccn/banques/art-3?x=1'))
            .toEqual({ codeSlug: 'ccn-banques', articleSlug: 'art-3', date: null, ancien: null });
        expect(lireAdresseArticle('/ccn/ccni-2019/art-1')).toEqual({ codeSlug: 'ccni-2019', articleSlug: 'art-1', date: null, ancien: null });
    });

    it('lit la version demandée (?date=, ?ancien=), ancre ignorée', () => {
        expect(lireAdresseArticle('/code/code-travail/art-137?ancien=L56&date=2015-03-04'))
            .toEqual({ codeSlug: 'code-travail', articleSlug: 'art-137', date: '2015-03-04', ancien: 'L56' });
        expect(lireAdresseArticle('https://www.lexenegal.sn/code/code-travail/art-137?date=2015-03-04#al-2'))
            .toEqual({ codeSlug: 'code-travail', articleSlug: 'art-137', date: '2015-03-04', ancien: null });
        expect(lireAdresseArticle('/code/code-travail/art-137#x?date=2015-03-04'))
            .toEqual({ codeSlug: 'code-travail', articleSlug: 'art-137', date: null, ancien: null });
        expect(lireAdresseArticle('/code/code-travail/art-137?date=2015-02-30&ancien='))
            .toEqual({ codeSlug: 'code-travail', articleSlug: 'art-137', date: null, ancien: null });
    });

    it('ignore ce qui n’est pas un article', () => {
        expect(lireAdresseArticle('/code/cocc')).toBeNull();
        expect(lireAdresseArticle('/decision/abc')).toBeNull();
        expect(lireAdresseArticle('')).toBeNull();
    });
});
