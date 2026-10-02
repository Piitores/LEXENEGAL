import { describe, it, expect } from 'vitest';
import {
    normAncien, numeroAncienAffiche, estDateValide, dateLongue, dateCourte, veille,
    lireParamsVersion, requeteVersion, versionCourante, finVersion, choisirVersions,
    listeFr, mentionAnciens, libelleBandeauVersion, libelleVersionComparateur, titreSectionVersion,
    referenceCopie, libelleNonRepris, libellePeriode, autresSuccesseurs, dateCitationVersion,
    anciensNumerosCites, type VersionArticle,
} from '../versionsArticle';

/*
 * Fusion des codes 2026 (décisions du propriétaire du 02/10/2026) : l'article 137 du Code du
 * travail de 2026 reprend le sujet des anciens L.56 (principal) et L.57. Ses versions : la version
 * 2026 (courante) et les copies des versions anciennes, distinguées par `ancien_numero`.
 */
const v = (id: string, effective_date: string, o: Partial<VersionArticle> = {}): VersionArticle => ({
    id, content: `<p>${id}</p>`, effective_date, expiration_date: null, is_current: false,
    ancien_numero: null, version_note: null, ...o,
});

const V2026 = v('v2026', '2026-09-03', { is_current: true });
// Expiration MANQUANTE sur la première version de L.56 : sa fin est la version suivante de sa chaîne.
const L56_1997 = v('l56-1997', '1997-12-01', { ancien_numero: 'L.56.', version_note: 'Ancien article L.56' });
const L56_2015 = v('l56-2015', '2015-02-12', { ancien_numero: 'L.56.', expiration_date: '2026-09-03' });
const L57 = v('l57', '1997-12-01', { ancien_numero: 'L.57.', expiration_date: '2026-09-03' });
// Ordre de la base : effective_date décroissante.
const ART_137 = [V2026, L56_2015, L56_1997, L57];

const ids = (vs: VersionArticle[]) => vs.map((x) => x.id);

describe('normAncien (copie de fn_norm_article)', () => {
    it('reproduit les exemples du contrat', () => {
        expect(normAncien('L.56.')).toBe('L56');
        expect(normAncien('L76 bis')).toBe('L76BIS');
        expect(normAncien('L.29-1')).toBe('L29-1');
        expect(normAncien('premier')).toBe('1');
        expect(normAncien('182 (suite)')).toBe('182SUITE');
    });

    it('reproduit la base sur les cas limites (vérifiés par SELECT le 02/10/2026)', () => {
        expect(normAncien('Article L. 56')).toBe('L56');
        expect(normAncien(' Art. L.56')).toBe('L56');
        expect(normAncien('art.premier')).toBe('1');
        expect(normAncien('Première')).toBe('1');
        expect(normAncien('1er')).toBe('1');
        expect(normAncien('1ère')).toBe('1RE');
        expect(normAncien('Ier')).toBe('1');
        expect(normAncien('artisan')).toBe('ISAN');
        expect(normAncien('  article   12')).toBe('12');
        expect(normAncien('expos-des-motifs')).toBe('EXPOS-DES-MOTIFS');
        expect(normAncien('12 alinéa 3')).toBe('12ALINA3');
        expect(normAncien('L.56-')).toBe('L56-');
        expect(normAncien('Article')).toBe('');
        expect(normAncien('')).toBe('');
        expect(normAncien(null)).toBe('');
        expect(normAncien(undefined)).toBe('');
    });

    it('numéro affiché sans point final', () => {
        expect(numeroAncienAffiche('L.56.')).toBe('L.56');
        expect(numeroAncienAffiche('40')).toBe('40');
        expect(numeroAncienAffiche(null)).toBe('');
    });
});

describe('dates', () => {
    it('valide une date réelle au format AAAA-MM-JJ', () => {
        expect(estDateValide('2015-03-04')).toBe(true);
        expect(estDateValide('2016-02-29')).toBe(true);
        expect(estDateValide('2015-02-30')).toBe(false);
        expect(estDateValide('2015-13-01')).toBe(false);
        expect(estDateValide('20150304')).toBe(false);
        expect(estDateValide('2015-3-4')).toBe(false);
        expect(estDateValide(null)).toBe(false);
    });

    it('formats français et veille', () => {
        expect(dateLongue('2015-03-04')).toBe('4 mars 2015');
        expect(dateLongue('1997-12-01')).toBe('1er décembre 1997');
        expect(dateCourte('1997-12-01')).toBe('01/12/1997');
        expect(veille('2026-09-03')).toBe('2026-09-02');
        expect(veille('2024-03-01')).toBe('2024-02-29');
        expect(veille('2026-01-01')).toBe('2025-12-31');
    });
});

describe('lireParamsVersion', () => {
    it('lit la date et l’ancien numéro normalisé', () => {
        expect(lireParamsVersion('?ancien=L56&date=2015-03-04')).toEqual({ date: '2015-03-04', ancien: 'L56' });
        expect(lireParamsVersion('date=2015-03-04&ancien=L.56.')).toEqual({ date: '2015-03-04', ancien: 'L56' });
        expect(lireParamsVersion('?ancien=premier')).toEqual({ date: null, ancien: '1' });
    });

    it('paramètres faux ou absents : ignorés', () => {
        expect(lireParamsVersion('')).toEqual({ date: null, ancien: null });
        expect(lireParamsVersion('?node=Titre%20I')).toEqual({ date: null, ancien: null });
        expect(lireParamsVersion('?date=2015-02-30')).toEqual({ date: null, ancien: null });
        expect(lireParamsVersion('?date=04/03/2015')).toEqual({ date: null, ancien: null });
        expect(lireParamsVersion('?ancien=&date=')).toEqual({ date: null, ancien: null });
        expect(lireParamsVersion('?ancien=...')).toEqual({ date: null, ancien: null });
    });
});

describe('requeteVersion', () => {
    it('construit ?ancien=<NORM>&date=<AAAA-MM-JJ>, paramètres facultatifs', () => {
        expect(requeteVersion({ ancien: 'L56', date: '2015-03-04' })).toBe('?ancien=L56&date=2015-03-04');
        expect(requeteVersion({ ancien: 'L.56.' })).toBe('?ancien=L56');
        expect(requeteVersion({ date: '2015-03-04' })).toBe('?date=2015-03-04');
        expect(requeteVersion({ ancien: null, date: '2015-02-30' })).toBe('');
        expect(requeteVersion(null)).toBe('');
    });

    it('aller-retour avec lireParamsVersion', () => {
        const p = { ancien: 'L76BIS', date: '2010-01-05' };
        expect(lireParamsVersion(requeteVersion(p))).toEqual(p);
    });
});

describe('versionCourante (comportement d’avant la fusion)', () => {
    it('la plus récente des is_current, sinon la plus récente', () => {
        expect(versionCourante(ART_137)?.id).toBe('v2026');
        expect(versionCourante([L56_1997, L56_2015])?.id).toBe('l56-2015');
        const deuxCourantes = [v('a', '2001-01-01', { is_current: true }), v('b', '2010-01-01', { is_current: true })];
        expect(versionCourante(deuxCourantes)?.id).toBe('b');
        expect(versionCourante([])).toBeNull();
    });
});

describe('finVersion', () => {
    it('expiration_date, sinon version suivante de la même chaîne, sinon +infini (null)', () => {
        expect(finVersion(L56_2015, ART_137)).toBe('2026-09-03');
        expect(finVersion(L56_1997, ART_137)).toBe('2015-02-12');
        expect(finVersion(V2026, ART_137, '137')).toBeNull();
    });

    it('une version d’une AUTRE chaîne ne ferme pas l’intervalle', () => {
        const sansExpiration = v('l57-bis', '1997-12-01', { ancien_numero: 'L.57.' });
        expect(finVersion(sansExpiration, [V2026, sansExpiration, L56_2015], '137')).toBeNull();
    });
});

describe('choisirVersions', () => {
    it('cas 1 : sans paramètre, la version courante', () => {
        const c = choisirVersions(ART_137, { date: null, ancien: null }, '137');
        expect(ids(c.versions)).toEqual(['v2026']);
        expect(c).toMatchObject({ estActuelle: true, horsPeriode: null });
    });

    it('ancien + date : la version de la chaîne en vigueur à la date (fin implicite)', () => {
        const c = choisirVersions(ART_137, { ancien: 'L56', date: '2010-05-01' }, '137');
        expect(ids(c.versions)).toEqual(['l56-1997']);
        expect(c).toMatchObject({ estActuelle: false, horsPeriode: null });
        expect(ids(choisirVersions(ART_137, { ancien: 'L56', date: '2015-02-12' }, '137').versions)).toEqual(['l56-2015']);
        expect(ids(choisirVersions(ART_137, { ancien: 'L56', date: '2015-02-11' }, '137').versions)).toEqual(['l56-1997']);
    });

    it('ancien + date avant la chaîne : la première version, horsPeriode « avant »', () => {
        const c = choisirVersions(ART_137, { ancien: 'L56', date: '1990-01-01' }, '137');
        expect(ids(c.versions)).toEqual(['l56-1997']);
        expect(c).toMatchObject({ estActuelle: false, horsPeriode: 'avant' });
    });

    it('ancien + date après la chaîne : la dernière version, horsPeriode « apres »', () => {
        const c = choisirVersions(ART_137, { ancien: 'L56', date: '2027-01-01' }, '137');
        expect(ids(c.versions)).toEqual(['l56-2015']);
        expect(c).toMatchObject({ estActuelle: false, horsPeriode: 'apres' });
    });

    it('ancien sans date : la dernière version de la chaîne', () => {
        const c = choisirVersions(ART_137, { ancien: 'L56', date: null }, '137');
        expect(ids(c.versions)).toEqual(['l56-2015']);
        expect(c).toMatchObject({ estActuelle: false, horsPeriode: null });
    });

    it('paramètre faux (chaîne vide) : cas 1, sans bandeau, même avec une date', () => {
        for (const p of [{ ancien: 'L999', date: '2010-01-01' }, { ancien: 'L999', date: null }]) {
            const c = choisirVersions(ART_137, p, '137');
            expect(ids(c.versions)).toEqual(['v2026']);
            expect(c).toMatchObject({ estActuelle: true, horsPeriode: null });
        }
    });

    it('date fausse : ignorée', () => {
        expect(choisirVersions(ART_137, { date: '2015-02-30', ancien: null }, '137').estActuelle).toBe(true);
    });

    it('date seule : une version par chaîne (plusieurs prédécesseurs), triées par date puis numéro', () => {
        const c = choisirVersions(ART_137, { date: '2010-05-01', ancien: null }, '137');
        expect(ids(c.versions)).toEqual(['l56-1997', 'l57']);
        expect(c).toMatchObject({ estActuelle: false, horsPeriode: null });
    });

    it('date seule postérieure à la bascule : la seule retenue est la courante, cas 1', () => {
        const c = choisirVersions(ART_137, { date: '2027-01-01', ancien: null }, '137');
        expect(ids(c.versions)).toEqual(['v2026']);
        expect(c).toMatchObject({ estActuelle: true, horsPeriode: null });
    });

    it('date seule sans version en vigueur : la plus proche, horsPeriode', () => {
        const c = choisirVersions(ART_137, { date: '1990-01-01', ancien: null }, '137');
        expect(ids(c.versions)).toEqual(['l56-1997', 'l57']);
        expect(c.horsPeriode).toBe('avant');
    });

    it('plusieurs prédécesseurs : ordre naturel des numéros (L.2, L.3, L.6, L.36, L.41)', () => {
        const art3 = [
            v('v3', '2026-09-03', { is_current: true }),
            ...['L.41.', 'L.36.', 'L.6.', 'L.3.', 'L.2.'].map((n) =>
                v(n, '1997-12-01', { ancien_numero: n, expiration_date: '2026-09-03' })),
        ];
        const c = choisirVersions(art3, { date: '2000-01-01', ancien: null }, '3');
        expect(ids(c.versions)).toEqual(['L.2.', 'L.3.', 'L.6.', 'L.36.', 'L.41.']);
    });

    it('ancien numéro absent de la version : la chaîne de l’article lui-même (ancien article non repris)', () => {
        const l10 = v('l10', '1997-12-01', { is_current: true });
        const c = choisirVersions([l10], { ancien: 'L10', date: '2010-01-01' }, 'L.10.');
        expect(ids(c.versions)).toEqual(['l10']);
        expect(c.estActuelle).toBe(true);
    });

    it('chaîne de l’article lui-même : une ancienne rédaction datée est affichée avec son bandeau', () => {
        const anc = v('cgi-2013', '2013-01-01');
        const cour = v('cgi-2018', '2018-01-01', { is_current: true });
        const c = choisirVersions([cour, anc], { date: '2015-06-01', ancien: null }, '12');
        expect(ids(c.versions)).toEqual(['cgi-2013']);
        expect(c).toMatchObject({ estActuelle: false, horsPeriode: null });
    });

    it('aucune version : liste vide, affichage actuel', () => {
        expect(choisirVersions([], { date: '2015-01-01', ancien: 'L56' })).toEqual({ versions: [], estActuelle: true, horsPeriode: null });
    });
});

describe('libellés', () => {
    it('bandeau : les trois formes du contrat', () => {
        const date = { ancien: 'L56', date: '2015-03-04' };
        expect(libelleBandeauVersion(choisirVersions(ART_137, date, '137'), date, ART_137, '137'))
            .toBe('Version en vigueur le 4 mars 2015 (ancien article L.56)');
        const sansDate = { ancien: 'L56', date: null };
        expect(libelleBandeauVersion(choisirVersions(ART_137, sansDate, '137'), sansDate, ART_137, '137'))
            .toBe("Rédaction de l'ancien article L.56, en vigueur jusqu'au 2 septembre 2026");
        const avant = { ancien: 'L56', date: '1990-01-01' };
        expect(libelleBandeauVersion(choisirVersions(ART_137, avant, '137'), avant, ART_137, '137'))
            .toBe('Version la plus ancienne disponible, en vigueur à partir du 1er décembre 1997 (ancien article L.56)');
    });

    it('bandeau : après la chaîne, plusieurs prédécesseurs, version courante', () => {
        const apres = { ancien: 'L56', date: '2027-01-01' };
        expect(libelleBandeauVersion(choisirVersions(ART_137, apres, '137'), apres, ART_137, '137'))
            .toBe("Rédaction de l'ancien article L.56, en vigueur jusqu'au 2 septembre 2026");
        const plusieurs = { ancien: null, date: '2010-05-01' };
        expect(libelleBandeauVersion(choisirVersions(ART_137, plusieurs, '137'), plusieurs, ART_137, '137'))
            .toBe('Version en vigueur le 1er mai 2010 (anciens articles L.56 et L.57)');
        expect(libelleBandeauVersion(choisirVersions(ART_137, null, '137'), null, ART_137, '137')).toBeNull();
    });

    it('listes et mentions', () => {
        expect(listeFr(['138'])).toBe('138');
        expect(listeFr(['138', '139', '140'])).toBe('138, 139 et 140');
        expect(mentionAnciens(['L.56'])).toBe("l'ancien article L.56");
        expect(mentionAnciens(['L.56', 'L.57'])).toBe('les anciens articles L.56 et L.57');
        expect(mentionAnciens([])).toBe('');
    });

    it('sélecteur du comparateur : la note, à défaut l’ancien numéro', () => {
        expect(libelleVersionComparateur(L56_1997)).toBe('Ancien article L.56 - version du 01/12/1997');
        expect(libelleVersionComparateur(L57)).toBe('Ancien article L.57 - version du 01/12/1997');
        expect(libelleVersionComparateur(v('l87', '1997-12-01', { ancien_numero: 'L.87.', lien_ancien: 'numero',
            version_note: 'Ancien article L.87 (même numéro)' }))).toBe('Ancien article L.87 (même numéro) - version du 01/12/1997');
        expect(libelleVersionComparateur(v('x', '2013-01-01'))).toBe('Version du 01/01/2013');
        expect(titreSectionVersion(L57, 'Article 137')).toBe('Ancien article L.57');
        expect(titreSectionVersion(V2026, 'Article 137')).toBe('Article 137');
    });

    it('copie : la référence dit la version copiée, l’adresse porte ses paramètres', () => {
        const p = { ancien: 'L56', date: '2015-03-04' };
        expect(referenceCopie('Article 137', choisirVersions(ART_137, p, '137'), p, ART_137, '137')).toEqual({
            num: 'Article 137 (version en vigueur le 4 mars 2015, ancien art. L.56)',
            requete: '?ancien=L56&date=2015-03-04',
        });
        expect(referenceCopie('Article 137', choisirVersions(ART_137, null, '137'), null, ART_137, '137'))
            .toEqual({ num: 'Article 137', requete: '' });
    });

    it('ancien article non repris : texte tiré de la référence du texte', () => {
        expect(libelleNonRepris('Loi n° 2026-18 du 3 septembre 2026'))
            .toBe('Article non repris par la loi n° 2026-18 du 3 septembre 2026 ; il reste consultable dans sa rédaction antérieure.');
        expect(libelleNonRepris('Décret n° 2021-1469 du 3 novembre 2021'))
            .toBe('Article non repris par le décret n° 2021-1469 du 3 novembre 2021 ; il reste consultable dans sa rédaction antérieure.');
        expect(libelleNonRepris(null))
            .toBe('Article non repris par le texte en vigueur ; il reste consultable dans sa rédaction antérieure.');
    });

    it('période d’une version', () => {
        expect(libellePeriode(L56_1997, ART_137, '137')).toBe('En vigueur du 1er décembre 1997 au 11 février 2015');
        expect(libellePeriode(L57, ART_137, '137')).toBe('En vigueur du 1er décembre 1997 au 2 septembre 2026');
        expect(libellePeriode(V2026, ART_137, '137')).toBe('En vigueur depuis le 3 septembre 2026');
    });

    it('autres successeurs d’un ancien article affiché (concordance par sujet)', () => {
        const lignes = [
            { ancien_norm: 'L56', role: 'principal', article_id: 'a137', article: { slug: 'art-137', article_number: '137' } },
            { ancien_norm: 'L56', role: 'secondaire', article_id: 'a138', article: { slug: 'art-138', article_number: '138' } },
            { ancien_norm: 'L57', role: 'principal', article_id: 'a137', article: { slug: 'art-137', article_number: '137' } },
            { ancien_norm: 'L10', role: 'identite', article_id: 'l10', article: { slug: 'article-l10', article_number: 'L.10.' } },
        ];
        expect(autresSuccesseurs(lignes, [L56_2015], 'a137')).toEqual([
            { ancienAffiche: 'L.56', ancienNorm: 'L56', articles: [{ slug: 'art-138', article_number: '138' }] },
        ]);
        // Vu depuis l'article 138 : le principal est l'« autre » successeur.
        expect(autresSuccesseurs(lignes, [L56_2015], 'a138')[0].articles).toEqual([{ slug: 'art-137', article_number: '137' }]);
        expect(autresSuccesseurs(lignes, [L57], 'a137')).toEqual([]);
        expect(autresSuccesseurs(lignes, [V2026], 'a137')).toEqual([]);
    });
});

/*
 * Relecture du 02/10/2026 : date des citations d'une version affichée, et anciens numéros d'une
 * décision sur la page d'un ancien article non repris.
 */
describe('dateCitationVersion', () => {
    const DEBUT_CT = '1997-12-01';

    it('version reprise d’un ancien article : sa date d’effet', () => {
        expect(dateCitationVersion(L56_2015, '2026-09-03', DEBUT_CT)).toBe('2015-02-12');
        expect(dateCitationVersion(L56_1997, '2026-09-03', DEBUT_CT)).toBe('1997-12-01');
    });

    it('jamais avant le début de l’ancienne numérotation (L.279 et L.69 datées du 30/11/1997)', () => {
        const l279 = v('l279', '1997-11-30', { ancien_numero: 'L.279.' });
        expect(dateCitationVersion(l279, '2026-09-03', DEBUT_CT)).toBe('1997-12-01');
        // Début inconnu (concordance illisible) : la date d'effet telle quelle.
        expect(dateCitationVersion(l279, '2026-09-03', '')).toBe('1997-11-30');
        expect(dateCitationVersion(l279, '2026-09-03', null)).toBe('1997-11-30');
    });

    it('horodatage ISO ramené au jour', () => {
        expect(dateCitationVersion(v('x', '2015-02-12T00:00:00+00:00', { ancien_numero: 'L.56.' }), null, DEBUT_CT)).toBe('2015-02-12');
    });

    it('version de l’article lui-même : date de publication du texte (comportement d’avant)', () => {
        expect(dateCitationVersion(V2026, '2026-09-03', DEBUT_CT)).toBe('2026-09-03');
        expect(dateCitationVersion(V2026, null, DEBUT_CT)).toBeNull();
        expect(dateCitationVersion(V2026, undefined, DEBUT_CT)).toBeNull();
    });
});

describe('anciensNumerosCites', () => {
    it('écarte le numéro de l’article affiché (ancien article non repris)', () => {
        expect(anciensNumerosCites(['L.10.'], 'L.10.')).toEqual([]);
        expect(anciensNumerosCites(['L.10'], 'L.10.')).toEqual([]);
        expect(anciensNumerosCites(['13'], '13')).toEqual([]);
    });

    it('garde les anciens numéros d’un article 2026', () => {
        expect(anciensNumerosCites(['L.56.'], '137')).toEqual(['L.56.']);
        expect(anciensNumerosCites(['L.2.', 'L.3.'], '3')).toEqual(['L.2.', 'L.3.']);
        expect(anciensNumerosCites(['143'], '74')).toEqual(['143']);
    });

    it('valeurs vides ou absentes ignorées', () => {
        expect(anciensNumerosCites(['', null, undefined, 'L.56.'], '137')).toEqual(['L.56.']);
        expect(anciensNumerosCites(null, '137')).toEqual([]);
        expect(anciensNumerosCites(['L.56.'], null)).toEqual(['L.56.']);
    });
});

describe('copies « même numéro » (comparateur seulement, décision du 02/10/2026)', () => {
    // Art. 87 de 2026 : reprend le SUJET de l'ancien L.93 ; l'ancien L.87 (autre sujet) n'est copié
    // que pour la comparaison.
    const V87 = v('v87', '2026-09-03', { is_current: true });
    const L93 = v('l93', '1997-12-01', { ancien_numero: 'L.93.', expiration_date: '2026-09-03', lien_ancien: 'sujet' });
    const L87 = v('l87', '1997-12-01', { ancien_numero: 'L.87.', expiration_date: '2026-09-03', lien_ancien: 'numero' });
    const ART_87 = [V87, L93, L87];

    it('une date seule ne retient jamais la copie « même numéro »', () => {
        expect(ids(choisirVersions(ART_87, { date: '2015-03-04', ancien: null }, '87').versions)).toEqual(['l93']);
    });
    it('?ancien= vers la copie « même numéro » : aucun bandeau, version actuelle', () => {
        const c = choisirVersions(ART_87, { date: '2015-03-04', ancien: 'L87' }, '87');
        expect(c.estActuelle).toBe(true);
        expect(ids(c.versions)).toEqual(['v87']);
    });
    it('la copie de même sujet reste retenue', () => {
        expect(ids(choisirVersions(ART_87, { date: null, ancien: 'L93' }, '87').versions)).toEqual(['l93']);
    });
    it('un article sans prédécesseur par sujet : la copie « même numéro » ne devient pas sa version datée', () => {
        const ART_1 = [v('v1', '2026-09-03', { is_current: true }),
            v('l1', '1997-12-01', { ancien_numero: 'L.1.', expiration_date: '2026-09-03', lien_ancien: 'numero' })];
        const c = choisirVersions(ART_1, { date: '2010-01-01', ancien: null }, '1');
        expect(c.estActuelle).toBe(true);
        expect(ids(c.versions)).toEqual(['v1']);
    });
});
