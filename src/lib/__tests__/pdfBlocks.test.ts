// src/lib/__tests__/pdfBlocks.test.ts
import { describe, it, expect } from 'vitest';
import { htmlToPdfBlocks, type PdfBlock } from '../pdfBlocks';

const textOf = (blocks: PdfBlock[]) =>
    blocks.map((b) => b.runs.map((r) => r.text).join('')).join(' ');

describe('htmlToPdfBlocks', () => {
    it('découpe des <p> en blocs normaux', () => {
        const b = htmlToPdfBlocks('<p>Premier.</p><p>Second.</p>');
        expect(b).toHaveLength(2);
        expect(b[0].variant).toBe('normal');
        expect(b[0].runs[0].text).toContain('Premier.');
    });

    it('rend gras et italique en runs', () => {
        const b = htmlToPdfBlocks('<p>Un <strong>mot gras</strong> et <em>italique</em>.</p>');
        const runs = b[0].runs;
        expect(runs.find((r) => r.bold)?.text).toContain('mot gras');
        expect(runs.find((r) => r.italic)?.text).toContain('italique');
    });

    it('décode les entités HTML', () => {
        const b = htmlToPdfBlocks('<p>Cass. &amp; CCJA &#039;test&#039; &lt;3&gt;&nbsp;!</p>');
        expect(textOf(b)).toContain("Cass. & CCJA 'test' <3> !");
    });

    it('mappe la classe visa', () => {
        const b = htmlToPdfBlocks('<p class="visa"><em>Vu la Constitution ;</em></p>');
        expect(b[0].variant).toBe('visa');
    });

    it('propage le dispositif aux <p> imbriqués (blockquote charte formatter)', () => {
        const b = htmlToPdfBlocks('<blockquote class="dispositif"><p>PAR CES MOTIFS</p></blockquote>');
        expect(b[0].variant).toBe('dispositif');
    });

    it('mappe les classes charte décisions (republique-header, delibere, dispositif-title)', () => {
        const b = htmlToPdfBlocks(
            '<p class="republique-header">RÉPUBLIQUE DU SÉNÉGAL</p>' +
            '<h3 class="decision-dispositif-title">DÉCIDE :</h3>' +
            '<p class="decision-delibere">Délibéré par la Cour…</p>',
        );
        expect(b[0].variant).toBe('centered-bold');
        expect(b[1].variant).toBe('heading');
        expect(b[2].variant).toBe('centered-italic');
    });

    it('h2/h3 et section-intermediate → heading', () => {
        const b = htmlToPdfBlocks('<h3 class="section-intermediate">AU FOND</h3><p>Texte.</p>');
        expect(b[0].variant).toBe('heading');
    });

    it('<li> → list', () => {
        const b = htmlToPdfBlocks('<ul><li>Premier point</li><li>Second point</li></ul>');
        expect(b.map((x) => x.variant)).toEqual(['list', 'list']);
    });

    it('les balises inconnues sont ignorées SANS perte de texte (span, a)', () => {
        const b = htmlToPdfBlocks('<p>Voir <a href="/x"><span>article 12</span></a> du code.</p>');
        expect(b).toHaveLength(1);
        expect(textOf(b)).toContain('Voir article 12 du code.');
    });

    it('texte nu sans balise → un bloc', () => {
        const b = htmlToPdfBlocks('Texte intégral non disponible.');
        expect(b).toHaveLength(1);
        expect(b[0].runs[0].text).toContain('Texte intégral non disponible.');
    });

    it('entrée vide → []', () => {
        expect(htmlToPdfBlocks('')).toEqual([]);
        expect(htmlToPdfBlocks('   ')).toEqual([]);
    });

    it('gras + italique combinés sur un même run', () => {
        const b = htmlToPdfBlocks('<p><strong><em>très important</em></strong></p>');
        const run = b[0].runs[0];
        expect(run.bold).toBe(true);
        expect(run.italic).toBe(true);
    });

    it('tolère les balises fermantes orphelines sans perdre de texte', () => {
        const b = htmlToPdfBlocks('</strong></p><p>Texte survivant.</em></div>');
        expect(textOf(b)).toContain('Texte survivant.');
    });

    it('retire les commentaires HTML (même avec un > interne) sans fuite de texte', () => {
        const b = htmlToPdfBlocks('<p>Avant <!-- a > b --> après.</p>');
        expect(textOf(b)).toContain('Avant');
        expect(textOf(b)).toContain('après.');
        expect(textOf(b)).not.toContain('b -->');
    });

    it('une entité numérique invalide reste littérale au lieu de faire échouer la conversion', () => {
        const b = htmlToPdfBlocks('<p>Code &#2097152; invalide, &#233;t&#xE9; valide.</p>');
        expect(textOf(b)).toContain('&#2097152;');
        expect(textOf(b)).toContain('été valide.');
    });

    it('ne perd aucun mot sur un HTML complet du formatter', () => {
        const html =
            '<div class="master-composition"><h3 class="composition-title">COMPOSITION DE LA JURIDICTION</h3>' +
            '<div class="composition-item"><span class="composition-role">Président</span><span class="composition-sep">:</span><span class="composition-name">Alioune NDAO</span></div></div>' +
            '<div class="decision-header"><h2 class="republique">RÉPUBLIQUE DU SÉNÉGAL</h2><p class="devise">Un Peuple - Un But - Une Foi</p></div>' +
            '<div class="decision-body"><p class="visa"><em>Vu la loi ;</em></p><p>Attendu que la requête est recevable ;</p>' +
            '<blockquote class="dispositif"><p>PAR CES MOTIFS : rejette le pourvoi.</p></blockquote></div>';
        const all = textOf(htmlToPdfBlocks(html));
        for (const mot of ['COMPOSITION', 'Alioune NDAO', 'RÉPUBLIQUE', 'Un Peuple', 'Vu la loi', 'recevable', 'PAR CES MOTIFS', 'rejette le pourvoi']) {
            expect(all).toContain(mot);
        }
    });
});
