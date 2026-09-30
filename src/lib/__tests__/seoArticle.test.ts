import { describe, it, expect } from 'vitest';
import { nomCourtTexte, libelleSeoArticle, titreSeoArticle, descriptionSeoArticle } from '../seoArticle';

const penal = { title: 'Code Pénal', short_title: 'Code Pénal', category: 'code' };
const constitution = { title: 'Loi n° 2001-03 du 22 janvier 2001 portant Constitution', short_title: 'Constitution du Sénégal', category: 'code' };
const cgi = { title: 'Code Général des Impôts', short_title: 'CGI', category: 'code' };
const decret = { title: 'DECRET N°67-1360 du 9 décembre 1967 fixant les conditions et les modalités de désignation des délégués du personnel dans les entreprises et définissant leur mission.', short_title: null, category: 'decret' };
const loi = { title: 'Loi n° 2021-34 du 23 juillet 2021 modifiant la loi n° 65-61 du 21 juillet 1965 portant Code de procédure pénale', short_title: null, category: 'loi' };
const audcg = { title: 'Acte uniforme révisé portant sur le droit commercial général', short_title: 'Acte uniforme révisé portant sur le droit commercial général', category: 'ohada' };
const ccni = { title: 'Convention Collective Nationale Interprofessionnelle du Sénégal (2019)', short_title: null, category: 'convention_collective' };

describe('seoArticle', () => {
    it('titre au plus près des recherches (« article 363 du code pénal sénégalais »)', () => {
        expect(titreSeoArticle({ article_number: '363' }, penal)).toBe('Article 363 du Code Pénal du Sénégal | Lexenegal');
        expect(titreSeoArticle({ article_number: '83' }, constitution)).toBe('Article 83 de la Constitution du Sénégal | Lexenegal');
    });
    it('un sigle en nom court est remplacé par le titre', () => {
        expect(nomCourtTexte(cgi)).toBe('Code Général des Impôts');
        expect(titreSeoArticle({ article_number: '633' }, cgi)).toBe('Article 633 du Code Général des Impôts du Sénégal | Lexenegal');
    });
    it('numéro « L.107. » : préfixe Article, sans point final', () => {
        expect(libelleSeoArticle({ num: 'L.107.', article_number: 'L.107.' })).toBe('Article L.107');
        expect(libelleSeoArticle({ article_number: 'préambule' })).toBe('Préambule');
        expect(libelleSeoArticle({ num: 'Article premier' })).toBe('Article premier');
    });
    it('textes réglementaires : article défini minuscule, intitulé raccourci', () => {
        expect(nomCourtTexte(decret)).toBe('décret n° 67-1360 du 9 décembre 1967');
        expect(titreSeoArticle({ article_number: '3' }, decret)).toBe('Article 3 du décret n° 67-1360 du 9 décembre 1967 | Lexenegal');
        expect(titreSeoArticle({ article_number: '2' }, loi)).toBe('Article 2 de la loi n° 2021-34 du 23 juillet 2021 | Lexenegal');
    });
    it('actes OHADA et conventions', () => {
        expect(titreSeoArticle({ article_number: '133' }, audcg)).toBe("Article 133 de l'Acte uniforme révisé portant sur le droit commercial général | Lexenegal");
        expect(titreSeoArticle({ article_number: '27' }, ccni)).toBe('Article 27 de la Convention Collective Nationale Interprofessionnelle du Sénégal (2019) | Lexenegal');
        expect(titreSeoArticle({ article_number: 'préambule' }, constitution)).toBe('Préambule de la Constitution du Sénégal | Lexenegal');
    });
    it('pas de « du Sénégal » après une parenthèse', () => {
        expect(titreSeoArticle({ num: 'L.107.' }, { title: 'Code du Travail', short_title: 'Code du Travail de 1997 (abrogé)', category: 'code' }))
            .toBe('Article L.107 du Code du Travail de 1997 (abrogé) | Lexenegal');
    });
    it('description : intitulé puis extrait, 160 caractères au plus, coupé sur un mot', () => {
        const d = descriptionSeoArticle({ article_number: '363' }, penal, 'Les médecins, chirurgiens, ainsi que les pharmaciens, les sages-femmes et toutes autres personnes dépositaires, par état ou par profession ou par fonctions temporaires ou permanentes, des secrets qu’on leur confie');
        expect(d.startsWith('Article 363 du Code Pénal du Sénégal : Les médecins')).toBe(true);
        expect(d.length).toBeLessThanOrEqual(160);
        expect(d.endsWith('…')).toBe(true);
        expect(descriptionSeoArticle({ article_number: '1' }, penal, '')).toBe('Texte intégral et en vigueur de l’article 1 du Code Pénal du Sénégal, avec la jurisprudence qui le cite.');
    });
});
