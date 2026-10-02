import { describe, it, expect, vi, beforeAll, afterAll, afterEach } from 'vitest';
import { createHash } from 'node:crypto';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import * as site from '../versionsArticle';

/*
 * Fusion des codes 2026 (décisions du propriétaire du 02/10/2026) : le choix de la version d'un article
 * (contrat §3) est recopié dans api/render.js, fonction Vercel qui ne peut pas importer le module
 * TypeScript du site. Ce test vérifie (1) que la copie suit les cas du contrat, (2) qu'elle répond
 * exactement comme src/lib/versionsArticle.ts, (3) les règles propres au rendu serveur (concordance,
 * anciens articles non repris, liens de décisions), et surtout qu'une concordance VIDE ne change rien,
 * (4) le handler entier (statut, en-têtes, corps, requêtes), Supabase simulé, sorties d'avant la fusion
 * FIGÉES (relecture du 02/10/2026 : les auto-comparaisons ne prouvaient rien).
 */
const charger = (fichier: string): Promise<any> =>
    import(/* @vite-ignore */ decodeURIComponent(new URL(`../../../api/${fichier}`, import.meta.url).pathname));

type V = site.VersionArticle;
const v = (id: string, effective_date: string, o: Partial<V> = {}): V => ({
    id, content: `<p>${id}</p>`, effective_date, expiration_date: null, is_current: false,
    ancien_numero: null, version_note: null, ...o,
});
// Article 137 de 2026 : reprend L.56 (principal, éclaté avec l'art. 138) et L.57.
const V2026 = v('v2026', '2026-09-03', { is_current: true });
// Expiration manquante sur la première version de L.56 : sa fin est la version suivante de sa chaîne.
const L56_1997 = v('l56-1997', '1997-12-01', { ancien_numero: 'L.56.', version_note: 'Ancien article L.56' });
const L56_2015 = v('l56-2015', '2015-02-12', { ancien_numero: 'L.56.', expiration_date: '2026-09-03' });
const L57 = v('l57', '1997-12-01', { ancien_numero: 'L.57.', expiration_date: '2026-09-03' });
const ART_137 = [V2026, L56_2015, L56_1997, L57];
// Article 3 : cinq prédécesseurs en vigueur sur le même intervalle (reçus dans le désordre).
const ART_3 = [
    v('v3', '2026-09-03', { is_current: true }),
    ...['L.41.', 'L.36.', 'L.6.', 'L.3.', 'L.2.'].map((n) => v(n, '1997-12-01', { ancien_numero: n, expiration_date: '2026-09-03' })),
];
const ids = (vs: V[]) => vs.map((x) => x.id);

// Jeux de paramètres croisés pour la comparaison des deux copies.
const PARAMS = [
    null, { date: null, ancien: null },
    { ancien: 'L56', date: '2015-03-04' }, { ancien: 'L56', date: null }, { ancien: 'L56', date: '1990-01-01' },
    { ancien: 'L56', date: '2027-01-01' }, { ancien: 'L56', date: '2015-02-12' }, { ancien: 'L56', date: '2015-02-11' },
    { ancien: 'L57', date: '2001-01-01' }, { ancien: 'L999', date: '2010-01-01' }, { ancien: 'L999', date: null },
    { ancien: 'L.56.', date: null }, { ancien: 'l56', date: '2015-03-04' },
    { date: '2010-05-01', ancien: null }, { date: '2027-01-01', ancien: null }, { date: '1990-01-01', ancien: null },
    { date: '2026-09-02', ancien: null }, { date: '2026-09-03', ancien: null }, { date: '2015-02-30', ancien: null },
    { date: '2000-01-01', ancien: 'L36' }, { date: '2000-01-01', ancien: '3' }, { date: '2010-01-01', ancien: 'L10' },
];
const ARTICLES: Array<[V[], string | undefined]> = [
    [ART_137, '137'], [ART_137, undefined], [ART_3, '3'], [[], '1'],
    [[v('l10', '1997-12-01', { is_current: true, ancien_numero: 'L.10.' })], 'L.10.'],
    [[v('l10', '1997-12-01', { is_current: true })], 'L.10.'],
    [[v('cgi-2018', '2018-01-01', { is_current: true }), v('cgi-2013', '2013-01-01')], '12'],
    // Deux versions courantes à la même date (donnée défectueuse) : même départage des deux côtés.
    [[v('a', '2001-01-01', { is_current: true }), v('b', '2001-01-01', { is_current: true }), v('c', '1990-01-01')], '5'],
    // Trou dans une chaîne et chaîne close avant la courante.
    [[v('x1', '1997-12-01', { ancien_numero: 'L.9.', expiration_date: '2003-01-01' }),
        v('x2', '2005-01-01', { ancien_numero: 'L.9.', expiration_date: '2010-01-01' }),
        v('x3', '2026-09-03', { is_current: true })], '40'],
];

describe('copie de api/render.js : cas du contrat (§1 et §3)', () => {
    it('normAncien reproduit fn_norm_article', async () => {
        const api = await charger('render.js');
        expect(api.normAncien('L.56.')).toBe('L56');
        expect(api.normAncien('L76 bis')).toBe('L76BIS');
        expect(api.normAncien('L.29-1')).toBe('L29-1');
        expect(api.normAncien('premier')).toBe('1');
        expect(api.normAncien('182 (suite)')).toBe('182SUITE');
        expect(api.normAncien('Article premier')).toBe('1');
        expect(api.normAncien('Première')).toBe('1');
        expect(api.normAncien(null)).toBe('');
        expect(api.numeroAncienAffiche('L.56.')).toBe('L.56');
    });

    it('sans paramètre, ou paramètre faux : la version courante, sans bandeau', async () => {
        const api = await charger('render.js');
        for (const p of [null, { date: null, ancien: null }, { ancien: 'L999', date: '2010-01-01' }, { ancien: 'L999', date: null }, { date: '2015-02-30', ancien: null }]) {
            const c = api.choisirVersions(ART_137, p, '137');
            expect(ids(c.versions)).toEqual(['v2026']);
            expect(c).toMatchObject({ estActuelle: true, horsPeriode: null });
        }
        expect(api.choisirVersions([], { date: '2015-01-01', ancien: 'L56' })).toEqual({ versions: [], estActuelle: true, horsPeriode: null });
    });

    it('ancien + date : la version de la chaîne en vigueur, sinon la plus proche (horsPeriode)', async () => {
        const api = await charger('render.js');
        const c = api.choisirVersions(ART_137, { ancien: 'L56', date: '2010-05-01' }, '137');
        expect(ids(c.versions)).toEqual(['l56-1997']);
        expect(c).toMatchObject({ estActuelle: false, horsPeriode: null });
        expect(api.choisirVersions(ART_137, { ancien: 'L56', date: '1990-01-01' }, '137')).toMatchObject({ versions: [L56_1997], horsPeriode: 'avant' });
        expect(api.choisirVersions(ART_137, { ancien: 'L56', date: '2027-01-01' }, '137')).toMatchObject({ versions: [L56_2015], horsPeriode: 'apres' });
        // Sans date : la dernière version de la chaîne.
        expect(api.choisirVersions(ART_137, { ancien: 'L56', date: null }, '137')).toMatchObject({ versions: [L56_2015], estActuelle: false, horsPeriode: null });
    });

    it('date seule : une version par prédécesseur, ordre des dates puis des numéros ; après la bascule, la courante', async () => {
        const api = await charger('render.js');
        expect(ids(api.choisirVersions(ART_137, { date: '2010-05-01', ancien: null }, '137').versions)).toEqual(['l56-1997', 'l57']);
        expect(ids(api.choisirVersions(ART_3, { date: '2000-01-01', ancien: null }, '3').versions)).toEqual(['L.2.', 'L.3.', 'L.6.', 'L.36.', 'L.41.']);
        expect(api.choisirVersions(ART_137, { date: '2027-01-01', ancien: null }, '137')).toMatchObject({ versions: [V2026], estActuelle: true });
        expect(api.choisirVersions(ART_137, { date: '1990-01-01', ancien: null }, '137')).toMatchObject({ versions: [L56_1997, L57], horsPeriode: 'avant' });
    });

    it('bandeau : les trois formes du contrat, et rien pour la version courante', async () => {
        const api = await charger('render.js');
        const bandeau = (p: any) => api.libelleBandeauVersion(api.choisirVersions(ART_137, p, '137'), p, ART_137, '137');
        expect(bandeau({ ancien: 'L56', date: '2015-03-04' })).toBe('Version en vigueur le 4 mars 2015 (ancien article L.56)');
        expect(bandeau({ ancien: 'L56', date: null })).toBe("Rédaction de l'ancien article L.56, en vigueur jusqu'au 2 septembre 2026");
        expect(bandeau({ ancien: 'L56', date: '1990-01-01' }))
            .toBe('Version la plus ancienne disponible, en vigueur à partir du 1er décembre 1997 (ancien article L.56)');
        expect(bandeau({ ancien: null, date: '2010-05-01' })).toBe('Version en vigueur le 1er mai 2010 (anciens articles L.56 et L.57)');
        expect(bandeau(null)).toBeNull();
    });
});

describe('copie de api/render.js identique à src/lib/versionsArticle.ts', () => {
    it('choisirVersions, versionCourante, finVersion et bandeau répondent pareil', async () => {
        const api = await charger('render.js');
        for (const [versions, numero] of ARTICLES) {
            expect(api.versionCourante(versions)).toBe(site.versionCourante(versions));
            for (const x of versions) expect(api.finVersion(x, versions, numero)).toBe(site.finVersion(x, versions, numero));
            for (const p of PARAMS) {
                const a = api.choisirVersions(versions, p, numero);
                const b = site.choisirVersions(versions, p as any, numero);
                expect(a).toEqual(b);
                expect(ids(a.versions)).toEqual(ids(b.versions));
                expect(api.libelleBandeauVersion(a, p, versions, numero)).toBe(site.libelleBandeauVersion(b, p as any, versions, numero));
            }
        }
    });

    it('normalisation, dates et libellés répondent pareil', async () => {
        const api = await charger('render.js');
        for (const n of ['L.56.', 'L76 bis', 'L.29-1', 'premier', '182 (suite)', 'Article L. 56', ' Art. L.56', 'art.premier',
            'Première', '1er', '1ère', 'Ier', 'artisan', '  article   12', 'expos-des-motifs', '12 alinéa 3', 'L.56-', 'Article', '', null, undefined]) {
            expect(api.normAncien(n)).toBe(site.normAncien(n));
            expect(api.numeroAncienAffiche(n)).toBe(site.numeroAncienAffiche(n));
        }
        for (const d of ['2015-03-04', '2016-02-29', '2015-02-30', '2015-13-01', '20150304', '2015-3-4', '', null]) {
            expect(api.estDateValide(d)).toBe(site.estDateValide(d));
        }
        for (const l of [[], ['138'], ['138', '139'], ['138', '139', '140']]) expect(api.listeFr(l)).toBe(site.listeFr(l));
        for (const n of [[], ['L.56'], ['L.56', 'L.57']]) expect(api.mentionAnciens(n)).toBe(site.mentionAnciens(n));
        for (const x of [L57, V2026]) expect(api.titreSectionVersion(x, 'Article 137')).toBe(site.titreSectionVersion(x, 'Article 137'));
        for (const r of ['Loi n° 2026-18 du 3 septembre 2026', 'Décret n° 2021-1469 du 3 novembre 2021', 'Ordonnance n° 1', 'Acte uniforme', '', null]) {
            expect(api.libelleNonRepris(r)).toBe(site.libelleNonRepris(r));
        }
    });
});

/* ---------- Règles propres au rendu serveur ---------- */
const ART = (slug: string, article_number: string, num: string) => ({ slug, article_number, num });
const ligne = (o: any) => ({ code_id: 'CT', en_vigueur_jusqu_au: '2026-09-03', numerotation_depuis: '1997-12-01', ...o });
const CONCORDANCE = [
    ligne({ ancien_numero: 'L.56.', ancien_norm: 'L56', ancien_slug: 'article-l56', article_id: 'a137', role: 'principal', statut: 'eclate', article: ART('art-137', '137', 'Article 137') }),
    ligne({ ancien_numero: 'L.56.', ancien_norm: 'L56', ancien_slug: 'article-l56', article_id: 'a138', role: 'secondaire', statut: 'eclate', article: ART('art-138', '138', 'Article 138') }),
    ligne({ ancien_numero: 'L.57.', ancien_norm: 'L57', ancien_slug: 'article-l57', article_id: 'a137', role: 'principal', statut: 'repris', article: ART('art-137', '137', 'Article 137') }),
    ligne({ ancien_numero: 'L.85 bis', ancien_norm: 'L85BIS', ancien_slug: 'code-travail-article-l85bis', article_id: 'a138', role: 'principal', statut: 'repris', article: ART('art-138', '138', 'Article 138') }),
    ligne({ ancien_numero: 'L.10.', ancien_norm: 'L10', ancien_slug: 'article-l10', article_id: 'al10', role: 'identite', statut: 'non_repris', article: ART('article-l10', 'L.10.', 'Article L.10 (Code de 1997)') }),
];
const LAW = { slug: 'code-travail', title: 'Code du Travail', short_title: 'Code du Travail', category: 'code', reference: 'Loi n° 2026-18 du 3 septembre 2026' };

describe('rendu serveur : concordance (articles et redirections)', () => {
    it('concordance vide ou illisible : aucun contexte de fusion, rien ne change', async () => {
        const api = await charger('render.js');
        expect(api.contexteFusion([])).toBeNull();
        expect(api.contexteFusion(null)).toBeNull();
        expect(api.cibleAncienSlug(null, 'article-l56')).toBeNull();
        expect(api.predecesseurs(null, 'a137')).toEqual([]);
        expect(api.fusionArticle({ fusion: null, law: LAW, art: { id: 'a137', slug: 'art-137' } })).toBeNull();
        expect(api.nombreArticlesEnVigueur([{ id: 'x' }, { id: 'y' }], null)).toBe(2);
    });

    it('contexte : anciens articles non repris, bascule, année de la numérotation d’origine', async () => {
        const api = await charger('render.js');
        const f = api.contexteFusion(CONCORDANCE);
        expect([...f.anciens]).toEqual(['al10']);
        expect(f).toMatchObject({ bascule: '2026-09-03', depuis: '1997-12-01', annee: '1997' });
        expect(api.nombreArticlesEnVigueur([{ id: 'a137' }, { id: 'a138' }, { id: 'al10' }], f)).toBe(2);
    });

    it('ancien slug repris ou éclaté : cible principale, ?ancien=<NORM> ; non repris : aucune redirection', async () => {
        const api = await charger('render.js');
        const f = api.contexteFusion(CONCORDANCE);
        expect(api.cibleAncienSlug(f, 'article-l56')).toEqual({ slug: 'art-137', ancien: 'L56' });
        expect(api.cibleAncienSlug(f, 'code-travail-article-l85bis')).toEqual({ slug: 'art-138', ancien: 'L85BIS' });
        expect(api.cibleAncienSlug(f, 'article-l10')).toBeNull();
        expect(api.cibleAncienSlug(f, 'art-137')).toBeNull();
    });

    it('paramètres d’adresse : absents, valides, ou invalides (301 vers la canonique)', async () => {
        const api = await charger('render.js');
        expect(api.lireParametresVersion({ type: 'article', code: 'code-travail', slug: 'art-137' })).toMatchObject({ present: false });
        expect(api.lireParametresVersion({ ancien: 'L56', date: '2015-03-04' })).toEqual({ present: true, valide: true, ancien: 'L56', date: '2015-03-04' });
        expect(api.lireParametresVersion({ date: '2015-03-04' })).toEqual({ present: true, valide: true, ancien: null, date: '2015-03-04' });
        for (const q of [{ date: '2015-02-30' }, { date: '' }, { ancien: 'l56' }, { ancien: 'L.56.' }, { ancien: '' }, { date: ['2015-03-04', '2016-01-01'] }]) {
            expect(api.lireParametresVersion(q)).toMatchObject({ present: true, valide: false });
        }
    });
});

describe('rendu serveur : page d’un article de code fusionné', () => {
    it('article 2026 : « Correspond aux anciens articles… », liens ?ancien=, mots-clés', async () => {
        const api = await charger('render.js');
        const f = api.contexteFusion(CONCORDANCE);
        const fa = api.fusionArticle({ fusion: f, law: LAW, art: { id: 'a137', slug: 'art-137', article_number: '137', num: 'Article 137' } });
        expect(fa.ancien).toBeNull();
        expect(fa.h1).toBeNull();
        expect(fa.avantTitre).toBe('');
        expect(fa.apresTitre).toContain('Correspond aux anciens articles <a href="/code/code-travail/art-137?ancien=L56">L.56</a> (en partie) et <a href="/code/code-travail/art-137?ancien=L57">L.57</a> du Code du Travail de 1997.');
        expect(fa.motsCles).toBe('article L.56 Code du Travail 1997, article L.57 Code du Travail 1997');
        // Un seul prédécesseur (sans la ligne L.85 bis) : singulier.
        const f1 = api.contexteFusion(CONCORDANCE.filter((l) => l.ancien_norm !== 'L85BIS'));
        const un = api.fusionArticle({ fusion: f1, law: LAW, art: { id: 'a138', slug: 'art-138', article_number: '138', num: 'Article 138' } });
        expect(un.apresTitre).toContain('Correspond à l\'ancien article <a href="/code/code-travail/art-138?ancien=L56">L.56</a> (en partie) du Code du Travail de 1997.');
    });

    it('version datée : bandeau du contrat, lien vers la version actuelle, autre successeur daté', async () => {
        const api = await charger('render.js');
        const f = api.contexteFusion(CONCORDANCE);
        const art = { id: 'a137', slug: 'art-137', article_number: '137', num: 'Article 137' };
        const params = { ancien: 'L56', date: '2015-03-04' };
        const choix = api.choisirVersions(ART_137, params, '137');
        const fa = api.fusionArticle({ fusion: f, law: LAW, art, choix, params, versions: ART_137 });
        expect(fa.avantTitre).toContain('>Version en vigueur le 4 mars 2015 (ancien article L.56) - <a href="/code/code-travail/art-137">voir la version actuelle</a></div>');
        expect(fa.avantTitre).toContain('Le texte de l\'ancien article L.56 est aussi repris à l\'<a href="/code/code-travail/art-138?ancien=L56&amp;date=2015-03-04">article 138</a>.');
        expect(fa.contenu).toBe('<p>l56-2015</p>');
        // Plusieurs prédécesseurs : une section par version, titrée « Ancien article L.x ».
        const tous = api.fusionArticle({ fusion: f, law: LAW, art, choix: api.choisirVersions(ART_137, { date: '2010-05-01' }, '137'), params: { date: '2010-05-01' }, versions: ART_137 });
        expect(tous.contenu).toContain('<h2>Ancien article L.56</h2>');
        expect(tous.contenu).toContain('<h2>Ancien article L.57</h2>');
        expect(tous.avantTitre).toContain('(anciens articles L.56 et L.57)');
    });

    it('ancien article non repris : titre et H1 « (abrogé) », bandeau tiré des données, jamais des notes', async () => {
        const api = await charger('render.js');
        const f = api.contexteFusion(CONCORDANCE);
        const art = { id: 'al10', slug: 'article-l10', article_number: 'L.10.', num: 'Article L.10 (Code de 1997)', notes: 'Absent de la source MJ initiale' };
        const fa = api.fusionArticle({ fusion: f, law: LAW, art });
        expect(fa.h1).toBe('Article L.10 du Code de 1997 (abrogé)');
        expect(fa.avantTitre).toContain('⛔ Article non repris par la loi n° 2026-18 du 3 septembre 2026 ; il reste consultable dans sa rédaction antérieure.');
        expect(fa.avantTitre).not.toContain('Absent');
        expect(fa.apresTitre).toBe('');
        const head = api.buildArticleHead(LAW, art, 'https://www.lexenegal.sn/code/code-travail/article-l10', 'Texte.', fa);
        expect(head).toContain('<title data-rh="true">Article L.10 du Code du Travail de 1997 (abrogé) | Lexenegal</title>');
        expect(head).toContain('"legislationLegalForce":"https://schema.org/NotInForce"');
        const body = api.buildArticleBody(LAW, art, '<p>Texte.</p>', [], [], {}, fa);
        expect(body).toContain('<h1>Article L.10 du Code de 1997 (abrogé)</h1>');
        expect(api.articleAncien({ id: 'al10', num: 'L.10.' }, f)).toEqual({ libelle: 'Article L.10', annee: '1997' });
    });

    /*
     * Sorties attendues FIGÉES sur celles de buildArticleHead et buildArticleBody avant la fusion (HEAD du
     * 02/10/2026, mêmes entrées) : comparer l'appel avec null à l'appel sans argument ne prouverait rien,
     * les deux suivent le même chemin.
     */
    it('sans contexte de fusion, en-tête et corps d’avant la fusion, à l’identique', async () => {
        const api = await charger('render.js');
        const art = { id: 'p5', slug: 'art-5', article_number: '5', num: 'Article 5' };
        const law = { slug: 'code-penal', title: 'Code Pénal', short_title: 'Code Pénal', category: 'code' };
        const canon = 'https://www.lexenegal.sn/code/code-penal/art-5';
        const ENTETE = [
            '',
            '  <title data-rh="true">Article 5 du Code Pénal du Sénégal | Lexenegal</title>',
            '  <meta data-rh="true" name="description" content="Article 5 du Code Pénal du Sénégal : Texte." />',
            '  <meta data-rh="true" name="keywords" content="Article 5, Code Pénal, Droit sénégalais, Lexenegal" />',
            '  <link data-rh="true" rel="canonical" href="https://www.lexenegal.sn/code/code-penal/art-5" />',
            '  <meta data-rh="true" name="geo.region" content="SN" />',
            '  <meta data-rh="true" name="language" content="fr" />',
            '  <meta data-rh="true" property="og:type" content="article" />',
            '  <meta data-rh="true" property="og:url" content="https://www.lexenegal.sn/code/code-penal/art-5" />',
            '  <meta data-rh="true" property="og:title" content="Article 5 du Code Pénal du Sénégal | Lexenegal" />',
            '  <meta data-rh="true" property="og:description" content="Article 5 du Code Pénal du Sénégal : Texte." />',
            '  <meta data-rh="true" property="og:image" content="https://www.lexenegal.sn/og-image.svg" />',
            '  <meta data-rh="true" property="og:locale" content="fr_SN" />',
            '  <meta data-rh="true" property="og:site_name" content="Lexenegal" />',
            '  <meta data-rh="true" property="twitter:card" content="summary_large_image" />',
            '  <meta data-rh="true" property="twitter:url" content="https://www.lexenegal.sn/code/code-penal/art-5" />',
            '  <meta data-rh="true" property="twitter:title" content="Article 5 du Code Pénal du Sénégal | Lexenegal" />',
            '  <meta data-rh="true" property="twitter:description" content="Article 5 du Code Pénal du Sénégal : Texte." />',
            '  <meta data-rh="true" property="twitter:image" content="https://www.lexenegal.sn/og-image.svg" />',
            '  <script type="application/ld+json">[{"@context":"https://schema.org","@type":"Legislation","name":"Article 5 - Code Pénal","legislationIdentifier":"5","inLanguage":"fr","isPartOf":{"@type":"Legislation","name":"Code Pénal","url":"https://www.lexenegal.sn/code/code-penal"},"legislationJurisdiction":{"@type":"AdministrativeArea","name":"Sénégal"},"url":"https://www.lexenegal.sn/code/code-penal/art-5"},{"@context":"https://schema.org","@type":"BreadcrumbList","itemListElement":[{"@type":"ListItem","position":1,"name":"Codes et textes","item":"https://www.lexenegal.sn/codes"},{"@type":"ListItem","position":2,"name":"Code Pénal","item":"https://www.lexenegal.sn/code/code-penal"},{"@type":"ListItem","position":3,"name":"Article 5","item":"https://www.lexenegal.sn/code/code-penal/art-5"}]}]</script>',
        ].join('\n');
        const CORPS = [
            '<div id="ssr-content" class="ssr-prerender"><article>',
            '    <nav class="ssr-bc" aria-label="Fil d\'Ariane"><a href="/code/code-penal">Code Pénal</a> › Article 5</nav>',
            '    ',
            '    <h1>Article 5</h1>',
            '    <div class="ssr-article-body"><p>T</p></div>',
            '    ',
            '    ',
            '  </article></div>',
        ].join('\n');
        expect(api.buildArticleHead(law, art, canon, 'Texte.', null)).toBe(ENTETE);
        expect(api.buildArticleHead(law, art, canon, 'Texte.')).toBe(ENTETE);
        expect(api.buildArticleBody(law, art, '<p>T</p>', [], [], {}, null)).toBe(CORPS);
        expect(api.buildArticleBody(law, art, '<p>T</p>', [], [], {})).toBe(CORPS);
    });
});

describe('rendu serveur : « Textes et articles cités » d’une décision', () => {
    const CODE_CT = { id: 'CT', slug: 'code-travail', title: 'Code du Travail' };
    const a137 = { slug: 'art-137', num: 'Article 137', num_court: 'Art. 137', article_number: '137', code: CODE_CT };
    const a138 = { slug: 'art-138', num: 'Article 138', num_court: 'Art. 138', article_number: '138', code: CODE_CT };
    const BASCULES = { CT: { bascule: '2026-09-03', depuis: '1997-12-01' } };

    it('lien ordinaire : libellé et adresse d’avant la fusion', async () => {
        const api = await charger('render.js');
        const cites = [
            { anciens_numeros: null, article: { slug: 'art-5', num: 'Article 5', article_number: '5', code: { slug: 'code-penal', title: 'Code Pénal' } } },
            { article: { slug: 'art-6', num: null, num_court: null, article_number: '6', code: { slug: 'code-penal', title: null } } },
            { article: null },
        ];
        expect(api.entreesArticlesCites(cites, '2015-03-04', {})).toEqual([
            { href: '/code/code-penal/art-5', label: 'Article 5 - Code Pénal' },
            { href: '/code/code-penal/art-6', label: 'Article 6 - ' },
        ]);
    });

    it('lien reporté : ancien numéro, lien daté si la décision précède la bascule, dédoublonné', async () => {
        const api = await charger('render.js');
        const cites = [
            { anciens_numeros: ['L.56.', 'L.57.'], article: a137 },
            { anciens_numeros: ['L.56.'], article: a138 },
            { anciens_numeros: ['L.56.'], article: a137 },
        ];
        expect(api.entreesArticlesCites(cites, '2015-03-04', BASCULES)).toEqual([
            { href: '/code/code-travail/art-137?ancien=L56&date=2015-03-04', label: "Article L.56 du Code du Travail de 1997, repris à l'article 137" },
            { href: '/code/code-travail/art-137?ancien=L57&date=2015-03-04', label: "Article L.57 du Code du Travail de 1997, repris à l'article 137" },
            { href: '/code/code-travail/art-138?ancien=L56&date=2015-03-04', label: "Article L.56 du Code du Travail de 1997, repris à l'article 138" },
        ]);
        // Décision sans date : ?ancien= seul ; décision postérieure à la bascule : adresse simple.
        expect(api.entreesArticlesCites([cites[1]], null, BASCULES)[0].href).toBe('/code/code-travail/art-138?ancien=L56');
        expect(api.entreesArticlesCites([cites[1]], '2026-10-01', BASCULES)[0].href).toBe('/code/code-travail/art-138');
        // Bascule illisible : jamais de lien mort, l'article sans paramètre.
        expect(api.entreesArticlesCites([cites[1]], '2015-03-04', {})).toEqual([
            { href: '/code/code-travail/art-138', label: "Article L.56 du Code du Travail, repris à l'article 138" },
        ]);
    });

    it('décision antérieure à la numérotation d’origine : numéro non transposable, pas de lien', async () => {
        const api = await charger('render.js');
        expect(api.entreesArticlesCites([{ anciens_numeros: ['L.56.'], article: a137 }], '1993-06-01', BASCULES))
            .toEqual([{ href: null, label: 'Article L.56 du Code du Travail' }]);
    });
});

/* ---------- Handler de api/render.js, Supabase simulé ---------- */
/*
 * Le handler entier (statut, en-têtes, corps), et pas seulement ses fonctions. Supabase est simulé par
 * un fetch qui lit un état AVANT (aujourd'hui, 02/10/2026 : concordance vide, le code de 1997 sous
 * code-travail, le code 2026 sous code-travail-2026) ou APRES (contrat §1). La coquille HTML est fixée
 * (dist/index.html d'un dossier temporaire) : le corps ne dépend pas du dernier build.
 */
type Ligne = Record<string, any>;
const COQUILLE = '<!doctype html><html lang="fr"><head><meta charset="utf-8" /><title>Lexenegal</title><meta name="description" content="Coquille" /></head><body><div id="app"></div></body></html>';
const PENAL = { id: 'CP', slug: 'code-penal', title: 'Code Pénal', short_title: 'Code Pénal', category: 'code', reference: 'Loi n° 65-60 du 21 juillet 1965', publication_date: '1965-07-21', description: null, abrogation_note: null, abrogated_by_slug: null, jo_numero: null, jo_date: null, jo_page: null };
const texteCT = (id: string, slug: string, short_title: string, reference: string, publication_date: string, o: Ligne = {}): Ligne => ({ id, slug, title: 'Code du Travail', short_title, category: 'code', reference, publication_date, description: null, abrogation_note: null, abrogated_by_slug: null, jo_numero: null, jo_date: null, jo_page: null, ...o });
const article = (id: string, code_id: string, slug: string, num: string, article_number: string, display_order: number, o: Ligne = {}): Ligne => ({ id, code_id, slug, num, num_court: null, article_number, display_order, node_id: null, content_html: `<p>Texte de ${slug}.</p>`, is_active: true, ...o });
const version = (id: string, content: string, effective_date: string, o: Ligne = {}): Ligne => ({ id, content, effective_date, expiration_date: null, is_current: false, ancien_numero: null, version_note: null, ...o });
const ARTICLES_PENAL = [
    article('p4', 'CP', 'art-4', 'Article 4', '4', 40),
    article('p5', 'CP', 'art-5', 'Article 5', '5', 50, { content_html: null }),
    article('p6', 'CP', 'art-6', 'Article 6', '6', 60),
];
// Art. 5 du Code pénal : texte tiré des versions (content_html vide), une rédaction antérieure close en 2016.
const VERSIONS_PENAL = {
    p5: [version('p5-2016', '<p>Rédaction actuelle de l’article 5.</p>', '2016-11-25', { is_current: true }),
        version('p5-1965', '<p>Rédaction de 1965.</p>', '1965-07-21', { expiration_date: '2016-11-25' })],
};
const CITANTES = [{ citation_text: 'article 5', decision: { reference: 'Arrêt n° 12', slug: 'cs-2015-12', date_decision: '2015-03-04', chambre: 'Chambre criminelle' } }];
interface Etat { laws: Ligne[]; articles: Ligne[]; versions: Record<string, Ligne[]>; conc: Ligne[] }
const AVANT: Etat = {
    laws: [PENAL,
        texteCT('CT97', 'code-travail', 'Code du Travail de 1997 (abrogé)', 'Loi n° 97-17 du 1er décembre 1997', '1997-12-01',
            { abrogated_by_slug: 'code-travail-2026', abrogation_note: 'Texte abrogé par la loi n° 2026-18 du 3 septembre 2026.' }),
        texteCT('CT26', 'code-travail-2026', 'Code du Travail', 'Loi n° 2026-18 du 3 septembre 2026', '2026-09-03')],
    articles: [...ARTICLES_PENAL,
        article('l56', 'CT97', 'article-l56', 'L.56.', 'L.56.', 56),
        article('l57', 'CT97', 'article-l57', 'L.57.', 'L.57.', 57),
        article('a137', 'CT26', 'art-137', 'Article 137', '137', 1370)],
    versions: VERSIONS_PENAL,
    conc: [],
};
const ligneCT = (o: Ligne): Ligne => ({ code_id: 'CT26', en_vigueur_jusqu_au: '2026-09-03', numerotation_depuis: '1997-12-01', ...o });
const APRES: Etat = {
    laws: [PENAL, texteCT('CT26', 'code-travail', 'Code du Travail', 'Loi n° 2026-18 du 3 septembre 2026', '2026-09-03')],
    articles: [...ARTICLES_PENAL,
        // Ancien article repris DÉSACTIVÉ au lieu d'être supprimé (écart au contrat : le filet doit tenir).
        article('l57x', 'CT26', 'article-l57', 'L.57.', 'L.57.', 57, { is_active: false }),
        article('a136', 'CT26', 'art-136', 'Article 136', '136', 1360),
        article('a137', 'CT26', 'art-137', 'Article 137', '137', 1370),
        article('a138', 'CT26', 'art-138', 'Article 138', '138', 1380),
        article('al10', 'CT26', 'article-l10', 'Article L.10 (Code de 1997)', 'L.10.', 100010)],
    versions: {
        ...VERSIONS_PENAL,
        a137: [version('v2026', '<p>Texte 2026 de l’article 137.</p>', '2026-09-03', { is_current: true }),
            version('l56-1997', '<p>Rédaction de l’ancien L.56.</p>', '1997-12-01', { ancien_numero: 'L.56.', expiration_date: '2026-09-03', version_note: 'Ancien article L.56' }),
            version('l57-1997', '<p>Rédaction de l’ancien L.57.</p>', '1997-12-01', { ancien_numero: 'L.57.', expiration_date: '2026-09-03', version_note: 'Ancien article L.57' })],
    },
    conc: [
        ligneCT({ ancien_numero: 'L.56.', ancien_norm: 'L56', ancien_slug: 'article-l56', article_id: 'a137', role: 'principal', statut: 'eclate', article: ART('art-137', '137', 'Article 137') }),
        ligneCT({ ancien_numero: 'L.56.', ancien_norm: 'L56', ancien_slug: 'article-l56', article_id: 'a138', role: 'secondaire', statut: 'eclate', article: ART('art-138', '138', 'Article 138') }),
        ligneCT({ ancien_numero: 'L.57.', ancien_norm: 'L57', ancien_slug: 'article-l57', article_id: 'a137', role: 'principal', statut: 'repris', article: ART('art-137', '137', 'Article 137') }),
        ligneCT({ ancien_numero: 'L.10.', ancien_norm: 'L10', ancien_slug: 'article-l10', article_id: 'al10', role: 'identite', statut: 'non_repris', article: ART('article-l10', 'L.10.', 'Article L.10 (Code de 1997)') }),
    ],
};

/*
 * fetch simulé. panne (table article_concordance seulement) : 'absente' = 404 (table inexistante),
 * 'reseau' = fetch rejeté. journal : adresses demandées (chemin et requête).
 */
type Panne = null | 'absente' | 'reseau';
function simuler(etat: Etat, journal: string[], panne: Panne) {
    return async (url: unknown) => {
        const u = new URL(String(url), 'https://sb.test');
        const table = u.pathname.replace(/^\/rest\/v1\//, '');
        const p = u.searchParams;
        const eq = (k: string) => (p.get(k) || '').replace(/^eq\./, '');
        journal.push(decodeURIComponent(u.pathname + u.search));
        const reponse = (rows: unknown, status = 200) => ({ ok: status < 400, status, json: async () => rows, text: async () => JSON.stringify(rows) });
        if (table === 'article_concordance') {
            if (panne === 'reseau') throw new TypeError('fetch failed');
            if (panne === 'absente') return reponse({ message: 'relation does not exist' }, 404);
            if (Number(p.get('offset') || 0) > 0) return reponse([]);
            return reponse(etat.conc.filter((l) => l.code_id === eq('code_id')));
        }
        if (table === 'laws_and_codes') return reponse(etat.laws.filter((l) => l.slug === eq('slug')));
        if (table === 'articles') {
            let liste = etat.articles.filter((a) => a.code_id === eq('code_id'));
            if (p.get('slug')) return reponse(liste.filter((a) => a.slug === eq('slug')));
            const ou = /display_order\.(lt|gt)\.(\d+)/.exec(p.get('or') || '');
            if (ou) {
                // Précédent / suivant : filtres id=in.(…) / id=not.in.(…) et is_active=eq.true honorés.
                const ordre = Number(ou[2]);
                liste = liste.filter((a) => (ou[1] === 'lt' ? a.display_order < ordre : a.display_order > ordre));
                const f = p.get('id');
                if (f) {
                    const ids = f.replace(/^(not\.)?in\.\(|\)$/g, '').split(',');
                    liste = liste.filter((a) => (f.startsWith('not.') ? !ids.includes(a.id) : ids.includes(a.id)));
                }
                if (p.get('is_active') === 'eq.true') liste = liste.filter((a) => a.is_active);
                liste.sort((a, b) => (ou[1] === 'lt' ? b.display_order - a.display_order : a.display_order - b.display_order));
                return reponse(liste.slice(0, 1));
            }
            if (Number(p.get('offset') || 0) > 0) return reponse([]);
            return reponse([...liste].sort((a, b) => a.display_order - b.display_order));
        }
        if (table === 'article_versions') return reponse(etat.versions[eq('article_id')] || []);
        if (table === 'decision_article_links') return reponse(CITANTES);
        return reponse([]);
    };
}

describe('handler de api/render.js (Supabase simulé)', () => {
    let dossierCoquille = '';
    const fetchOriginal = globalThis.fetch;
    beforeAll(() => {
        dossierCoquille = mkdtempSync(join(tmpdir(), 'lexenegal-coquille-'));
        mkdirSync(join(dossierCoquille, 'dist'));
        writeFileSync(join(dossierCoquille, 'dist', 'index.html'), COQUILLE);
    });
    afterAll(() => rmSync(dossierCoquille, { recursive: true, force: true }));
    afterEach(() => { globalThis.fetch = fetchOriginal; });

    const appel = async (etat: Etat, query: Record<string, string>, panne: Panne = null) => {
        const journal: string[] = [];
        globalThis.fetch = simuler(etat, journal, panne) as unknown as typeof fetch;
        const api = await charger('render.js');
        const res = {
            statusCode: 200, headers: {} as Record<string, string>, body: '',
            setHeader(k: string, v: string) { this.headers[k] = v; },
            end(b?: string) { this.body = b || ''; return this; },
        };
        // La coquille est lue une fois, dans process.cwd()/dist/index.html, puis gardée en mémoire.
        const cwd = vi.spyOn(process, 'cwd').mockReturnValue(dossierCoquille);
        try { await api.default({ query, headers: { host: 'test' }, url: '/api/render' }, res); } finally { cwd.mockRestore(); }
        return { statut: res.statusCode, entetes: res.headers, corps: res.body, journal };
    };
    const empreinte = (s: string) => createHash('sha256').update(s).digest('hex');
    const CACHE_PAGE = 'public, s-maxage=86400, stale-while-revalidate=604800';
    const HTML = 'text/html; charset=utf-8';
    const SITE = 'https://www.lexenegal.sn';
    const redirection = (location: string) => ({ Location: location, 'Cache-Control': 'public, max-age=3600, s-maxage=3600' });

    /*
     * Concordance vide (aujourd'hui) : réponses FIGÉES sur celles du handler avant la fusion (HEAD du
     * 02/10/2026, même simulation). Le corps de l'article 5 est écrit en entier ; pour les autres
     * adresses, son empreinte sha256.
     */
    const CORPS_PENAL_5 = [
        '<!doctype html><html lang="fr"><head><meta charset="utf-8" />',
        '  <title data-rh="true">Article 5 du Code Pénal du Sénégal | Lexenegal</title>',
        '  <meta data-rh="true" name="description" content="Article 5 du Code Pénal du Sénégal : Rédaction actuelle de l’article 5." />',
        '  <meta data-rh="true" name="keywords" content="Article 5, Code Pénal, Droit sénégalais, Lexenegal" />',
        '  <link data-rh="true" rel="canonical" href="https://www.lexenegal.sn/code/code-penal/art-5" />',
        '  <meta data-rh="true" name="geo.region" content="SN" />',
        '  <meta data-rh="true" name="language" content="fr" />',
        '  <meta data-rh="true" property="og:type" content="article" />',
        '  <meta data-rh="true" property="og:url" content="https://www.lexenegal.sn/code/code-penal/art-5" />',
        '  <meta data-rh="true" property="og:title" content="Article 5 du Code Pénal du Sénégal | Lexenegal" />',
        '  <meta data-rh="true" property="og:description" content="Article 5 du Code Pénal du Sénégal : Rédaction actuelle de l’article 5." />',
        '  <meta data-rh="true" property="og:image" content="https://www.lexenegal.sn/og-image.svg" />',
        '  <meta data-rh="true" property="og:locale" content="fr_SN" />',
        '  <meta data-rh="true" property="og:site_name" content="Lexenegal" />',
        '  <meta data-rh="true" property="twitter:card" content="summary_large_image" />',
        '  <meta data-rh="true" property="twitter:url" content="https://www.lexenegal.sn/code/code-penal/art-5" />',
        '  <meta data-rh="true" property="twitter:title" content="Article 5 du Code Pénal du Sénégal | Lexenegal" />',
        '  <meta data-rh="true" property="twitter:description" content="Article 5 du Code Pénal du Sénégal : Rédaction actuelle de l’article 5." />',
        '  <meta data-rh="true" property="twitter:image" content="https://www.lexenegal.sn/og-image.svg" />',
        '  <script type="application/ld+json">[{"@context":"https://schema.org","@type":"Legislation","name":"Article 5 - Code Pénal","legislationIdentifier":"5","inLanguage":"fr","isPartOf":{"@type":"Legislation","name":"Code Pénal","url":"https://www.lexenegal.sn/code/code-penal"},"legislationJurisdiction":{"@type":"AdministrativeArea","name":"Sénégal"},"url":"https://www.lexenegal.sn/code/code-penal/art-5"},{"@context":"https://schema.org","@type":"BreadcrumbList","itemListElement":[{"@type":"ListItem","position":1,"name":"Codes et textes","item":"https://www.lexenegal.sn/codes"},{"@type":"ListItem","position":2,"name":"Code Pénal","item":"https://www.lexenegal.sn/code/code-penal"},{"@type":"ListItem","position":3,"name":"Article 5","item":"https://www.lexenegal.sn/code/code-penal/art-5"}]}]</script>',
        '</head><body><div id="app"><div id="ssr-content" class="ssr-prerender"><article>',
        '    <nav class="ssr-bc" aria-label="Fil d\'Ariane"><a href="/code/code-penal">Code Pénal</a> › Article 5</nav>',
        '    ',
        '    <h1>Article 5</h1>',
        '    <div class="ssr-article-body"><p>Rédaction actuelle de l’article 5.</p></div>',
        '    <section class="ssr-citing"><h2>Décisions citant cet article</h2><ul><li><a href="/decision/cs-2015-12">Arrêt n° 12</a> - Chambre criminelle (4 mars 2015)</li></ul></section>',
        '    <nav class="ssr-artnav" aria-label="Article précédent et suivant"><a href="/code/code-penal/art-4" rel="prev">← Article 4</a> · <a href="/code/code-penal/art-6" rel="next">Article 6 →</a></nav>',
        '  </article></div></div></body></html>',
    ].join('\n');
    const FIGEES: Array<[string, Record<string, string>, number, Record<string, string>, string]> = [
        ['article daté d’un code non fusionné', { type: 'article', code: 'code-penal', slug: 'art-5', date: '2015-01-01' }, 200,
            { 'Content-Type': HTML, 'Cache-Control': CACHE_PAGE }, '12b135ec3a02348b26ae5c05c9cb521e6e6a85d3ff3a3913ef5d1df2a4662b80'],
        ['?ancien= ignoré hors fusion', { type: 'article', code: 'code-penal', slug: 'art-5', ancien: 'L56' }, 200,
            { 'Content-Type': HTML, 'Cache-Control': CACHE_PAGE }, '12b135ec3a02348b26ae5c05c9cb521e6e6a85d3ff3a3913ef5d1df2a4662b80'],
        ['page d’un code non fusionné', { type: 'code', slug: 'code-penal' }, 200,
            { 'Content-Type': HTML, 'Cache-Control': CACHE_PAGE }, 'de036303bc32a66908f6f6e0c959cf31405239164694bea7e02a00df950f4c8d'],
        ['ancien article de 1997, paramètres ignorés', { type: 'article', code: 'code-travail', slug: 'article-l56', ancien: 'L56', date: '2015-03-04' }, 200,
            { 'Content-Type': HTML, 'Cache-Control': CACHE_PAGE }, 'ddbac9b7700e3bac497addc0d0282ece86063194c653958670ba0a8468d25376'],
        ['code 1997 sous code-travail', { type: 'code', slug: 'code-travail' }, 200,
            { 'Content-Type': HTML, 'Cache-Control': CACHE_PAGE }, '4370b14447a58c9c900bdf7d3f22679e90c77b1ed883cdd11e619e90075c2e30'],
        // code-travail-2026 est AUJOURD'HUI le texte en vigueur : servi en 200, jamais redirigé.
        ['article du code 2026 sous code-travail-2026', { type: 'article', code: 'code-travail-2026', slug: 'art-137' }, 200,
            { 'Content-Type': HTML, 'Cache-Control': CACHE_PAGE }, '531a44df2ff3706e97e62d47e9be0da9428845a7b1b7591b0e1ba629a035ba4c'],
        ['code 2026 sous code-travail-2026', { type: 'code', slug: 'code-travail-2026', node: 'x' }, 200,
            { 'Content-Type': HTML, 'Cache-Control': CACHE_PAGE }, '81d3b41c2b206ca4469a9823ab4b7a6654d97a180f62cb6994e25d124a0c187c'],
        ['ancien slug préfixé : 301 vers le slug court', { type: 'article', code: 'code-travail', slug: 'code-travail-article-l56' }, 301,
            { Location: `${SITE}/code/code-travail/article-l56`, 'Cache-Control': 'public, s-maxage=86400' }, empreinte('')],
        ['article inconnu : coquille noindex', { type: 'article', code: 'code-travail', slug: 'article-l999' }, 200,
            { 'Content-Type': HTML, 'Cache-Control': 'public, s-maxage=60' }, 'eba2248df803a34814fe29aa7ed81d1ffb846541c96e1204de250e2ba0f7d674'],
    ];

    it('concordance vide : article d’un code non fusionné, ?date= ignoré, corps d’avant la fusion', async () => {
        const r = await appel(AVANT, { type: 'article', code: 'code-penal', slug: 'art-5', date: '2015-01-01' });
        expect(r.statut).toBe(200);
        expect(r.entetes).toEqual({ 'Content-Type': HTML, 'Cache-Control': CACHE_PAGE });
        expect(r.corps).toBe(CORPS_PENAL_5);
        expect(empreinte(r.corps)).toBe(FIGEES[0][4]);
    });

    /*
     * Requêtes d'avant la fusion (HEAD du 02/10/2026), FIGÉES : hors fusion, les seuls ajouts admis sont la
     * lecture de la concordance et la colonne is_active (lues, jamais utilisées sans concordance).
     */
    const sansAjoutsFusion = (journal: string[]) => journal
        .filter((a) => !a.startsWith('/rest/v1/article_concordance?'))
        .map((a) => a.replace(',display_order,is_active&', ',display_order&')
            .replace('select=id,num,num_court,article_number,slug,is_active&', 'select=num,num_court,article_number,slug&'));
    const LOI_PENAL = '/rest/v1/laws_and_codes?slug=eq.code-penal&select=id,title,short_title,category,slug,reference,publication_date,description,abrogation_note,abrogated_by_slug,jo_numero,jo_date,jo_page&limit=1';

    it('concordance vide : mêmes requêtes qu’avant la fusion, plus la seule lecture de la concordance', async () => {
        const art = await appel(AVANT, { type: 'article', code: 'code-penal', slug: 'art-5', date: '2015-01-01' });
        expect(sansAjoutsFusion(art.journal)).toEqual([
            LOI_PENAL,
            '/rest/v1/articles?code_id=eq.CP&slug=eq.art-5&select=id,num,num_court,article_number,slug,content_html,node_id,display_order&limit=1',
            // Aucune lecture des versions datées : le texte vient de la version courante, comme avant.
            '/rest/v1/article_versions?article_id=eq.p5&select=content,is_current&order=effective_date.desc&limit=5',
            '/rest/v1/decision_article_links?article_id=eq.p5&select=citation_text,decision:decisions(reference,slug,date_decision,chambre)&limit=20',
            '/rest/v1/articles?code_id=eq.CP&or=(display_order.lt.50,and(display_order.eq.50,id.lt.p5))&select=slug,num,num_court,article_number&order=display_order.desc,id.desc&limit=1',
            '/rest/v1/articles?code_id=eq.CP&or=(display_order.gt.50,and(display_order.eq.50,id.gt.p5))&select=slug,num,num_court,article_number&order=display_order.asc,id.asc&limit=1',
        ]);
        expect(art.journal.filter((a) => a.startsWith('/rest/v1/article_concordance?'))).toHaveLength(1);
        const code = await appel(AVANT, { type: 'code', slug: 'code-penal' });
        expect(sansAjoutsFusion(code.journal)).toEqual([
            LOI_PENAL,
            '/rest/v1/articles?code_id=eq.CP&select=num,num_court,article_number,slug&order=display_order,id&offset=0&limit=1000',
            '/rest/v1/legal_edge?relation=eq.lie_a&or=(src_id.eq.CP,dst_id.eq.CP)&select=src_id,dst_id',
        ]);
    });

    it('concordance vide : statut, en-têtes et corps identiques à ceux d’avant la fusion', async () => {
        for (const [nom, q, statut, entetes, sha] of FIGEES) {
            const r = await appel(AVANT, q);
            expect({ nom, statut: r.statut, entetes: r.entetes, sha: empreinte(r.corps) }).toEqual({ nom, statut, entetes, sha });
        }
    });

    it('concordance illisible : table absente, même réponse ; panne réseau, même page, cache court', async () => {
        for (const [nom, q, statut, entetes, sha] of FIGEES) {
            const absente = await appel(AVANT, q, 'absente');
            expect({ nom, statut: absente.statut, entetes: absente.entetes, sha: empreinte(absente.corps) }).toEqual({ nom, statut, entetes, sha });
            // Jamais de page cassée ; la page rendue sans concordance ne reste que 5 minutes au CDN.
            const reseau = await appel(AVANT, q, 'reseau');
            const attendus = entetes['Cache-Control'] === CACHE_PAGE ? { ...entetes, 'Cache-Control': 'public, s-maxage=300' } : entetes;
            expect({ nom, statut: reseau.statut, entetes: reseau.entetes, sha: empreinte(reseau.corps) }).toEqual({ nom, statut, entetes: attendus, sha });
        }
    });

    it('code fusionné : ancien slug, 301 en un seul saut vers le successeur principal (cache 1 h)', async () => {
        expect((await appel(APRES, { type: 'article', code: 'code-travail', slug: 'article-l56', date: '2015-03-04' })).entetes)
            .toEqual(redirection(`${SITE}/code/code-travail/art-137?ancien=L56&date=2015-03-04`));
        expect((await appel(APRES, { type: 'article', code: 'code-travail', slug: 'article-l56' })).entetes)
            .toEqual(redirection(`${SITE}/code/code-travail/art-137?ancien=L56`));
        // Date impossible : non reportée.
        expect((await appel(APRES, { type: 'article', code: 'code-travail', slug: 'article-l56', date: '2015-02-30' })).entetes)
            .toEqual(redirection(`${SITE}/code/code-travail/art-137?ancien=L56`));
    });

    it('code fusionné : ancien slug préfixé (ancien schéma), directement au successeur', async () => {
        const r = await appel(APRES, { type: 'article', code: 'code-travail', slug: 'code-travail-article-l56', date: '2015-03-04' });
        expect(r.statut).toBe(301);
        expect(r.entetes).toEqual(redirection(`${SITE}/code/code-travail/art-137?ancien=L56&date=2015-03-04`));
        // Ancien article non repris : il existe toujours, 301 vers son slug court comme avant.
        const l10 = await appel(APRES, { type: 'article', code: 'code-travail', slug: 'code-travail-article-l10' });
        expect(l10.entetes).toEqual({ Location: `${SITE}/code/code-travail/article-l10`, 'Cache-Control': 'public, s-maxage=86400' });
    });

    it('code fusionné : paramètre invalide ou sans version, ou version courante retenue, 301 vers l’adresse canonique', async () => {
        for (const q of [{ ancien: 'l56' }, { date: '2027-01-01' }, { date: '2015-02-30' }, { ancien: 'L999' }] as Array<Record<string, string>>) {
            const r = await appel(APRES, { type: 'article', code: 'code-travail', slug: 'art-137', ...q });
            expect({ q, statut: r.statut, entetes: r.entetes }).toEqual({ q, statut: 301, entetes: redirection(`${SITE}/code/code-travail/art-137`) });
        }
    });

    it('code fusionné : version datée en 200, bandeau, canonical sans paramètre', async () => {
        const r = await appel(APRES, { type: 'article', code: 'code-travail', slug: 'art-137', ancien: 'L56', date: '2015-03-04' });
        expect(r.statut).toBe(200);
        expect(r.entetes).toEqual({ 'Content-Type': HTML, 'Cache-Control': CACHE_PAGE });
        expect(r.corps).toContain('<link data-rh="true" rel="canonical" href="https://www.lexenegal.sn/code/code-travail/art-137" />');
        expect(r.corps).toContain('Version en vigueur le 4 mars 2015 (ancien article L.56) - <a href="/code/code-travail/art-137">voir la version actuelle</a>');
        expect(r.corps).toContain('<div class="ssr-article-body"><p>Rédaction de l’ancien L.56.</p></div>');
        expect(r.corps).not.toContain('noindex');
    });

    it('texte retiré absent de la base : 301 en un seul saut, chemin et paramètres conservés', async () => {
        expect((await appel(APRES, { type: 'article', code: 'code-travail-2026', slug: 'art-137', ancien: 'L56', date: '2015-03-04' })).entetes)
            .toEqual(redirection(`${SITE}/code/code-travail/art-137?ancien=L56&date=2015-03-04`));
        expect((await appel(APRES, { type: 'code', slug: 'code-travail-2026', node: 'Titre I' })).entetes)
            .toEqual(redirection(`${SITE}/code/code-travail?node=Titre+I`));
    });

    it('ancien article repris désactivé au lieu d’être supprimé : redirigé, hors sommaire, hors précédent/suivant', async () => {
        expect((await appel(APRES, { type: 'article', code: 'code-travail', slug: 'article-l57' })).entetes)
            .toEqual(redirection(`${SITE}/code/code-travail/art-137?ancien=L57`));
        const code = await appel(APRES, { type: 'code', slug: 'code-travail' });
        expect(code.corps).not.toContain('article-l57');
        expect(code.corps).toContain('3 articles, consultable');
        expect(code.corps).toContain('<h2>Articles du Code de 1997 non repris (1)</h2>');
        // Art. 136 (rang 1360) : sans le filtre, son précédent serait l'ancien L.57 (rang 57), qui redirige.
        const a136 = await appel(APRES, { type: 'article', code: 'code-travail', slug: 'art-136' });
        expect(a136.statut).toBe(200);
        expect(a136.corps).not.toContain('rel="prev"');
        expect(a136.corps).toContain('<a href="/code/code-travail/art-137" rel="next">Article 137 →</a>');
        expect(a136.journal.filter((a) => a.includes('or=(display_order')).every((a) => a.includes('&id=not.in.(al10)&is_active=eq.true'))).toBe(true);
    });
});
