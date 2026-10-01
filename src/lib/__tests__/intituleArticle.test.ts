import { describe, expect, it } from 'vitest';
import { apercuArticle, separerIntitule, texteAvecIntitule } from '../intituleArticle';

const sansBalises = (h: string) => h.replace(/<[^>]+>/g, ' ');

describe('separerIntitule', () => {
    it('reconnaît les trois classes d’intitulé publiées en base', () => {
        const cas = [
            '<p class="alinea intitule-article">Interdiction de la discrimination</p>\n<p class="alinea">La discrimination est interdite.</p>',
            '<p class="article-intitule"><strong>Interdiction de la discrimination</strong></p>\n<p class="alinea">La discrimination est interdite.</p>',
            '<p class="article-rubrique"><strong>Interdiction de la discrimination</strong></p>\n<p class="alinea">La discrimination est interdite.</p>',
        ];
        for (const html of cas) {
            const { intitule, corps } = separerIntitule(html);
            expect(sansBalises(intitule || '').trim()).toBe('Interdiction de la discrimination');
            expect(corps.trim()).toBe('<p class="alinea">La discrimination est interdite.</p>');
        }
    });

    it('ne prend jamais un alinéa ordinaire, un sous-titre interne ou un paragraphe qui n’est pas en tête', () => {
        for (const html of [
            '<p class="alinea">La présente loi fixe le cadre juridique.</p>',
            '<p class="alinea-titre"><strong>A - Travail des femmes</strong></p><p class="alinea">…</p>',
            '<p class="alinea">Texte.</p><p class="article-intitule"><strong>Pas en tête</strong></p>',
            '<p class="alinea niv1"><span class="marqueur">-</span> item ;</p>',
        ]) {
            expect(separerIntitule(html)).toEqual({ intitule: null, corps: html });
        }
    });

    it('tolère un contenu vide ou absent', () => {
        expect(separerIntitule(null)).toEqual({ intitule: null, corps: '' });
        expect(separerIntitule('')).toEqual({ intitule: null, corps: '' });
    });
});

describe('apercuArticle', () => {
    it('sépare l’intitulé du texte et tronque le texte seul', () => {
        const html = '<p class="alinea intitule-article">Définitions</p>\n<p class="alinea">' + 'mot '.repeat(120) + '</p>';
        const a = apercuArticle(html, sansBalises, 50);
        expect(a.intitule).toBe('Définitions');
        expect(a.texte.startsWith('mot mot')).toBe(true);
        expect(a.texte.endsWith('…')).toBe(true);
        expect(a.texte.length).toBe(51);
    });

    it('sans intitulé, rend le texte entier comme avant', () => {
        expect(apercuArticle('<p class="alinea">Tout condamné.</p>', sansBalises)).toEqual({
            intitule: null,
            texte: 'Tout condamné.',
        });
    });
});

describe('texteAvecIntitule', () => {
    it('ponctue l’intitulé pour qu’il ne se lise pas comme le début de la phrase', () => {
        expect(texteAvecIntitule('<p class="alinea intitule-article">Champ d’application</p>\n<p class="alinea">Le présent Code s’applique.</p>', sansBalises))
            .toBe('Champ d’application. Le présent Code s’applique.');
    });
    it('ne double pas une ponctuation déjà présente', () => {
        expect(texteAvecIntitule('<p class="article-intitule"><strong>De la durée :</strong></p><p class="alinea">Texte.</p>', sansBalises))
            .toBe('De la durée : Texte.');
    });
    it('sans intitulé, rend le texte tel quel', () => {
        expect(texteAvecIntitule('<p class="alinea">Tout condamné.</p>', sansBalises)).toBe('Tout condamné.');
    });
});
