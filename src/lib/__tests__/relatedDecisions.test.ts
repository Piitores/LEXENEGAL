import { describe, it, expect } from 'vitest';
import { outgoingSlugs, mergeRelated, type RelatedDecision } from '../relatedDecisions';

const d = (slug: string, date: string | null): RelatedDecision => ({
    id: slug, slug, reference: slug, juridiction: 'Cour suprême', chambre: null,
    date_decision: date, parties_principales: null,
});

describe('outgoingSlugs', () => {
    it('ignore les valeurs vides, les doublons et la décision elle-même', () => {
        expect(outgoingSlugs('a', ['b', '', 'b', 'a', null, ' c '])).toEqual(['b', 'c']);
    });
    it('renvoie [] si le champ est absent', () => {
        expect(outgoingSlugs('a', null)).toEqual([]);
    });
});

describe('mergeRelated', () => {
    it('fusionne les deux sens sans doublon et trie du plus récent au plus ancien', () => {
        const out = [d('b', '2012-07-31'), d('c', '2020-06-24')];
        const inc = [d('c', '2020-06-24'), d('e', '2026-07-14'), d('a', '2000-01-01')];
        expect(mergeRelated('a', [out, inc]).map((x) => x.slug)).toEqual(['e', 'c', 'b']);
    });
    it('place les décisions sans date en dernier', () => {
        expect(mergeRelated('z', [[d('x', null), d('y', '2019-06-13')]]).map((x) => x.slug)).toEqual(['y', 'x']);
    });
});
