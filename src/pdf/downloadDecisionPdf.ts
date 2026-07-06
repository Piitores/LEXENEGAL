// src/pdf/downloadDecisionPdf.ts
// Orchestrateur : décision (DB) + HTML → PDF téléchargé côté client.
import React from 'react';
import { pdf, type Document } from '@react-pdf/renderer';
import DecisionPdfDocument, { type DecisionPdfData } from './DecisionPdfDocument';
import { htmlToPdfBlocks } from '../lib/pdfBlocks';

function slugifyRef(ref?: string | null): string {
    const slug = (ref || '')
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    return slug || 'decision';
}

// Les seuls champs de la ligne `decisions` réellement lus ici : un renommage
// de colonne devient une erreur de compilation au lieu d'un '' silencieux.
interface DecisionRowForPdf {
    reference?: string | null;
    juridiction?: string | null;
    chambre?: string | null;
    date_decision?: string | null;
    matiere_principale?: string | null;
    resume?: string | null;
}

export async function downloadDecisionPdf(decision: DecisionRowForPdf, rawHtml: string): Promise<void> {
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
    // Délai de sécurité : laisser le navigateur démarrer le téléchargement avant de révoquer.
    setTimeout(() => URL.revokeObjectURL(url), 5000);
}
