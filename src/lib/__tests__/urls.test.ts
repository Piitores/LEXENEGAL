import { describe, it, expect } from 'vitest';
import { estConvention, segmentConvention, slugDepuisSegmentCcn, urlTexte, urlArticle } from '../urls';

describe('adresses publiques des textes', () => {
  it('les conventions collectives vivent sous /ccn/, sans le préfixe « ccn- »', () => {
    expect(urlTexte('ccn-banques')).toBe('/ccn/banques');
    expect(urlArticle('ccn-banques', 'art-12')).toBe('/ccn/banques/art-12');
    expect(urlTexte('ccni-2019')).toBe('/ccn/ccni-2019');
  });

  it('les autres textes restent sous /code/', () => {
    expect(urlTexte('code-travail-2026')).toBe('/code/code-travail-2026');
    expect(urlArticle('code-penal', 'art-14')).toBe('/code/code-penal/art-14');
    expect(estConvention('code-assurances-cima')).toBe(false);
  });

  it('le segment d’adresse et le slug se correspondent dans les deux sens', () => {
    for (const slug of ['ccn-banques', 'ccn-transports-aeriens-1965', 'ccni-2019']) {
      expect(slugDepuisSegmentCcn(segmentConvention(slug))).toBe(slug);
    }
  });
});
