import { describe, it, expect } from 'vitest';
import { formatDoctrineDate } from '../doctrineDate';

describe('formatDoctrineDate', () => {
    it('formate une date ISO', () => {
        expect(formatDoctrineDate('2019-03-15', null)).toBe('15 mars 2019');
    });

    it('retombe sur la référence quand la date est absente', () => {
        expect(formatDoctrineDate(null, 'Lettre n° 123 MEF/DGID du 15 mars 2019')).toBe('15 mars 2019');
    });

    it('retombe sur la référence quand la date est invalide', () => {
        expect(formatDoctrineDate('n/a', 'REPONSE DU 18 SEPTEMBRE 2009')).toBe('18 septembre 2009');
    });

    it('gère les mois accentués et non accentués', () => {
        expect(formatDoctrineDate(null, 'Lettre du 2 février 2021')).toBe('2 février 2021');
        expect(formatDoctrineDate(null, 'Lettre du 2 fevrier 2021')).toBe('2 février 2021');
    });

    it('tolère les césures des extractions PDF (« novembr e 200 4 »)', () => {
        expect(formatDoctrineDate(null, 'Lettre du 3 novembr e 200 4')).toBe('3 novembre 2004');
    });

    it("retourne 'Date inconnue' si rien n'est exploitable", () => {
        expect(formatDoctrineDate(null, null)).toBe('Date inconnue');
        expect(formatDoctrineDate('n/a', 'sans date')).toBe('Date inconnue');
        expect(formatDoctrineDate(undefined, undefined)).toBe('Date inconnue');
    });
});
