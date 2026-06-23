import { describe, it, expect } from 'vitest';
import {
  normalizeToken,
  normalizeArticleNumber,
  buildCodeIndex,
  parseCitedString,
  resolveCitedString,
  type ResolvedArticle,
} from '../articleRefResolver';

const LAWS = [
  { slug: 'code-travail', title: 'Code du Travail', short_title: 'Code du Travail' },
  { slug: 'cocc', title: 'Code des obligations civiles et commerciales', short_title: null },
  { slug: 'ohada-droit-commercial-general', title: 'Acte uniforme révisé portant sur le droit commercial général', short_title: null },
  { slug: 'code-penal', title: 'Code Pénal', short_title: null },
];
const codeIndex = buildCodeIndex(LAWS);

const ARTICLES: ResolvedArticle[] = [
  { id: 'a1', slug: 'article-l56', article_number: 'L.56', code_slug: 'code-travail', code_name: 'Code du Travail' },
  { id: 'a2', slug: 'art-3-au-dcg', article_number: '3', code_slug: 'ohada-droit-commercial-general', code_name: 'AUDCG' },
];
const lookup = (codeSlug: string, num: string): ResolvedArticle | null =>
  ARTICLES.find(
    (a) => a.code_slug === codeSlug && normalizeArticleNumber(a.article_number) === normalizeArticleNumber(num),
  ) || null;

describe('normalizeArticleNumber', () => {
  it('nettoie préfixe/espaces', () => {
    expect(normalizeArticleNumber('Article L. 56')).toBe('L56');
    expect(normalizeArticleNumber('L.56')).toBe('L56');
    expect(normalizeArticleNumber(' 3 ')).toBe('3');
  });
});

describe('buildCodeIndex', () => {
  it('mappe les acronymes OHADA et les noms de code', () => {
    expect(codeIndex.get('AUDCG')).toBe('ohada-droit-commercial-general');
    expect(codeIndex.get(normalizeToken('Code du travail'))).toBe('code-travail');
  });
});

describe('parseCitedString', () => {
  it('acronyme : "ARTICLE 3 AUDCG"', () => {
    expect(parseCitedString('ARTICLE 3 AUDCG')).toEqual([{ articleNumber: '3', codeToken: 'AUDCG' }]);
  });
  it('nom de code : "Article L.56 du Code du travail"', () => {
    const r = parseCitedString('Article L.56 du Code du travail');
    expect(r).toHaveLength(1);
    expect(r[0].articleNumber).toBe('L.56');
    expect(normalizeToken(r[0].codeToken)).toBe(normalizeToken('Code du travail'));
  });
  it('multi-réfs détectées (≥2)', () => {
    expect(parseCitedString('ARTICLE 49 AUPSRVE ARTICLE 166 AUPSRVE').length).toBeGreaterThan(1);
  });
  it('loi entière sans article → 0 réf', () => {
    expect(parseCitedString('Loi n°61-34 du 15 juin 1961')).toEqual([]);
  });
});

describe('resolveCitedString', () => {
  it('LIEN : ref propre + article présent (acronyme)', () => {
    const r = resolveCitedString('ARTICLE 3 AUDCG', codeIndex, lookup);
    expect(r.kind).toBe('link');
    if (r.kind === 'link') expect(r.article.slug).toBe('art-3-au-dcg');
  });
  it('LIEN : "Article L.56 du Code du travail"', () => {
    const r = resolveCitedString('Article L.56 du Code du travail', codeIndex, lookup);
    expect(r.kind).toBe('link');
    if (r.kind === 'link') expect(r.article.code_slug).toBe('code-travail');
  });
  it('TEXTE : code hors corpus (AUPSRVE)', () => {
    expect(resolveCitedString('ARTICLE 12 AUPSRVE', codeIndex, lookup).kind).toBe('text');
  });
  it('TEXTE : plusieurs réfs (sécurité)', () => {
    expect(resolveCitedString('ARTICLE 49 AUPSRVE ARTICLE 166 AUPSRVE', codeIndex, lookup).kind).toBe('text');
  });
  it('TEXTE : loi entière', () => {
    expect(resolveCitedString('Loi n°61-34 du 15 juin 1961', codeIndex, lookup).kind).toBe('text');
  });
  it('TEXTE : article absent en base', () => {
    expect(resolveCitedString('ARTICLE 999 AUDCG', codeIndex, lookup).kind).toBe('text');
  });
  it('conserve le libellé original comme label', () => {
    const r = resolveCitedString('ARTICLE 3 AUDCG', codeIndex, lookup);
    expect(r.label).toBe('ARTICLE 3 AUDCG');
  });
});
