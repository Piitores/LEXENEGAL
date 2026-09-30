import { describe, it, expect } from 'vitest';
import { articlesDeDoctrine, titreSeoDoctrine, descriptionSeoDoctrine, dateLongue } from '../seoDoctrine';

const cgi = { slug: 'code-general-impots', title: 'Code Général des Impôts', short_title: 'CGI', category: 'code' };
const lien = (n: string, ordre: number, actif = true) => ({ articles: { slug: `cgi-article-${n}`, num: `Article ${n}`, article_number: n, display_order: ordre, is_active: actif, laws_and_codes: cgi } });
const doc = { numero: '71', date: '2019-01-21', objet: 'demande de précision.', reference_complete: 'N° 71 MFB/DGID/DLEC du 21 janvier 2019' };

describe('seoDoctrine', () => {
    it('articles liés : actifs, sans doublon, dans l’ordre du code', () => {
        const a = articlesDeDoctrine([lien('669', 704), lien('256', 270), lien('256', 270), lien('12', 20, false)]);
        expect(a.map(x => x.numero)).toEqual(['256', '669']);
        expect(a[0].url).toBe('/code/code-general-impots/cgi-article-256');
    });
    it('date longue', () => {
        expect(dateLongue('2019-01-21')).toBe('21 janvier 2019');
        expect(dateLongue('2011-05-01')).toBe('1er mai 2011');
        expect(dateLongue(null)).toBe('');
    });
    it('titre : objet, articles du CGI, numéro et date', () => {
        const a = articlesDeDoctrine([lien('256', 270), lien('669', 704)]);
        expect(titreSeoDoctrine(doc, a)).toBe('Demande de précision : articles 256 et 669 du CGI - DGID n° 71 du 21 janvier 2019 | Lexenegal');
        expect(titreSeoDoctrine(doc, a.slice(0, 1))).toBe('Demande de précision : article 256 du CGI - DGID n° 71 du 21 janvier 2019 | Lexenegal');
        expect(titreSeoDoctrine(doc, [])).toBe('Demande de précision - DGID n° 71 du 21 janvier 2019 | Doctrine fiscale | Lexenegal');
        const beaucoup = articlesDeDoctrine(['1', '2', '3', '4', '5'].map((n, i) => lien(n, i)));
        expect(titreSeoDoctrine(doc, beaucoup)).toBe('Demande de précision : articles 1, 2, 3 et autres du CGI - DGID n° 71 du 21 janvier 2019 | Lexenegal');
    });
    it('description : jamais le texte réservé, seulement les métadonnées publiques', () => {
        const a = articlesDeDoctrine([lien('256', 270)]);
        expect(descriptionSeoDoctrine(doc, a)).toBe('Doctrine fiscale de la DGID (Sénégal), n° 71 du 21 janvier 2019 : demande de précision. Porte sur l’article 256 du CGI. Texte intégral réservé aux membres de Lexenegal.');
        expect(descriptionSeoDoctrine(doc, [])).toBe('Doctrine fiscale de la DGID (Sénégal), n° 71 du 21 janvier 2019 : demande de précision. Texte intégral réservé aux membres de Lexenegal.');
    });
});
