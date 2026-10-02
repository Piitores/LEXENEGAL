import { describe, it, expect } from 'vitest';
import {
  normalizeToken,
  normalizeArticleNumber,
  indexerParNumero,
  buildCodeIndex,
  buildSuccessions,
  codePourDecision,
  parseCitedString,
  resolveCitedString,
  construireIndexRenvoi,
  resoudreRenvoi,
  datesNonRepris,
  dateCitationCarte,
  type ResolvedArticle,
  type LigneConcordance,
} from '../articleRefResolver';

const LAWS = [
  { slug: 'code-travail', title: 'Code du Travail', short_title: 'Code du Travail' },
  { slug: 'cocc', title: 'Code des obligations civiles et commerciales', short_title: null },
  { slug: 'ohada-droit-commercial-general', title: 'Acte uniforme révisé portant sur le droit commercial général', short_title: null },
  { slug: 'code-penal', title: 'Code Pénal', short_title: null },
];
// Alias d'acronymes désormais fournis par l'appelant (vue DB `code_aliases` en prod).
const ALIASES = [
  { alias: 'AUDCG', code_slug: 'ohada-droit-commercial-general' },
  { alias: 'COCC', code_slug: 'cocc' },
  { alias: 'CP', code_slug: 'code-penal' },
];
const codeIndex = buildCodeIndex(LAWS, ALIASES);

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

describe('indexerParNumero', () => {
  // Code pénal, dans l'ordre de lecture (display_order, puis id) : le corps du code (rangs 40 et
  // 50) précède l'annexe III sur la cryptologie (rangs 60003 et 60004), qui reprend les numéros.
  const CODE_PENAL = [
    { slug: 'annexe2-art-4', article_number: '4' },
    { slug: 'annexe2-art-5', article_number: '5' },
    { slug: 'annexe-iii-art-4', article_number: '4' },
    { slug: 'annexe-iii-art-5', article_number: '5' },
  ];

  it('à numéro égal, le premier lu l’emporte : le corps du code, pas l’annexe', () => {
    const index = indexerParNumero(CODE_PENAL);
    expect(index.get('5')?.slug).toBe('annexe2-art-5');
    expect(index.get('4')?.slug).toBe('annexe2-art-4');
    expect(index.size).toBe(2);
  });

  it('clé = numéro normalisé (« L. 56 » et « L.56 » ne font qu’un)', () => {
    const index = indexerParNumero([
      { slug: 'article-l56', article_number: 'L. 56' },
      { slug: 'article-l56-bis', article_number: 'L.56' },
    ]);
    expect(index.get('L56')?.slug).toBe('article-l56');
  });
});

describe('buildCodeIndex', () => {
  it('mappe les acronymes OHADA et les noms de code', () => {
    expect(codeIndex.get('AUDCG')).toBe('ohada-droit-commercial-general');
    expect(codeIndex.get(normalizeToken('Code du travail'))).toBe('code-travail');
  });

  it('à titre égal, le texte en vigueur l’emporte sur celui qu’il a abrogé, quel que soit l’ordre', () => {
    // Jeu d'essai neutre : depuis la fusion des codes 2026, aucun texte en base ne partage plus son titre.
    const idx = buildCodeIndex([
      { slug: 'reglement-ancien', title: 'Règlement des marchés', short_title: 'Règlement des marchés de 1990 (abrogé)', abrogated_by_slug: 'reglement-nouveau' },
      { slug: 'reglement-nouveau', title: 'Règlement des marchés', short_title: 'Règlement des marchés' },
    ]);
    expect(idx.get(normalizeToken('Règlement des marchés'))).toBe('reglement-nouveau');
    expect(idx.get(normalizeToken('Règlement des marchés de 1990 (abrogé)'))).toBe('reglement-ancien');
  });
});

describe('codePourDecision', () => {
  // Succession réelle en base : l'arrêté général n° 5254 du 19 juillet 1954 (travail des femmes)
  // abrogé et remplacé par le décret n° 2021-1469 du 3 novembre 2021.
  const ARRETE = 'arrete-general-n5254-i-g-t-l-s-a-o-f-du-19-juillet-1954-relatif';
  const DECRET = 'decret-2021-1469-travail-femmes-enceintes';
  const successions = buildSuccessions([
    { slug: ARRETE, abrogated_by_slug: DECRET, publication_date: '1954-07-19' },
    { slug: DECRET, abrogated_by_slug: null, publication_date: '2021-11-03' },
  ]);

  it('une décision antérieure au nouveau texte vise l’ancien, sans repli vers le récent', () => {
    expect(codePourDecision(DECRET, '2015-06-10', successions)).toEqual({ code: ARRETE });
  });

  it('une décision postérieure vise le texte en vigueur, avec l’ancien en repli', () => {
    expect(codePourDecision(DECRET, '2022-10-01', successions)).toEqual({ code: DECRET, repli: ARRETE });
  });

  it('date inconnue : prudence, le texte ancien', () => {
    expect(codePourDecision(DECRET, null, successions)).toEqual({ code: ARRETE });
  });

  it('un code sans prédécesseur est inchangé', () => {
    expect(codePourDecision('cocc', '2015-06-10', successions)).toEqual({ code: 'cocc' });
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
  it('numéros composés : « L.29-1 », « L.76 bis » (et « BIS » n’est pas pris pour le sigle)', () => {
    expect(parseCitedString('Article L.29-1 du Code du travail')[0].articleNumber).toBe('L.29-1');
    expect(parseCitedString('ART L.76 BIS CT')).toEqual([{ articleNumber: 'L.76BIS', codeToken: 'CT' }]);
    const r = parseCitedString('Article L.85 bis du Code du travail');
    expect(r).toHaveLength(1);
    expect(r[0].articleNumber).toBe('L.85bis');
    expect(normalizeArticleNumber(r[0].articleNumber)).toBe(normalizeArticleNumber('L.85 bis'));
    expect(parseCitedString('ARTICLE 3 AUDCG')).toEqual([{ articleNumber: '3', codeToken: 'AUDCG' }]);
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

/*
 * Fusion des codes 2026 (décisions du propriétaire du 02/10/2026) : un seul Code du travail, dont
 * l'ancienne numérotation (1997, « L.56 ») passe par la concordance PAR SUJET. L.56 a pour
 * successeurs l'art. 137 (principal) et l'art. 138 (secondaire) ; L.10 n'est pas repris (il reste
 * comme article abrogé, ligne « identite »). L'art. 56 de 2026 traite d'un autre sujet.
 */
describe('resoudreRenvoi', () => {
  type A = { id: string; slug: string; article_number: string };
  const CT: A[] = [
    { id: 'a56', slug: 'art-56', article_number: '56' },
    { id: 'a137', slug: 'art-137', article_number: '137' },
    { id: 'a138', slug: 'art-138', article_number: '138' },
    { id: 'l10', slug: 'article-l10', article_number: 'L.10.' },
  ];
  const ligne = (ancien_numero: string, ancien_norm: string, role: string, article_id: string): LigneConcordance => ({
    ancien_numero, ancien_norm, ancien_slug: `article-${ancien_norm.toLowerCase()}`, role,
    statut: role === 'identite' ? 'non_repris' : 'repris', en_vigueur_jusqu_au: '2026-09-03',
    numerotation_depuis: '1997-12-01', article_id,
  });
  const CONC_CT = [
    ligne('L.56.', 'L56', 'secondaire', 'a138'),
    ligne('L.56.', 'L56', 'principal', 'a137'),
    ligne('L.57.', 'L57', 'secondaire', 'a138'),
    ligne('L.10.', 'L10', 'identite', 'l10'),
    ligne('L.29-1.', 'L29-1', 'principal', 'a138'),
    ligne('L.76 bis', 'L76BIS', 'principal', 'a137'),
  ];
  const idx = construireIndexRenvoi(CT, CONC_CT, 'code-travail');
  const cible = (numero: string, date?: string | null) => {
    const r = resoudreRenvoi({ numero, date }, idx);
    return r ? { slug: r.article.slug, query: r.query } : null;
  };

  it('index : bascule et début de numérotation tirés de la concordance', () => {
    expect(idx.bascule).toBe('2026-09-03');
    expect(idx.numerotationDepuis).toBe('1997-12-01');
    expect(idx.ancien.get('L56')?.slug).toBe('art-137'); // le principal, jamais le secondaire
    expect(idx.ancien.has('L57')).toBe(false); // secondaire seul : pas de cible
    expect(idx.actuel.has('L10')).toBe(false); // ancien article non repris exclu de l'actuel
  });

  it('décision antérieure à la bascule : ancienne numérotation, adresse datée', () => {
    expect(cible('L.56', '2015-03-04')).toEqual({ slug: 'art-137', query: { ancien: 'L56', date: '2015-03-04' } });
    // Numéro nu dans un arrêt de 2021 : « article 56 du Code du travail » = L.56, pas l'art. 56 de 2026.
    expect(cible('56', '2021-07-27')).toEqual({ slug: 'art-137', query: { ancien: 'L56', date: '2021-07-27' } });
    expect(cible('L.10', '2015-03-04')).toEqual({ slug: 'article-l10', query: { ancien: 'L10', date: '2015-03-04' } });
  });

  it('numéros composés : « L.29-1 » et « L.76 bis » ne sont pas lus L.29 et L.76', () => {
    expect(cible('L.29-1', '2010-01-01')?.slug).toBe('art-138');
    expect(cible('L.76 bis', '2010-01-01')).toEqual({ slug: 'art-137', query: { ancien: 'L76BIS', date: '2010-01-01' } });
    expect(cible('L.29', '2010-01-01')).toBeNull();
  });

  it('date antérieure à la numérotation de 1997 : pas de lien (code non transposable)', () => {
    expect(cible('201', '1972-07-12')).toBeNull();
    expect(cible('L.56', '1990-01-01')).toBeNull();
  });

  it('date inconnue : « L. » par l’ancien index (sans date), numéro nu par l’actuel', () => {
    expect(cible('L.56', null)).toEqual({ slug: 'art-137', query: { ancien: 'L56' } });
    expect(cible('56', null)).toEqual({ slug: 'art-56', query: {} });
  });

  it('après la bascule : numérotation 2026 d’abord, « L. » introuvable par l’ancien index', () => {
    expect(cible('56', '2027-01-15')).toEqual({ slug: 'art-56', query: {} });
    expect(cible('L.56', '2027-01-15')).toEqual({ slug: 'art-137', query: { ancien: 'L56', date: '2027-01-15' } });
    expect(cible('L.10', '2027-01-15')).toEqual({ slug: 'article-l10', query: { ancien: 'L10', date: '2027-01-15' } });
    expect(cible('999', '2027-01-15')).toBeNull();
  });

  it('numéro absent de l’ancienne numérotation : pas de lien', () => {
    expect(cible('L.999', '2015-01-01')).toBeNull();
    expect(cible('L.57', '2015-01-01')).toBeNull();
  });

  it('CSS : même numérotation nue en 1973 et en 2026, la date tranche', () => {
    const CSS = [{ id: 'c65', slug: 'art-65', article_number: '65' }, { id: 'c90', slug: 'art-90', article_number: '90' }];
    const conc = [{ ...ligne('65', '65', 'principal', 'c90'), numerotation_depuis: '1973-07-31' }];
    const i = construireIndexRenvoi(CSS, conc, 'code-securite-sociale-senegal');
    expect(resoudreRenvoi({ numero: '65', date: '2016-03-16' }, i)).toEqual({ article: CSS[1], query: { ancien: '65', date: '2016-03-16' } });
    expect(resoudreRenvoi({ numero: '65', date: '2027-03-16' }, i)).toEqual({ article: CSS[0], query: {} });
  });

  it('concordance vide : comportement d’avant la fusion (index actuel, date ignorée)', () => {
    const CT_1997 = [{ id: 'x', slug: 'article-l56', article_number: 'L.56.' }];
    const i = construireIndexRenvoi(CT_1997, [], 'code-travail');
    expect(resoudreRenvoi({ numero: 'L.56', date: '2015-01-01' }, i)).toEqual({ article: CT_1997[0], query: {} });
    expect(resoudreRenvoi({ numero: 'L.56', date: null }, construireIndexRenvoi(CT_1997, undefined))).toEqual({ article: CT_1997[0], query: {} });
  });

  it('concordance illisible : aucun lien pour un code refondu, inchangé pour les autres', () => {
    expect(resoudreRenvoi({ numero: 'L.56', date: '2015-01-01' }, construireIndexRenvoi(CT, null, 'code-travail'))).toBeNull();
    const CP = [{ id: 'p5', slug: 'annexe2-art-5', article_number: '5' }, { id: 'p5b', slug: 'annexe-iii-art-5', article_number: '5' }];
    expect(resoudreRenvoi({ numero: '5', date: '2015-01-01' }, construireIndexRenvoi(CP, null, 'code-penal'))?.article.slug).toBe('annexe2-art-5');
  });

  it('sans index : pas de lien', () => {
    expect(resoudreRenvoi({ numero: '5' }, undefined)).toBeNull();
  });
});

/*
 * Page d'un code refondu (relecture du 02/10/2026). Cas vérifié en base : l'Annexe II de l'ancien
 * CSS (non reprise, slug annexe-ii) cite « l'article 143 du code de la sécurité sociale » ; l'ancien
 * art. 143 (barème des cotisations AT/MP) a pour successeur l'art. 74 de 2026 (« Fixation des taux de
 * cotisation ») ; l'art. 143 de 2026 traite de l'indemnité journalière. Après la migration, l'Annexe
 * II reste dans le code 2026 (publication 2026-09-03), rédigée dans l'ANCIENNE numérotation.
 */
describe('dateCitationCarte (page d’un code refondu)', () => {
  type A = { id: string; slug: string; article_number: string; status?: string | null };
  const CSS: A[] = [
    { id: 'c74', slug: 'art-74', article_number: '74' },
    { id: 'c143', slug: 'art-143', article_number: '143' },
    { id: 'ann2', slug: 'annexe-ii', article_number: 'Annexe II', status: 'abrogé' },
  ];
  const ligne = (ancien_numero: string, ancien_norm: string, role: string, article_id: string): LigneConcordance => ({
    ancien_numero, ancien_norm, ancien_slug: `article-${ancien_norm.toLowerCase()}`, role,
    statut: role === 'identite' ? 'non_repris' : 'repris', en_vigueur_jusqu_au: '2026-09-03',
    numerotation_depuis: '1973-07-31', article_id,
  });
  const CONC = [ligne('143', '143', 'principal', 'c74'), ligne('Annexe II', 'ANNEXEII', 'identite', 'ann2')];
  const idx = construireIndexRenvoi(CSS, CONC, 'code-securite-sociale-senegal');
  const PUBLICATION = '2026-09-03';

  it('datesNonRepris : veille de la bascule pour chaque ligne « identite » ; null si illisible', () => {
    expect(datesNonRepris(CONC)).toEqual(new Map([['ann2', '2026-09-02']]));
    expect(datesNonRepris([])).toEqual(new Map());
    expect(datesNonRepris(undefined)).toEqual(new Map());
    expect(datesNonRepris(null)).toBeNull();
    // Bascule illisible : la ligne est ignorée (date de publication par défaut).
    expect(datesNonRepris([{ ...CONC[1], en_vigueur_jusqu_au: null }])).toEqual(new Map());
  });

  it('Annexe II : « article 143 » mène à l’art. 74 (successeur de l’ancien 143), pas à l’art. 143 de 2026', () => {
    const c = dateCitationCarte(CSS[2], PUBLICATION, datesNonRepris(CONC));
    expect(c).toEqual({ date: '2026-09-02', renvoisRefondus: true });
    expect(resoudreRenvoi({ numero: '143', date: c.date }, idx)).toEqual({
      article: CSS[0], query: { ancien: '143', date: '2026-09-02' },
    });
    // Le défaut corrigé : datée de la publication du code 2026, la citation passait par l'index actuel.
    expect(resoudreRenvoi({ numero: '143', date: PUBLICATION }, idx)?.article.slug).toBe('art-143');
  });

  it('article 2026 : date de publication du texte, numérotation actuelle', () => {
    const c = dateCitationCarte(CSS[1], PUBLICATION, datesNonRepris(CONC));
    expect(c).toEqual({ date: PUBLICATION, renvoisRefondus: true });
    expect(resoudreRenvoi({ numero: '143', date: c.date }, idx)?.article.slug).toBe('art-143');
  });

  it('concordance vide (avant la migration) ou code non refondu : comportement d’avant', () => {
    expect(dateCitationCarte(CSS[2], '1997-03-10', new Map())).toEqual({ date: '1997-03-10', renvoisRefondus: true });
    expect(dateCitationCarte({ id: 'x' }, null, new Map())).toEqual({ date: null, renvoisRefondus: true });
    expect(dateCitationCarte({ id: 'x' }, undefined, new Map())).toEqual({ date: null, renvoisRefondus: true });
  });

  it('concordance illisible : pas de lien vers les codes refondus depuis un article abrogé', () => {
    expect(dateCitationCarte(CSS[2], PUBLICATION, null)).toEqual({ date: PUBLICATION, renvoisRefondus: false });
    expect(dateCitationCarte({ id: 'y', is_active: false }, PUBLICATION, null)).toEqual({ date: PUBLICATION, renvoisRefondus: false });
    expect(dateCitationCarte(CSS[1], PUBLICATION, null)).toEqual({ date: PUBLICATION, renvoisRefondus: true });
  });
});
