import { describe, it, expect } from 'vitest';
import { decisionTextToHtml, getDecisionHtml } from '../../utils/decisionTextFormatter';

/*
 * Page décision servie (api/render.js) : le texte de la décision est mis en forme par texteDecisionEnHtml,
 * COPIE de decisionTextToHtml (src/utils/decisionTextFormatter.ts) que la fonction Vercel ne peut pas
 * importer. Le serveur doit produire le MÊME balisage que React (sinon la bascule serveur -> React change
 * police, marges et coupures), sans perdre un mot du texte de la base. Ce test casse dès que le
 * formateur React change : reporter alors la modification dans render.js.
 * Textes FICTIFS couvrant chaque branche du formateur (aucune décision réelle dans le dépôt) ; la même
 * vérification a été faite le 05/10/2026 sur 542 décisions réelles de la base, hors dépôt.
 */
const charger = (fichier: string): Promise<any> =>
    import(/* @vite-ignore */ decodeURIComponent(new URL(`../../../api/${fichier}`, import.meta.url).pathname));

const COMPOSITION = [
    'COMPOSITION DE LA JURIDICTION',
    '',
    'Président :',
    'Awa Diop',
    'Conseillers :',
    'Moussa Fall',
    'Khady Sarr',
    'Avocat général :',
    'Ibou Ndiaye',
    'Greffier :',
    'Fatou Ba',
    '',
    'RÉPUBLIQUE DU SÉNÉGAL',
    'Un Peuple - Un But - Une Foi',
    '',
    'AU NOM DU PEUPLE SÉNÉGALAIS',
].join('\n');
const PARAGRAPHES = [
    'Vu la loi organique relative à la Cour suprême ;',
    'Vu les pièces du dossier ;',
    'Attendu que le requérant soutient que la décision attaquée méconnaît la loi ;',
    'Considérant que le moyen manque en fait ;',
    'EN LA FORME',
    'Le pourvoi a été formé dans le délai légal ; il est recevable.',
    'AU FOND',
    'Sur le moyen unique tiré de la violation de l’article 12 du Code des obligations civiles et commerciales.',
    'ok',
    'PAR CES MOTIFS',
    'DÉCIDE : le pourvoi est rejeté ; les dépens sont mis à la charge du requérant.',
].join('\n\n');
// Sans double saut de ligne : le formateur découpe au point-virgule.
const SANS_PARAGRAPHES = 'Vu la requête ; Attendu que la demande est fondée ; DIT ET JUGE que la requête est recevable ; STATUANT à nouveau, condamne le défendeur.';
const HTML = '<div class="decision-body"><p class="visa"><em>Vu la loi.</em></p><p>Texte déjà balisé.</p></div>';

const TEXTES = [
    COMPOSITION + '\n\n' + PARAGRAPHES,
    PARAGRAPHES,
    'RÉPUBLIQUE DU SÉNÉGAL\nUn Peuple - Un But - Une Foi\n\n' + PARAGRAPHES,
    SANS_PARAGRAPHES,
    'Texte court & <balise> "citée".',
];
const norme = (h: string) => h.replace(/>\s+</g, '><').replace(/\s+/g, ' ').trim();
const mots = (h: string) => h.replace(/<[^>]+>/g, ' ').replace(/&#0?39;/g, "'").replace(/&[a-z]+;/g, ' ')
    .replace(/[^\p{L}\p{N}]+/gu, ' ').trim().split(' ');
const corpsServi = (html: string) => norme(html.split('<div class="legal-content"><div>')[1].split('</div></div></div></section>')[0]);

describe('parité du formateur de décisions (React / serveur)', () => {
    it('texteDecisionEnHtml produit le même balisage que decisionTextToHtml', async () => {
        const { texteDecisionEnHtml } = await charger('render.js');
        for (const t of TEXTES) expect(norme(texteDecisionEnHtml(t))).toBe(norme(decisionTextToHtml(t)));
        // Toutes les branches sont couvertes.
        const tout = TEXTES.map((t) => texteDecisionEnHtml(t)).join('');
        for (const c of ['master-composition', 'composition-item', 'decision-header', 'class="visa"', 'section-intermediate', 'class="dispositif"']) {
            expect(tout).toContain(c);
        }
    });

    it('corps servi = corps de la page React (texte_brut, texte_integral brut ou déjà balisé)', async () => {
        const { buildDecisionBody } = await charger('render.js');
        const cas = [
            { texte_brut: PARAGRAPHES, texte_integral: null },
            { texte_brut: null, texte_integral: COMPOSITION + '\n\n' + PARAGRAPHES },
            { texte_brut: null, texte_integral: SANS_PARAGRAPHES },
            { texte_brut: null, texte_integral: HTML },
        ];
        for (const d of cas) {
            const corps = buildDecisionBody({ ...d, slug: 'x', reference: 'R' }, [], [], {});
            expect(corpsServi(corps)).toBe(norme(getDecisionHtml(d)));
        }
    });

    it('aucun mot du texte de la base ne se perd dans le corps servi', async () => {
        const { buildDecisionBody } = await charger('render.js');
        for (const t of [...TEXTES, HTML]) {
            const servi = new Set(mots(buildDecisionBody({ texte_brut: t, slug: 'x', reference: 'R' }, [], [], {})));
            const manquants = [...new Set(mots(t))].filter((m) => m.length > 2 && !servi.has(m));
            expect(manquants).toEqual([]);
        }
    });
});
