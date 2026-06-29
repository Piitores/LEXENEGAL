import { describe, it, expect } from 'vitest';
import { detectArticleRef, detectDecisionRef } from '../searchRefDetect';
import { buildCodeIndex } from '../articleRefResolver';

const codeIndex = buildCodeIndex(
  [
    { slug: 'ohada-droit-commercial-general', title: 'Acte uniforme révisé portant sur le droit commercial général', short_title: null },
    { slug: 'code-travail', title: 'Code du Travail', short_title: 'Code du Travail' },
  ],
  [{ alias: 'AUDCG', code_slug: 'ohada-droit-commercial-general' }],
);

describe('detectArticleRef', () => {
  it('article 24 AUDCG → code + numéro', () => {
    expect(detectArticleRef('article 24 AUDCG', codeIndex)).toEqual({
      codeSlug: 'ohada-droit-commercial-general',
      articleNumber: '24',
    });
  });
  it('null si pas de référence d’article', () => {
    expect(detectArticleRef('droit du travail', codeIndex)).toBeNull();
  });
  it('null si code hors corpus (AUPSRVE)', () => {
    expect(detectArticleRef('article 5 AUPSRVE', codeIndex)).toBeNull();
  });
  // Régression : nom de code EN CLAIR, sans « du » (« article L.97 code du travail »).
  it('article L.97 code du travail (nom en clair, sans « du ») → code-travail', () => {
    expect(detectArticleRef('article L.97 code du travail', codeIndex)).toEqual({
      codeSlug: 'code-travail',
      articleNumber: 'L.97',
    });
  });
  it('article L.97 du Code du travail (avec « du ») → code-travail', () => {
    expect(detectArticleRef('article L.97 du Code du travail', codeIndex)).toEqual({
      codeSlug: 'code-travail',
      articleNumber: 'L.97',
    });
  });
  it('numéro nu (« L.56 code du travail ») → code-travail', () => {
    expect(detectArticleRef('article L.56 code du travail', codeIndex)).toEqual({
      codeSlug: 'code-travail',
      articleNumber: 'L.56',
    });
  });
  it('null si nom de code en clair inconnu', () => {
    expect(detectArticleRef('article 5 code de la planète', codeIndex)).toBeNull();
  });
});

describe('detectDecisionRef', () => {
  it('arrêt 34 du 14 janvier 2005', () => {
    expect(detectDecisionRef('arrêt 34 du 14 janvier 2005')).toEqual({ number: '34', dateISO: '2005-01-14' });
  });
  it('arrêt n° 25 du 30 septembre 2013', () => {
    expect(detectDecisionRef('arrêt n° 25 du 30 septembre 2013')).toEqual({ number: '25', dateISO: '2013-09-30' });
  });
  it('date numérique seule', () => {
    expect(detectDecisionRef('décision du 14/01/2005')).toEqual({ dateISO: '2005-01-14' });
  });
  it('numéro composé sans date', () => {
    expect(detectDecisionRef('décision 12/E/2024')).toEqual({ number: '12/E/2024' });
  });
  it('null sans mot-clé décision', () => {
    expect(detectDecisionRef('contrat de travail 2005')).toBeNull();
  });
  it('null si mot-clé mais ni numéro ni date', () => {
    expect(detectDecisionRef('arrêt sur le licenciement')).toBeNull();
  });
  it('mois accentué (février)', () => {
    expect(detectDecisionRef('arrêt 7 du 3 février 2020')).toEqual({ number: '7', dateISO: '2020-02-03' });
  });
});
