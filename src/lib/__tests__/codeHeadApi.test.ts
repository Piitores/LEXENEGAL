import { describe, it, expect } from 'vitest';

// En-tête serveur des pages de code (api/render.js, buildCodeHead).
const charger = (fichier: string): Promise<any> =>
    import(/* @vite-ignore */ decodeURIComponent(new URL(`../../../api/${fichier}`, import.meta.url).pathname));

const titre = (html: string) => (html.match(/<title[^>]*>([^<]*)<\/title>/) || [])[1];

describe('titre des pages de code (rendu serveur)', () => {
    it('nom court réduit à un sigle : nom en toutes lettres suivi du sigle', async () => {
        const { buildCodeHead } = await charger('render.js');
        const head = buildCodeHead({ slug: 'code-general-impots', title: 'Code Général des Impôts', short_title: 'CGI', category: 'code' }, 764, 'https://www.lexenegal.sn/code/code-general-impots');
        expect(titre(head)).toBe('Code Général des Impôts (CGI) du Sénégal - texte intégral et version consolidée | Lexenegal');
    });
    it('Acte uniforme OHADA à sigle : jamais « du Sénégal »', async () => {
        const { buildCodeHead } = await charger('render.js');
        const head = buildCodeHead({ slug: 'ohada-x', title: 'Acte uniforme portant organisation des sûretés', short_title: 'AUS', category: 'ohada' }, 0, 'https://www.lexenegal.sn/code/ohada-x');
        expect(titre(head)).toBe('Acte uniforme portant organisation des sûretés (AUS) - texte intégral | Lexenegal');
    });
    it('nom court ordinaire : inchangé', async () => {
        const { buildCodeHead } = await charger('render.js');
        const head = buildCodeHead({ slug: 'cocc', title: 'Code des obligations civiles et commerciales', short_title: 'Code des obligations civiles et commerciales', category: 'code' }, 0, 'https://www.lexenegal.sn/code/cocc');
        expect(titre(head)).toBe('Code des obligations civiles et commerciales du Sénégal - texte intégral et version consolidée | Lexenegal');
    });
});
