// src/pdf/downloadDecisionPdf.ts
// Orchestrateur : décision (DB) + HTML → PDF téléchargé côté client.
import React from 'react';
import { pdf, type Document } from '@react-pdf/renderer';
import DecisionPdfDocument, { type DecisionPdfData } from './DecisionPdfDocument';
import { htmlToPdfBlocks } from '../lib/pdfBlocks';

function slugifyRef(ref: string): string {
    return (ref || 'decision')
        .normalize('NFD').replace(/[̀-ͯ]/g, '')
        .replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

export async function downloadDecisionPdf(decision: any, rawHtml: string): Promise<void> {
    const fmt = (d?: string | null) =>
        d ? new Date(d).toLocaleDateString('fr-FR', { dateStyle: 'long' }) : '';
    const data: DecisionPdfData = {
        reference: decision.reference || 'Décision',
        juridiction: decision.juridiction || '',
        chambre: decision.chambre || '',
        dateDecision: fmt(decision.date_decision),
        matiere: decision.matiere_principale || '',
        resume: decision.resume || '',
        blocks: htmlToPdfBlocks(rawHtml),
        editionDate: new Date().toLocaleDateString('fr-FR', { dateStyle: 'long' }),
    };
    // pdf() exige ReactElement<DocumentProps> ; notre wrapper rend un <Document>.
    const element = React.createElement(DecisionPdfDocument, { data }) as unknown as
        React.ReactElement<React.ComponentProps<typeof Document>>;
    const blob = await pdf(element).toBlob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `LEXENEGAL-${slugifyRef(decision.reference)}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
}
