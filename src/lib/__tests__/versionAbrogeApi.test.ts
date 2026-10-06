import { describe, it, expect } from 'vitest';
import { estAbroge, libelleSansFin, libellePeriode, type VersionArticle } from '../versionsArticle';

/*
 * Article abrogé sans date de fin (06/10/2026) : 132 articles affichaient « En vigueur depuis le … »
 * sous le bandeau « abrogé », souvent avec une date de remplissage (CPP 367-1 à 367-13 : « 1er janvier
 * 2000 »). Règle : jamais « en vigueur depuis » pour un article abrogé, à l'identique sur la page
 * React (libellePeriode, libelleSansFin) et dans la version serveur (ligneVersionSsr, api/render.js).
 * La date sans fin est lue sans fuseau horaire et écrit « 1er » (la page React passait par
 * toLocaleDateString : « 31 décembre 1999 » à l'ouest de Greenwich, « 1 janvier »).
 */
const charger = (fichier: string): Promise<any> =>
    import(/* @vite-ignore */ decodeURIComponent(new URL(`../../../api/${fichier}`, import.meta.url).pathname));

const v = (effective_date: string, expiration_date: string | null = null): VersionArticle =>
    ({ id: effective_date, effective_date, expiration_date, is_current: true, version_note: null } as unknown as VersionArticle);

describe('article abrogé : jamais « En vigueur depuis »', () => {
    it('estAbroge : statut « abrogé » ou article retiré', () => {
        expect(estAbroge({ status: 'abrogé', is_active: true })).toBe(true);
        expect(estAbroge({ status: 'validated', is_active: false })).toBe(true);
        expect(estAbroge({ status: 'validated', is_active: true })).toBe(false);
        expect(estAbroge(null)).toBe(false);
    });

    it('version sans fin : « Article abrogé », ou « En vigueur depuis le 1er … » sans fuseau', () => {
        expect(libelleSansFin('2008-09-23', true)).toBe('Article abrogé');
        expect(libelleSansFin('2000-01-01')).toBe('En vigueur depuis le 1er janvier 2000');
        const seule = v('2008-09-23');
        expect(libellePeriode(seule, [seule], '367-1', true)).toBe('Article abrogé');
        expect(libellePeriode(seule, [seule], '367-1')).toBe('En vigueur depuis le 23 septembre 2008');
    });

    it('version qui a une fin : sa période, abrogé ou non', () => {
        const close = v('2012-12-31', '2015-03-23');
        expect(libellePeriode(close, [close], '131', true)).toBe('En vigueur du 31 décembre 2012 au 22 mars 2015');
    });

    it('la version serveur dit la même chose que la page React', async () => {
        const api = await charger('render.js');
        const abroge = { article_number: '367-1', status: 'abrogé', is_active: true };
        const enVigueur = { article_number: '400', status: 'validated', is_active: true };
        expect(api.ligneVersionSsr([v('2008-09-23')], null, abroge).texte).toBe('Article abrogé');
        expect(api.ligneVersionSsr([v('2022-05-27')], null, enVigueur).texte).toBe('En vigueur depuis le 27 mai 2022');
        expect(api.ligneVersionSsr([v('2000-01-01')], null, enVigueur).texte).toBe(libelleSansFin('2000-01-01'));
        expect(api.ligneVersionSsr([v('2012-12-31', '2015-03-23')], null, { ...abroge, article_number: '131' }).texte)
            .toBe('En vigueur du 31 décembre 2012 au 22 mars 2015');
    });
});
