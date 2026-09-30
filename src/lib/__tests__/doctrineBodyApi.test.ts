import { describe, it, expect } from 'vitest';

// Corps serveur des pages de doctrine (api/render.js, buildDoctrineBody) : extrait public, jamais le texte intégral.
const charger = (fichier: string): Promise<any> =>
    import(/* @vite-ignore */ decodeURIComponent(new URL(`../../../api/${fichier}`, import.meta.url).pathname));

const lettre = { slug: 'demande-de-precision-513-2016', numero: '513', date: '2016-04-18', objet: 'votre demande de précision.', reference_complete: 'N° 513 MEFP/DGID' };

describe('extrait public des lettres de doctrine (rendu serveur)', () => {
    it('affiche chaque paragraphe de l\'extrait, échappé', async () => {
        const { buildDoctrineBody } = await charger('render.js');
        const html = buildDoctrineBody({ ...lettre, extrait: "Par lettre visée en référence, vous demandez <b>des précisions</b>.\nVous souhaitez une attestation." });
        expect(html).toContain('<h2>Extrait de la lettre</h2>');
        expect(html).toContain('<p>Par lettre visée en référence, vous demandez &lt;b&gt;des précisions&lt;/b&gt;.</p>');
        expect(html).toContain('<p>Vous souhaitez une attestation.</p>');
    });
    it('pas de section vide sans extrait', async () => {
        const { buildDoctrineBody } = await charger('render.js');
        expect(buildDoctrineBody({ ...lettre, extrait: null })).not.toContain('ssr-doctrine-extrait');
    });
});
