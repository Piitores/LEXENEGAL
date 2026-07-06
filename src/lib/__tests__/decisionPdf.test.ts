// src/lib/__tests__/decisionPdf.test.ts
import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToBuffer, Document } from '@react-pdf/renderer';
import DecisionPdfDocument, { type DecisionPdfData } from '../../pdf/DecisionPdfDocument';
import { htmlToPdfBlocks } from '../pdfBlocks';

describe('DecisionPdfDocument', () => {
    it('rend un PDF valide (magic bytes %PDF), en-tête/pied inclus', async () => {
        const data: DecisionPdfData = {
            reference: 'Arrêt n° 72/2023',
            juridiction: 'Cour suprême',
            chambre: 'Chambre administrative',
            dateDecision: '17 novembre 2023',
            matiere: 'Contentieux électoral',
            resume: 'La Cour casse et annule la décision attaquée.',
            blocks: htmlToPdfBlocks(
                '<p class="visa"><em>Vu la Constitution ;</em></p>' +
                '<p>' + 'Attendu que la requête est recevable en la forme ; '.repeat(120) + '</p>' +
                '<blockquote class="dispositif"><p>PAR CES MOTIFS : casse et annule.</p></blockquote>',
            ),
            editionDate: '6 juillet 2026',
        };
        // renderToBuffer exige ReactElement<DocumentProps> ; notre wrapper rend un <Document>.
        const element = React.createElement(DecisionPdfDocument, { data }) as unknown as
            React.ReactElement<React.ComponentProps<typeof Document>>;
        const buf = await renderToBuffer(element);
        expect(buf.subarray(0, 4).toString()).toBe('%PDF');
        expect(buf.length).toBeGreaterThan(2000);
    }, 30000);
});
