import { describe, it, expect } from 'vitest';

/*
 * Robustesse des gabarits serveur (api/render.js) face à des valeurs de la base inattendues (relecture de
 * sécurité du 05/10/2026). Aucune n'est atteinte par les données actuelles : ces tests empêchent qu'elles le
 * deviennent sans bruit.
 */
const charger = (fichier: string): Promise<any> =>
    import(/* @vite-ignore */ decodeURIComponent(new URL(`../../../api/${fichier}`, import.meta.url).pathname));

const COQUILLE = '<!DOCTYPE html>\n<html lang="fr">\n<head>\n<title>x</title>\n<script>var a=1;</script>\n</head>\n<body>\n<div id="app"></div>\n<script type="module" src="/x.js"></script>\n</body>\n</html>';
const compte = (html: string, motif: RegExp) => (html.match(motif) || []).length;

describe('api/render.js : valeurs de la base hostiles', () => {
    it('injectIntoShell : les motifs « $ » d’une valeur ne recopient jamais la coquille', async () => {
        const { injectIntoShell } = await charger('render.js');
        for (const motif of ['$`', "$'", '$&', '$$', '$1']) {
            const html: string = injectIntoShell(COQUILLE, `<meta name="x" content="a ${motif} b">`, `<p>montant en ${motif} euros</p>`);
            expect(compte(html, /<!DOCTYPE/g), motif).toBe(1);
            expect(compte(html, /<head>/g), motif).toBe(1);
            expect(compte(html, /<script/g), motif).toBe(2);
            expect(html, motif).toContain(`<p>montant en ${motif} euros</p>`);
            expect(html, motif).toContain(`content="a ${motif} b"`);
        }
    });

    it('JSON-LD : un « </script> » venu de la base ne sort pas du bloc, et le JSON reste lisible', async () => {
        const { buildDecisionHead } = await charger('render.js');
        const reference = 'Arrêt </script><script>alert(1)</script>';
        const head: string = buildDecisionHead({ reference, juridiction: 'Cour suprême', date_decision: '2020-01-01' }, 'https://www.lexenegal.sn/decision/x');
        expect(head).not.toContain('<script>alert(1)');
        const blocs = [...head.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => m[1]);
        expect(blocs).toHaveLength(1);
        const schema = JSON.parse(blocs[0]);
        expect(schema[1].itemListElement[2].name).toBe(reference);
    });

    it('icônes, natures, comptes : jamais une valeur héritée de Object.prototype', async () => {
        const { buildCodesBody, presentationTexteSsr } = await charger('render.js');
        for (const icon of ['__proto__', 'constructor', 'toString', 'hasOwnProperty']) {
            const html: string = buildCodesBody([{ slug: 'constructor', title: 'Code X', category: 'code', branche_slug: 'civil' }],
                [{ slug: 'civil', label: 'Civil', icon, color: '#047857' }], {});
            expect(html, icon).not.toMatch(/\[object Object\]|native code|function /);
        }
        for (const category of ['__proto__', 'constructor', 'toString']) {
            const html: string = presentationTexteSsr({ title: 'T', category }, 0);
            expect(html, category).toContain('Texte juridique');
        }
    });

    it('/jurisprudence : cached_total échappé', async () => {
        const { buildJurisprudenceBody } = await charger('render.js');
        const html: string = buildJurisprudenceBody([{ slug: 's', label: 'L', matiere: null, cached_total: '<i>x</i>' }]);
        expect(html).not.toContain('<i>x</i>');
        expect(html).toContain('&lt;i&gt;x&lt;/i&gt;');
    });

    it('texte de décision : une longue suite de sauts de ligne ne coûte plus un temps quadratique, découpe inchangée', async () => {
        const { texteDecisionEnHtml } = await charger('render.js');
        const long = `Vu la loi ;${'\n'.repeat(20000)}Considérant que x ;\n\n\nPAR CES MOTIFS`;
        const t0 = performance.now();
        const html: string = texteDecisionEnHtml(long);
        expect(performance.now() - t0).toBeLessThan(200);
        expect(html).toBe(texteDecisionEnHtml('Vu la loi ;\n\nConsidérant que x ;\n\nPAR CES MOTIFS'));
        expect(texteDecisionEnHtml('a\n\n\n\nRÉPUBLIQUE DU SÉNÉGAL\nUn Peuple - Un But - Une Foi\n\n\n\nVu')).toBe(
            texteDecisionEnHtml('a\n\nRÉPUBLIQUE DU SÉNÉGAL\nUn Peuple - Un But - Une Foi\n\nVu'));
    });
});
